'use strict';

// Library: provider contacts, visit notes, tips and recipes.
const express = require('express');
const { db } = require('../db');

const router = express.Router();

const CATEGORIES = ['provider', 'visit', 'tip', 'recipe', 'other'];

function clean(b, existing = {}) {
  const pick = (k, def = null) => (b[k] !== undefined ? (b[k] === '' ? null : b[k]) : (existing[k] ?? def));
  return {
    category: CATEGORIES.includes(b.category) ? b.category : (existing.category || 'tip'),
    title: b.title !== undefined ? String(b.title).trim() : existing.title,
    body: pick('body'),
    link: pick('link'),
    contact: pick('contact'),
    address: pick('address'),
    image_url: pick('image_url'),
    entry_date: pick('entry_date'),
    provider: pick('provider'),
    pinned: b.pinned !== undefined ? (b.pinned ? 1 : 0) : (existing.pinned ?? 0),
  };
}

// GET /api/library?category=
router.get('/library', (req, res) => {
  const cat = req.query.category;
  const rows = CATEGORIES.includes(cat)
    ? db.prepare('SELECT * FROM library_entries WHERE category = ? ORDER BY pinned DESC, COALESCE(entry_date, created_at) DESC, id DESC').all(cat)
    : db.prepare('SELECT * FROM library_entries ORDER BY pinned DESC, COALESCE(entry_date, created_at) DESC, id DESC').all();
  res.json(rows);
});

router.post('/library', (req, res) => {
  const b = req.body || {};
  if (!b.title || !String(b.title).trim()) return res.status(400).json({ error: 'title is required' });
  const v = clean(b);
  const info = db.prepare(
    `INSERT INTO library_entries (category, title, body, link, contact, address, image_url, entry_date, provider, pinned)
     VALUES (@category, @title, @body, @link, @contact, @address, @image_url, @entry_date, @provider, @pinned)`
  ).run(v);
  res.status(201).json(db.prepare('SELECT * FROM library_entries WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/library/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM library_entries WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const v = clean(req.body || {}, existing);
  db.prepare(
    `UPDATE library_entries SET category=@category, title=@title, body=@body, link=@link, contact=@contact,
       address=@address, image_url=@image_url, entry_date=@entry_date, provider=@provider, pinned=@pinned,
       updated_at=datetime('now') WHERE id=@id`
  ).run({ ...v, id });
  res.json(db.prepare('SELECT * FROM library_entries WHERE id = ?').get(id));
});

router.delete('/library/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM library_entries WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM library_entries WHERE id = ?').run(id);
  res.json({ ok: true, deleted: true });
});

module.exports = router;
