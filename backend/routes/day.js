'use strict';

// Reading a single day, and all the small per-day writes that the Today /
// History screens make. Writes are upserts keyed by natural keys so that the
// offline outbox can safely replay them.
const express = require('express');
const { db } = require('../db');
const { STATUSES, isValidDate, clampInt } = require('../helpers');

const router = express.Router();

// GET /api/day/:date -> everything recorded for that date.
// Returns compact maps keyed by id; the client merges with its catalog lists.
router.get('/day/:date', (req, res) => {
  const date = req.params.date;
  if (!isValidDate(date)) return res.status(400).json({ error: 'invalid date' });

  const logs = db.prepare('SELECT activity_id, status FROM activity_logs WHERE date = ?').all(date);
  const logMap = {};
  logs.forEach((r) => { logMap[r.activity_id] = r.status; });

  const sym = db
    .prepare(
      `SELECT metric_id,
              ROUND(AVG(value), 1) AS avg,
              COUNT(*)             AS count,
              MAX(value)           AS max,
              MIN(value)           AS min
       FROM symptom_entries WHERE date = ? GROUP BY metric_id`
    )
    .all(date);
  // last recorded value per metric (most recent entry that day)
  const last = db
    .prepare(
      `SELECT s.metric_id, s.value FROM symptom_entries s
       JOIN (SELECT metric_id, MAX(id) mid FROM symptom_entries WHERE date = ? GROUP BY metric_id) t
       ON s.id = t.mid`
    )
    .all(date);
  const lastMap = {};
  last.forEach((r) => { lastMap[r.metric_id] = r.value; });
  const symMap = {};
  sym.forEach((r) => {
    symMap[r.metric_id] = { avg: r.avg, count: r.count, value: lastMap[r.metric_id], min: r.min, max: r.max };
  });

  const meta = db.prepare('SELECT notes, cycle_day FROM daily_notes WHERE date = ?').get(date) || {
    notes: null,
    cycle_day: null,
  };

  const therapyRows = db.prepare('SELECT therapy_id FROM therapy_logs WHERE date = ?').all(date);
  const therapies = therapyRows.map((r) => r.therapy_id);

  res.json({
    date,
    logs: logMap,
    symptoms: symMap,
    notes: meta.notes ?? null,
    cycle_day: meta.cycle_day ?? null,
    therapies,
  });
});

/* --------------------------- ACTIVITY LOGS ---------------------------- */
// PUT /api/logs  { activity_id, date, status }
// status null / '' / 'UNSET' clears the entry (back to "not recorded").
router.put('/logs', (req, res) => {
  const b = req.body || {};
  const activity_id = Number(b.activity_id);
  const date = b.date;
  let status = b.status;
  if (!activity_id || !isValidDate(date)) {
    return res.status(400).json({ error: 'activity_id and valid date required' });
  }
  if (status === '' || status === 'UNSET' || status === null || status === undefined) {
    db.prepare('DELETE FROM activity_logs WHERE activity_id = ? AND date = ?').run(activity_id, date);
    return res.json({ ok: true, activity_id, date, status: null });
  }
  status = String(status).toUpperCase();
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' });
  db.prepare(
    `INSERT INTO activity_logs (activity_id, date, status, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(activity_id, date) DO UPDATE SET status = excluded.status, updated_at = datetime('now')`
  ).run(activity_id, date, status);
  res.json({ ok: true, activity_id, date, status });
});

/* ----------------------------- SYMPTOMS ------------------------------- */
// PUT /api/symptoms  { date, metric_id, value }  -> REPLACE day's reading(s)
//   (the normal "tap a number" action: clears prior readings, stores one)
router.put('/symptoms', (req, res) => {
  const b = req.body || {};
  const metric_id = Number(b.metric_id);
  const date = b.date;
  if (!metric_id || !isValidDate(date)) {
    return res.status(400).json({ error: 'metric_id and valid date required' });
  }
  const metric = db.prepare('SELECT * FROM metrics WHERE id = ?').get(metric_id);
  if (!metric) return res.status(404).json({ error: 'unknown metric' });

  if (b.value === null || b.value === '' || b.value === undefined) {
    db.prepare('DELETE FROM symptom_entries WHERE metric_id = ? AND date = ?').run(metric_id, date);
    return res.json({ ok: true, cleared: true, metric_id, date });
  }
  const value = clampInt(b.value, metric.min_value, metric.max_value);
  if (value === null) return res.status(400).json({ error: 'invalid value' });

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM symptom_entries WHERE metric_id = ? AND date = ?').run(metric_id, date);
    db.prepare('INSERT INTO symptom_entries (metric_id, date, value) VALUES (?, ?, ?)').run(
      metric_id,
      date,
      value
    );
  });
  tx();
  res.json({ ok: true, metric_id, date, value, avg: value, count: 1 });
});

