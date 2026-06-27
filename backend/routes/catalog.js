'use strict';

// CRUD for the editable catalog: activities, metrics (symptoms), therapies.
const express = require('express');
const { db } = require('../db');
const { TIME_BLOCKS } = require('../helpers');

const router = express.Router();

function boolInt(v) {
  return v ? 1 : 0;
}

function normalizeExpectedDays(v) {
  if (v === null || v === undefined || v === '') return null;
  if (Array.isArray(v)) {
    const arr = v
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    return arr.length ? arr.join(',') : null;
  }
  // already a CSV string
  const arr = String(v)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return arr.length ? arr.join(',') : null;
}

/* ----------------------------- ACTIVITIES ----------------------------- */

router.get('/activities', (req, res) => {
  const includeInactive = req.query.includeInactive === '1' || req.query.all === '1';
  const rows = db
    .prepare(
      `SELECT * FROM activities ${includeInactive ? '' : 'WHERE active = 1'}
       ORDER BY display_order ASC, id ASC`
    )
    .all();
  res.json(rows);
});

router.post('/activities', (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const time_block = TIME_BLOCKS.includes(b.time_block) ? b.time_block : 'MID_MORNING';
  const maxOrder =
    db.prepare('SELECT COALESCE(MAX(display_order), -1) m FROM activities WHERE time_block = ?')
      .get(time_block).m;
  const info = db
    .prepare(
      `INSERT INTO activities (name, time_block, is_husband_task, expected_days, display_order, active, reminder_enabled, reminder_time)
       VALUES (@name, @time_block, @is_husband_task, @expected_days, @display_order, 1, @reminder_enabled, @reminder_time)`
    )
    .run({
      name: String(b.name).trim(),
      time_block,
      is_husband_task: boolInt(b.is_husband_task),
      expected_days: normalizeExpectedDays(b.expected_days),
      display_order: maxOrder + 1,
      reminder_enabled: boolInt(b.reminder_enabled),
      reminder_time: b.reminder_time || null,
    });
  res.status(201).json(db.prepare('SELECT * FROM activities WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/activities/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};

  const next = {
    name: b.name !== undefined ? String(b.name).trim() : existing.name,
    time_block:
      b.time_block !== undefined && TIME_BLOCKS.includes(b.time_block)
        ? b.time_block
        : existing.time_block,
    is_husband_task:
      b.is_husband_task !== undefined ? boolInt(b.is_husband_task) : existing.is_husband_task,
    expected_days:
      b.expected_days !== undefined
        ? normalizeExpectedDays(b.expected_days)
        : existing.expected_days,
    display_order:
      b.display_order !== undefined ? Number(b.display_order) : existing.display_order,
    active: b.active !== undefined ? boolInt(b.active) : existing.active,
    reminder_enabled:
      b.reminder_enabled !== undefined ? boolInt(b.reminder_enabled) : existing.reminder_enabled,
    reminder_time: b.reminder_time !== undefined ? b.reminder_time || null : existing.reminder_time,
    id,
  };
  db.prepare(
    `UPDATE activities SET name=@name, time_block=@time_block, is_husband_task=@is_husband_task,
       expected_days=@expected_days, display_order=@display_order, active=@active,
       reminder_enabled=@reminder_enabled, reminder_time=@reminder_time, updated_at=datetime('now')
     WHERE id=@id`
  ).run(next);
  res.json(db.prepare('SELECT * FROM activities WHERE id = ?').get(id));
});

// Soft-retire by default (keeps history). Pass ?hard=1 to delete permanently.
router.delete('/activities/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (req.query.hard === '1') {
    db.prepare('DELETE FROM activities WHERE id = ?').run(id);
    return res.json({ ok: true, deleted: true });
  }
  db.prepare("UPDATE activities SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  res.json(db.prepare('SELECT * FROM activities WHERE id = ?').get(id));
});

// Bulk reorder: body = { order: [id1, id2, ...] } sets display_order by array index.
router.post('/activities/reorder', (req, res) => {
  const order = (req.body && req.body.order) || [];
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of ids' });
  const upd = db.prepare("UPDATE activities SET display_order = ?, updated_at = datetime('now') WHERE id = ?");
  const tx = db.transaction(() => {
    order.forEach((id, i) => upd.run(i, Number(id)));
  });
  tx();
  res.json({ ok: true });
});

/* ------------------------------- METRICS ------------------------------ */

router.get('/metrics', (req, res) => {
  const includeInactive = req.query.includeInactive === '1' || req.query.all === '1';
  const rows = db
    .prepare(
      `SELECT * FROM metrics ${includeInactive ? '' : 'WHERE active = 1'}
       ORDER BY display_order ASC, id ASC`
    )
    .all();
  res.json(rows);
});

router.post('/metrics', (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'name is required' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order), -1) m FROM metrics').get().m;
  const key = b.key ? String(b.key).trim() : `custom_${Date.now()}`;
  const info = db
    .prepare(
      `INSERT INTO metrics (key, name, good_direction, min_value, max_value, time_hint, display_order, active)
       VALUES (@key, @name, @good_direction, @min_value, @max_value, @time_hint, @display_order, 1)`
    )
    .run({
      key,
      name: String(b.name).trim(),
      good_direction: b.good_direction === 'low' ? 'low' : 'high',
      min_value: Number.isInteger(b.min_value) ? b.min_value : 1,
      max_value: Number.isInteger(b.max_value) ? b.max_value : 10,
      time_hint: b.time_hint || 'anytime',
      display_order: maxOrder + 1,
    });
  res.status(201).json(db.prepare('SELECT * FROM metrics WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/metrics/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM metrics WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const next = {
    name: b.name !== undefined ? String(b.name).trim() : existing.name,
    good_direction:
      b.good_direction !== undefined
        ? (b.good_direction === 'low' ? 'low' : 'high')
        : existing.good_direction,
    min_value: b.min_value !== undefined ? Number(b.min_value) : existing.min_value,
    max_value: b.max_value !== undefined ? Number(b.max_value) : existing.max_value,
    time_hint: b.time_hint !== undefined ? b.time_hint : existing.time_hint,
    display_order: b.display_order !== undefined ? Number(b.display_order) : existing.display_order,
    active: b.active !== undefined ? boolInt(b.active) : existing.active,
    id,
  };
  db.prepare(
    `UPDATE metrics SET name=@name, good_direction=@good_direction, min_value=@min_value,
       max_value=@max_value, time_hint=@time_hint, display_order=@display_order, active=@active
     WHERE id=@id`
  ).run(next);
  res.json(db.prepare('SELECT * FROM metrics WHERE id = ?').get(id));
});

