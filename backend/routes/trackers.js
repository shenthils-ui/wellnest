'use strict';

// CRUD for "chip" trackers and their options. Tracker *logs* (the daily taps)
// live in routes/day.js alongside the other per-day writes.
const express = require('express');
const { db } = require('../db');

const router = express.Router();

const KINDS = ['multi', 'single'];
const SECTIONS = ['food', 'feeling'];

function trackerWithOptions(t) {
  const options = db
    .prepare('SELECT * FROM tracker_options WHERE tracker_id = ? AND active = 1 ORDER BY display_order, id')
    .all(t.id);
  return { ...t, options };
}

// GET /api/trackers -> trackers (active) each with their active options
router.get('/trackers', (req, res) => {
  const includeInactive = req.query.includeInactive === '1' || req.query.all === '1';
  const trackers = db
    .prepare(`SELECT * FROM trackers ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY display_order, id`)
    .all();
  const optStmt = db.prepare(
    `SELECT * FROM tracker_options WHERE tracker_id = ? ${includeInactive ? '' : 'AND active = 1'} ORDER BY display_order, id`
  );
  res.json(trackers.map((t) => ({ ...t, options: optStmt.all(t.id) })));
});

router.post('/trackers', (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'name is required' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order), -1) m FROM trackers').get().m;
  const info = db
    .prepare(
      `INSERT INTO trackers (name, kind, section, has_intensity, icon, hint, display_order, active)
       VALUES (@name, @kind, @section, @has_intensity, @icon, @hint, @display_order, 1)`
    )
    .run({
      name: String(b.name).trim(),
      kind: KINDS.includes(b.kind) ? b.kind : 'multi',
      section: SECTIONS.includes(b.section) ? b.section : 'food',
      has_intensity: b.has_intensity ? 1 : 0,
      icon: b.icon || null,
      hint: b.hint || null,
      display_order: maxOrder + 1,
    });
  const tracker = db.prepare('SELECT * FROM trackers WHERE id = ?').get(info.lastInsertRowid);
  // optional initial options
  if (Array.isArray(b.options)) {
    const insOpt = db.prepare('INSERT INTO tracker_options (tracker_id, label, emoji, display_order, active) VALUES (?, ?, ?, ?, 1)');
    b.options.forEach((o, i) => {
      const label = typeof o === 'string' ? o : o.label;
      if (label && label.trim()) insOpt.run(tracker.id, label.trim(), (o && o.emoji) || null, i);
    });
  }
  res.status(201).json(trackerWithOptions(tracker));
});

router.put('/trackers/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM trackers WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const next = {
    name: b.name !== undefined ? String(b.name).trim() : existing.name,
    kind: b.kind !== undefined && KINDS.includes(b.kind) ? b.kind : existing.kind,
    section: b.section !== undefined && SECTIONS.includes(b.section) ? b.section : existing.section,
    has_intensity: b.has_intensity !== undefined ? (b.has_intensity ? 1 : 0) : existing.has_intensity,
    icon: b.icon !== undefined ? (b.icon || null) : existing.icon,
    hint: b.hint !== undefined ? (b.hint || null) : existing.hint,
    display_order: b.display_order !== undefined ? Number(b.display_order) : existing.display_order,
    active: b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
    id,
  };
  db.prepare(
    `UPDATE trackers SET name=@name, kind=@kind, section=@section, has_intensity=@has_intensity,
       icon=@icon, hint=@hint, display_order=@display_order, active=@active WHERE id=@id`
  ).run(next);
  res.json(trackerWithOptions(db.prepare('SELECT * FROM trackers WHERE id = ?').get(id)));
});

router.delete('/trackers/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM trackers WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (req.query.hard === '1') {
    db.prepare('DELETE FROM trackers WHERE id = ?').run(id);
    return res.json({ ok: true, deleted: true });
  }
  db.prepare('UPDATE trackers SET active = 0 WHERE id = ?').run(id);
  res.json({ ok: true, retired: true });
});

router.post('/trackers/reorder', (req, res) => {
  const order = (req.body && req.body.order) || [];
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of ids' });
  const upd = db.prepare('UPDATE trackers SET display_order = ? WHERE id = ?');
  db.transaction(() => order.forEach((tid, i) => upd.run(i, Number(tid))))();
  res.json({ ok: true });
});

/* ------------------------------- OPTIONS ------------------------------ */
router.post('/trackers/:id/options', (req, res) => {
  const tracker_id = Number(req.params.id);
  const tracker = db.prepare('SELECT * FROM trackers WHERE id = ?').get(tracker_id);
  if (!tracker) return res.status(404).json({ error: 'tracker not found' });
  const b = req.body || {};
  if (!b.label || !String(b.label).trim()) return res.status(400).json({ error: 'label is required' });
  // reactivate if a matching label was retired, so we don't pile up duplicates
  const dupe = db
    .prepare('SELECT * FROM tracker_options WHERE tracker_id = ? AND label = ? COLLATE NOCASE')
    .get(tracker_id, String(b.label).trim());
  if (dupe) {
    db.prepare('UPDATE tracker_options SET active = 1 WHERE id = ?').run(dupe.id);
    return res.status(200).json(db.prepare('SELECT * FROM tracker_options WHERE id = ?').get(dupe.id));
  }
  const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order), -1) m FROM tracker_options WHERE tracker_id = ?').get(tracker_id).m;
  const info = db
    .prepare('INSERT INTO tracker_options (tracker_id, label, emoji, display_order, active) VALUES (?, ?, ?, ?, 1)')
    .run(tracker_id, String(b.label).trim(), b.emoji || null, maxOrder + 1);
  res.status(201).json(db.prepare('SELECT * FROM tracker_options WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/trackers/:id/options/:optionId', (req, res) => {
  const optionId = Number(req.params.optionId);
  const existing = db.prepare('SELECT * FROM tracker_options WHERE id = ?').get(optionId);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const next = {
    label: b.label !== undefined ? String(b.label).trim() : existing.label,
    emoji: b.emoji !== undefined ? (b.emoji || null) : existing.emoji,
    display_order: b.display_order !== undefined ? Number(b.display_order) : existing.display_order,
    active: b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
    id: optionId,
  };
  db.prepare('UPDATE tracker_options SET label=@label, emoji=@emoji, display_order=@display_order, active=@active WHERE id=@id').run(next);
  res.json(db.prepare('SELECT * FROM tracker_options WHERE id = ?').get(optionId));
});

router.delete('/trackers/:id/options/:optionId', (req, res) => {
  const optionId = Number(req.params.optionId);
  const existing = db.prepare('SELECT * FROM tracker_options WHERE id = ?').get(optionId);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (req.query.hard === '1') {
    db.prepare('DELETE FROM tracker_options WHERE id = ?').run(optionId);
    return res.json({ ok: true, deleted: true });
  }
  db.prepare('UPDATE tracker_options SET active = 0 WHERE id = ?').run(optionId);
  res.json({ ok: true, retired: true });
});

router.post('/trackers/:id/options/reorder', (req, res) => {
  const order = (req.body && req.body.order) || [];
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of ids' });
  const upd = db.prepare('UPDATE tracker_options SET display_order = ? WHERE id = ?');
  db.transaction(() => order.forEach((oid, i) => upd.run(i, Number(oid))))();
  res.json({ ok: true });
});

module.exports = router;