// POST /api/symptoms  { date, metric_id, value }  -> ADD a reading (averages)
//   (the "log again" action used to record a second reading later in the day)
router.post('/symptoms', (req, res) => {
  const b = req.body || {};
  const metric_id = Number(b.metric_id);
  const date = b.date;
  if (!metric_id || !isValidDate(date)) {
    return res.status(400).json({ error: 'metric_id and valid date required' });
  }
  const metric = db.prepare('SELECT * FROM metrics WHERE id = ?').get(metric_id);
  if (!metric) return res.status(404).json({ error: 'unknown metric' });
  const value = clampInt(b.value, metric.min_value, metric.max_value);
  if (value === null) return res.status(400).json({ error: 'invalid value' });
  db.prepare('INSERT INTO symptom_entries (metric_id, date, value) VALUES (?, ?, ?)').run(
    metric_id,
    date,
    value
  );
  const agg = db
    .prepare('SELECT ROUND(AVG(value),1) avg, COUNT(*) count FROM symptom_entries WHERE metric_id = ? AND date = ?')
    .get(metric_id, date);
  res.json({ ok: true, metric_id, date, value, avg: agg.avg, count: agg.count });
});

// DELETE /api/symptoms  { date, metric_id } -> clear that metric for the day
router.delete('/symptoms', (req, res) => {
  const b = req.body || {};
  const metric_id = Number(b.metric_id);
  const date = b.date;
  if (!metric_id || !isValidDate(date)) {
    return res.status(400).json({ error: 'metric_id and valid date required' });
  }
  db.prepare('DELETE FROM symptom_entries WHERE metric_id = ? AND date = ?').run(metric_id, date);
  res.json({ ok: true, cleared: true });
});

/* ---------------------------- DAY META -------------------------------- */
// PUT /api/day-meta  { date, notes, cycle_day }
router.put('/day-meta', (req, res) => {
  const b = req.body || {};
  const date = b.date;
  if (!isValidDate(date)) return res.status(400).json({ error: 'valid date required' });
  const notes = b.notes !== undefined ? (b.notes === '' ? null : String(b.notes)) : null;
  let cycle_day = null;
  if (b.cycle_day !== undefined && b.cycle_day !== null && b.cycle_day !== '') {
    cycle_day = clampInt(b.cycle_day, 1, 60);
  }
  db.prepare(
    `INSERT INTO daily_notes (date, notes, cycle_day, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(date) DO UPDATE SET notes = excluded.notes, cycle_day = excluded.cycle_day, updated_at = datetime('now')`
  ).run(date, notes, cycle_day);
  res.json({ ok: true, date, notes, cycle_day });
});

/* --------------------------- THERAPY LOGS ----------------------------- */
// POST /api/therapy-logs  { therapy_id, date }
router.post('/therapy-logs', (req, res) => {
  const b = req.body || {};
  const therapy_id = Number(b.therapy_id);
  const date = b.date;
  if (!therapy_id || !isValidDate(date)) {
    return res.status(400).json({ error: 'therapy_id and valid date required' });
  }
  db.prepare(
    `INSERT INTO therapy_logs (therapy_id, date) VALUES (?, ?)
     ON CONFLICT(therapy_id, date) DO NOTHING`
  ).run(therapy_id, date);
  res.json({ ok: true, therapy_id, date, done: true });
});

// DELETE /api/therapy-logs  { therapy_id, date }
router.delete('/therapy-logs', (req, res) => {
  const b = req.body || {};
  const therapy_id = Number(b.therapy_id);
  const date = b.date;
  if (!therapy_id || !isValidDate(date)) {
    return res.status(400).json({ error: 'therapy_id and valid date required' });
  }
  db.prepare('DELETE FROM therapy_logs WHERE therapy_id = ? AND date = ?').run(therapy_id, date);
  res.json({ ok: true, therapy_id, date, done: false });
});

module.exports = router;