router.delete('/metrics/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM metrics WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (req.query.hard === '1') {
    db.prepare('DELETE FROM metrics WHERE id = ?').run(id);
    return res.json({ ok: true, deleted: true });
  }
  db.prepare('UPDATE metrics SET active = 0 WHERE id = ?').run(id);
  res.json(db.prepare('SELECT * FROM metrics WHERE id = ?').get(id));
});

router.post('/metrics/reorder', (req, res) => {
  const order = (req.body && req.body.order) || [];
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of ids' });
  const upd = db.prepare('UPDATE metrics SET display_order = ? WHERE id = ?');
  const tx = db.transaction(() => order.forEach((id, i) => upd.run(i, Number(id))));
  tx();
  res.json({ ok: true });
});

/* ------------------------------ THERAPIES ----------------------------- */

router.get('/therapies', (req, res) => {
  const includeInactive = req.query.includeInactive === '1' || req.query.all === '1';
  const rows = db
    .prepare(
      `SELECT * FROM therapies ${includeInactive ? '' : 'WHERE active = 1'}
       ORDER BY display_order ASC, id ASC`
    )
    .all();
  res.json(rows);
});

router.post('/therapies', (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'name is required' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order), -1) m FROM therapies').get().m;
  const info = db
    .prepare(
      `INSERT INTO therapies (name, cadence_days, display_order, active)
       VALUES (@name, @cadence_days, @display_order, 1)`
    )
    .run({
      name: String(b.name).trim(),
      cadence_days: Number.isInteger(b.cadence_days) ? b.cadence_days : 7,
      display_order: maxOrder + 1,
    });
  res.status(201).json(db.prepare('SELECT * FROM therapies WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/therapies/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM therapies WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const next = {
    name: b.name !== undefined ? String(b.name).trim() : existing.name,
    cadence_days: b.cadence_days !== undefined ? Number(b.cadence_days) : existing.cadence_days,
    display_order: b.display_order !== undefined ? Number(b.display_order) : existing.display_order,
    active: b.active !== undefined ? boolInt(b.active) : existing.active,
    id,
  };
  db.prepare(
    `UPDATE therapies SET name=@name, cadence_days=@cadence_days, display_order=@display_order, active=@active WHERE id=@id`
  ).run(next);
  res.json(db.prepare('SELECT * FROM therapies WHERE id = ?').get(id));
});

router.delete('/therapies/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM therapies WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (req.query.hard === '1') {
    db.prepare('DELETE FROM therapies WHERE id = ?').run(id);
    return res.json({ ok: true, deleted: true });
  }
  db.prepare('UPDATE therapies SET active = 0 WHERE id = ?').run(id);
  res.json(db.prepare('SELECT * FROM therapies WHERE id = ?').get(id));
});

module.exports = router;
