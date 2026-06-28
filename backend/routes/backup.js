'use strict';

// Backup & restore: full JSON export (the real backup, used by import),
// CSV exports for spreadsheets, and a JSON import that restores everything.
const express = require('express');
const { db } = require('../db');
const { isValidDate } = require('../helpers');

const router = express.Router();

const TABLES = [
  'activities',
  'metrics',
  'therapies',
  'trackers',
  'tracker_options',
  'activity_logs',
  'symptom_entries',
  'daily_notes',
  'therapy_logs',
  'tracker_logs',
  'library_entries',
  'settings',
];

function dumpAll() {
  const data = {};
  for (const t of TABLES) {
    data[t] = db.prepare(`SELECT * FROM ${t}`).all();
  }
  return {
    app: 'WellNest',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

// GET /api/export/json -> full backup
router.get('/export/json', (req, res) => {
  const payload = dumpAll();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="wellnest-backup-${new Date().toISOString().slice(0, 10)}.json"`
  );
  res.send(JSON.stringify(payload, null, 2));
});

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRow(arr) {
  return arr.map(csvCell).join(',');
}

function dateBounds(req) {
  const minmax = db
    .prepare(
      `SELECT MIN(d) lo, MAX(d) hi FROM (
         SELECT date d FROM activity_logs
         UNION SELECT date FROM symptom_entries
         UNION SELECT date FROM daily_notes
         UNION SELECT date FROM therapy_logs)`
    )
    .get();
  const from = isValidDate(req.query.from) ? req.query.from : (minmax.lo || new Date().toISOString().slice(0, 10));
  const to = isValidDate(req.query.to) ? req.query.to : (minmax.hi || new Date().toISOString().slice(0, 10));
  return { from, to };
}

// GET /api/export/csv?type=daily|activities|symptoms&from=&to=
router.get('/export/csv', (req, res) => {
  const type = req.query.type || 'daily';
  const { from, to } = dateBounds(req);
  let csv = '';
  let filename = `wellnest-${type}-${to}.csv`;

  if (type === 'symptoms') {
    const rows = db
      .prepare(
        `SELECT s.date, m.name metric, s.value, s.created_at
         FROM symptom_entries s JOIN metrics m ON m.id = s.metric_id
         WHERE s.date BETWEEN ? AND ? ORDER BY s.date, m.display_order`
      )
      .all(from, to);
    csv = csvRow(['date', 'metric', 'value', 'logged_at']) + '\n';
    csv += rows.map((r) => csvRow([r.date, r.metric, r.value, r.created_at])).join('\n');
  } else if (type === 'activities') {
    // Wide matrix: one row per date, one column per activity (status).
    const acts = db.prepare('SELECT * FROM activities ORDER BY display_order, id').all();
    const logs = db
      .prepare('SELECT activity_id, date, status FROM activity_logs WHERE date BETWEEN ? AND ?')
      .all(from, to);
    const dates = [...new Set(logs.map((l) => l.date))].sort();
    const map = new Map(logs.map((l) => [`${l.activity_id}|${l.date}`, l.status]));
    csv = csvRow(['date', ...acts.map((a) => a.name)]) + '\n';
    csv += dates
      .map((d) => csvRow([d, ...acts.map((a) => map.get(`${a.id}|${d}`) || '')]))
      .join('\n');
  } else {
    // daily: date + each metric daily average + activity completion %
    const metrics = db.prepare('SELECT * FROM metrics ORDER BY display_order, id').all();
    const symRows = db
      .prepare(
        `SELECT date, metric_id, ROUND(AVG(value),2) v FROM symptom_entries
         WHERE date BETWEEN ? AND ? GROUP BY date, metric_id`
      )
      .all(from, to);
    const notes = db.prepare('SELECT date, notes, cycle_day FROM daily_notes WHERE date BETWEEN ? AND ?').all(from, to);
    const noteMap = new Map(notes.map((n) => [n.date, n]));
    const symMap = new Map(symRows.map((r) => [`${r.date}|${r.metric_id}`, r.v]));
    const dates = [
      ...new Set([
        ...symRows.map((r) => r.date),
        ...notes.map((n) => n.date),
        ...db.prepare('SELECT DISTINCT date FROM activity_logs WHERE date BETWEEN ? AND ?').all(from, to).map((r) => r.date),
      ]),
    ].sort();
    csv = csvRow(['date', ...metrics.map((m) => m.name), 'cycle_day', 'notes']) + '\n';
    csv += dates
      .map((d) =>
        csvRow([
          d,
          ...metrics.map((m) => symMap.get(`${d}|${m.id}`) ?? ''),
          noteMap.get(d)?.cycle_day ?? '',
          noteMap.get(d)?.notes ?? '',
        ])
      )
      .join('\n');
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// POST /api/import  { data: {...} }  (accepts a full export payload)
// Replaces ALL data with the contents of the backup, in one transaction.
router.post('/import', (req, res) => {
  const body = req.body || {};
  const payload = body.data ? body : (body.app === 'WellNest' ? body : null);
  const data = payload?.data;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid backup file (expected a WellNest JSON export).' });
  }

  try {
    const tx = db.transaction(() => {
      // Clear in FK-safe order (children first).
      const clearOrder = [
        'tracker_logs',
        'tracker_options',
        'therapy_logs',
        'symptom_entries',
        'activity_logs',
        'daily_notes',
        'library_entries',
        'activities',
        'metrics',
        'therapies',
        'trackers',
        'settings',
      ];
      for (const t of clearOrder) db.prepare(`DELETE FROM ${t}`).run();

      const insertRows = (table, rows, columns) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        const cols = columns.filter((c) => Object.prototype.hasOwnProperty.call(rows[0], c));
        if (cols.length === 0) return;
        const stmt = db.prepare(
          `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`
        );
        for (const r of rows) {
          const clean = {};
          cols.forEach((c) => { clean[c] = r[c] ?? null; });
          stmt.run(clean);
        }
      };

      insertRows('metrics', data.metrics, ['id', 'key', 'name', 'good_direction', 'min_value', 'max_value', 'time_hint', 'display_order', 'active']);
      insertRows('therapies', data.therapies, ['id', 'name', 'cadence_days', 'display_order', 'active']);
      insertRows('trackers', data.trackers, ['id', 'name', 'kind', 'section', 'has_intensity', 'icon', 'hint', 'display_order', 'active']);
      insertRows('tracker_options', data.tracker_options, ['id', 'tracker_id', 'label', 'emoji', 'display_order', 'active']);
      insertRows('activities', data.activities, ['id', 'name', 'time_block', 'is_husband_task', 'expected_days', 'display_order', 'active', 'reminder_enabled', 'reminder_time', 'created_at', 'updated_at']);
      insertRows('activity_logs', data.activity_logs, ['id', 'activity_id', 'date', 'status', 'updated_at']);
      insertRows('symptom_entries', data.symptom_entries, ['id', 'metric_id', 'date', 'value', 'created_at']);
      insertRows('daily_notes', data.daily_notes, ['date', 'notes', 'cycle_day', 'updated_at']);
      insertRows('therapy_logs', data.therapy_logs, ['id', 'therapy_id', 'date', 'created_at']);
      insertRows('tracker_logs', data.tracker_logs, ['id', 'tracker_id', 'option_id', 'date', 'intensity', 'created_at']);
      insertRows('library_entries', data.library_entries, ['id', 'category', 'title', 'body', 'link', 'contact', 'address', 'image_url', 'entry_date', 'provider', 'pinned', 'display_order', 'created_at', 'updated_at']);
      insertRows('settings', data.settings, ['key', 'value']);
    });
    tx();
  } catch (e) {
    return res.status(500).json({ error: 'Import failed: ' + e.message });
  }

  const counts = {};
  for (const t of TABLES) counts[t] = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  res.json({ ok: true, counts });
});

module.exports = router;
