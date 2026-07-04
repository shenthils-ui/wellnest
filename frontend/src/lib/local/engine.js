// On-device API engine: runs the whole WellNest "backend" in the browser using
// sql.js (SQLite-WASM) + the better-sqlite3 shim. handle(method, path, body)
// mirrors the Express API so the rest of the app is unchanged in standalone mode.
import initSqlJs from 'sql.js';
import { wrap } from './sqldb.js';
import { SCHEMA, METRICS, ACTIVITIES, THERAPIES, TRACKERS } from './schema.js';
import {
  STATUSES, isValidDate, todayStr, isExpectedOn, dateRange, addDays, clampInt,
} from './helpers.js';

let db = null; // wrapped shim

/* ------------------------------- init/seed ---------------------------- */
export async function initEngine({ wasmUrl, dbBytes } = {}) {
  const SQL = await initSqlJs(wasmUrl ? { locateFile: () => wasmUrl } : undefined);
  const raw = dbBytes ? new SQL.Database(new Uint8Array(dbBytes)) : new SQL.Database();
  db = wrap(raw);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  seedIfEmpty();
  return { handle, exportBytes: () => raw.export() };
}

function seedIfEmpty() {
  const tx = db.transaction(() => {
    if (db.prepare('SELECT COUNT(*) c FROM metrics').get().c === 0) {
      const ins = db.prepare(`INSERT INTO metrics (key,name,good_direction,min_value,max_value,time_hint,display_order,active) VALUES (@key,@name,@good_direction,1,10,@time_hint,@display_order,1)`);
      METRICS.forEach((m, i) => ins.run({ ...m, display_order: i }));
    }
    if (db.prepare('SELECT COUNT(*) c FROM activities').get().c === 0) {
      const ins = db.prepare(`INSERT INTO activities (name,time_block,is_husband_task,expected_days,display_order,active) VALUES (@name,@time_block,@is_husband_task,@expected_days,@display_order,1)`);
      ACTIVITIES.forEach(([name, time_block, is_husband_task, expected_days], i) => ins.run({ name, time_block, is_husband_task, expected_days, display_order: i }));
    }
    if (db.prepare('SELECT COUNT(*) c FROM therapies').get().c === 0) {
      const ins = db.prepare(`INSERT INTO therapies (name,cadence_days,display_order,active) VALUES (@name,@cadence_days,@display_order,1)`);
      THERAPIES.forEach(([name, cadence_days], i) => ins.run({ name, cadence_days, display_order: i }));
    }
    if (db.prepare('SELECT COUNT(*) c FROM trackers').get().c === 0) {
      const insTr = db.prepare(`INSERT INTO trackers (name,kind,section,has_intensity,icon,hint,display_order,active) VALUES (@name,@kind,@section,@has_intensity,@icon,@hint,@display_order,1)`);
      const insOpt = db.prepare('INSERT INTO tracker_options (tracker_id,label,emoji,display_order,active) VALUES (?,?,?,?,1)');
      TRACKERS.forEach((t, i) => {
        const info = insTr.run({ name: t.name, kind: t.kind || 'multi', section: t.section || 'food', has_intensity: t.has_intensity ? 1 : 0, icon: t.icon || null, hint: t.hint || null, display_order: i });
        (t.options || []).forEach((opt, j) => {
          const [label, emoji] = Array.isArray(opt) ? opt : [opt, null];
          insOpt.run(info.lastInsertRowid, label, emoji, j);
        });
      });
    }
    if (db.prepare('SELECT COUNT(*) c FROM library_entries').get().c === 0) {
      const insL = db.prepare(`INSERT INTO library_entries (category,title,provider,pinned,display_order) VALUES ('provider',?,?,1,?)`);
      ['Doctor', 'NAET', 'Hyperbaric', 'Osteopath'].forEach((n, i) => insL.run(n, n, i));
    }
  });
  tx();
}

/* ----------------------------- responses ------------------------------ */
const ok = (body) => ({ status: 200, body });
const created = (body) => ({ status: 201, body });
const bad = (error) => ({ status: 400, body: { error } });
const notFound = (error = 'not found') => ({ status: 404, body: { error } });
const boolInt = (v) => (v ? 1 : 0);

function normalizeExpectedDays(v) {
  if (v === null || v === undefined || v === '') return null;
  const arr = (Array.isArray(v) ? v : String(v).split(',')).map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return arr.length ? arr.join(',') : null;
}

/* --------------------- insights shared query helpers ------------------ */
function getRange(q, defaultDays = 30) {
  const to = isValidDate(q.get('to')) ? q.get('to') : todayStr();
  const from = isValidDate(q.get('from')) ? q.get('from') : addDays(to, -(defaultDays - 1));
  return { from, to };
}
function loadLogMap(from, to) {
  const m = new Map();
  db.prepare('SELECT activity_id,date,status FROM activity_logs WHERE date BETWEEN ? AND ?').all(from, to)
    .forEach((r) => m.set(`${r.activity_id}|${r.date}`, r.status));
  return m;
}
function loadSymptomMap(from, to) {
  const m = new Map();
  db.prepare('SELECT metric_id,date,AVG(value) v FROM symptom_entries WHERE date BETWEEN ? AND ? GROUP BY metric_id,date').all(from, to)
    .forEach((r) => m.set(`${r.metric_id}|${r.date}`, r.v));
  return m;
}

/* ------------------------------- router ------------------------------- */
export function handle(method, fullPath, body = {}) {
  const url = new URL('http://x' + fullPath);
  const p = url.pathname;
  const q = url.searchParams;
  const seg = p.split('/').filter(Boolean); // e.g. ['api','activities','3']

  try {
    // --- misc ---
    if (p === '/api/health') return ok({ ok: true, app: 'WellNest', today: todayStr(), time: new Date().toISOString(), local: true });
    if (p === '/api/stats') return ok(statsRoute());

    // --- catalog ---
    if (seg[1] === 'activities') return activitiesRoute(method, seg, q, body);
    if (seg[1] === 'metrics') return metricsRoute(method, seg, q, body);
    if (seg[1] === 'therapies') return therapiesRoute(method, seg, q, body);
    if (seg[1] === 'trackers') return trackersRoute(method, seg, q, body);

    // --- day + per-day writes ---
    if (seg[1] === 'day' && seg[2]) return dayRoute(seg[2]);
    if (p === '/api/logs' && method === 'PUT') return logsRoute(body);
    if (p === '/api/symptoms') return symptomsRoute(method, body);
    if (p === '/api/day-meta' && method === 'PUT') return dayMetaRoute(body);
    if (p === '/api/therapy-logs') return therapyLogsRoute(method, q, body);
    if (p === '/api/therapy-note' && method === 'PUT') return therapyNoteRoute(body);
    if (p === '/api/period-day' && method === 'PUT') return periodDayRoute(body);
    if (p === '/api/tracker-log' && method === 'PUT') return trackerLogRoute(body);

    // --- cycle ---
    if (p === '/api/cycle') return ok(cycleRoute());

    // --- library ---
    if (seg[1] === 'library') return libraryRoute(method, seg, q, body);

    // --- insights ---
    if (seg[1] === 'insights') return insightsRoute(seg, q);

    // --- backup ---
    if (p === '/api/export/json') return ok(dumpAll());
    if (p === '/api/import' && method === 'POST') return importRoute(body);

    return notFound('Unknown API endpoint');
  } catch (e) {
    return { status: 500, body: { error: e.message } };
  }
}

/* ------------------------------ stats --------------------------------- */
function statsRoute() {
  const c = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  return { activities: c('activities'), metrics: c('metrics'), therapies: c('therapies'), activity_logs: c('activity_logs'), symptom_entries: c('symptom_entries'), dbPath: '(on device)' };
}

/* ---------------------------- ACTIVITIES ------------------------------ */
function activitiesRoute(method, seg, q, b) {
  if (method === 'GET' && seg.length === 2) {
    const inc = q.get('includeInactive') === '1' || q.get('all') === '1';
    return ok(db.prepare(`SELECT * FROM activities ${inc ? '' : 'WHERE active = 1'} ORDER BY display_order ASC, id ASC`).all());
  }
  if (method === 'POST' && seg[2] === 'reorder') {
    const order = b.order || [];
    const upd = db.prepare("UPDATE activities SET display_order = ?, updated_at = datetime('now') WHERE id = ?");
    db.transaction(() => order.forEach((id, i) => upd.run(i, Number(id))))();
    return ok({ ok: true });
  }
  if (method === 'POST' && seg.length === 2) {
    if (!b.name || !String(b.name).trim()) return bad('name is required');
    const time_block = b.time_block || 'MID_MORNING';
    const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order),-1) m FROM activities WHERE time_block = ?').get(time_block).m;
    const info = db.prepare(`INSERT INTO activities (name,time_block,is_husband_task,expected_days,display_order,active,reminder_enabled,reminder_time) VALUES (@name,@time_block,@is_husband_task,@expected_days,@display_order,1,@reminder_enabled,@reminder_time)`).run({
      name: String(b.name).trim(), time_block, is_husband_task: boolInt(b.is_husband_task),
      expected_days: normalizeExpectedDays(b.expected_days), display_order: maxOrder + 1,
      reminder_enabled: boolInt(b.reminder_enabled), reminder_time: b.reminder_time || null,
    });
    return created(db.prepare('SELECT * FROM activities WHERE id = ?').get(info.lastInsertRowid));
  }
  const id = Number(seg[2]);
  if (method === 'PUT') {
    const ex = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
    if (!ex) return notFound();
    const n = {
      name: b.name !== undefined ? String(b.name).trim() : ex.name,
      time_block: b.time_block !== undefined ? b.time_block : ex.time_block,
      is_husband_task: b.is_husband_task !== undefined ? boolInt(b.is_husband_task) : ex.is_husband_task,
      expected_days: b.expected_days !== undefined ? normalizeExpectedDays(b.expected_days) : ex.expected_days,
      display_order: b.display_order !== undefined ? Number(b.display_order) : ex.display_order,
      active: b.active !== undefined ? boolInt(b.active) : ex.active,
      reminder_enabled: b.reminder_enabled !== undefined ? boolInt(b.reminder_enabled) : ex.reminder_enabled,
      reminder_time: b.reminder_time !== undefined ? (b.reminder_time || null) : ex.reminder_time, id,
    };
    db.prepare(`UPDATE activities SET name=@name,time_block=@time_block,is_husband_task=@is_husband_task,expected_days=@expected_days,display_order=@display_order,active=@active,reminder_enabled=@reminder_enabled,reminder_time=@reminder_time,updated_at=datetime('now') WHERE id=@id`).run(n);
    return ok(db.prepare('SELECT * FROM activities WHERE id = ?').get(id));
  }
  if (method === 'DELETE') {
    const ex = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
    if (!ex) return notFound();
    if (q.get('hard') === '1') { db.prepare('DELETE FROM activities WHERE id = ?').run(id); return ok({ ok: true, deleted: true }); }
    db.prepare("UPDATE activities SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    return ok(db.prepare('SELECT * FROM activities WHERE id = ?').get(id));
  }
  return notFound();
}

/* ------------------------------ METRICS ------------------------------- */
function metricsRoute(method, seg, q, b) {
  if (method === 'GET' && seg.length === 2) {
    const inc = q.get('includeInactive') === '1' || q.get('all') === '1';
    return ok(db.prepare(`SELECT * FROM metrics ${inc ? '' : 'WHERE active = 1'} ORDER BY display_order ASC, id ASC`).all());
  }
  if (method === 'POST' && seg[2] === 'reorder') {
    const order = b.order || [];
    const upd = db.prepare('UPDATE metrics SET display_order = ? WHERE id = ?');
    db.transaction(() => order.forEach((id, i) => upd.run(i, Number(id))))();
    return ok({ ok: true });
  }
  if (method === 'POST' && seg.length === 2) {
    if (!b.name || !String(b.name).trim()) return bad('name is required');
    const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order),-1) m FROM metrics').get().m;
    const info = db.prepare(`INSERT INTO metrics (key,name,good_direction,min_value,max_value,time_hint,display_order,active) VALUES (@key,@name,@good_direction,@min_value,@max_value,@time_hint,@display_order,1)`).run({
      key: b.key ? String(b.key).trim() : `custom_${Date.now()}`, name: String(b.name).trim(),
      good_direction: b.good_direction === 'low' ? 'low' : 'high',
      min_value: Number.isInteger(b.min_value) ? b.min_value : 1, max_value: Number.isInteger(b.max_value) ? b.max_value : 10,
      time_hint: b.time_hint || 'anytime', display_order: maxOrder + 1,
    });
    return created(db.prepare('SELECT * FROM metrics WHERE id = ?').get(info.lastInsertRowid));
  }
  const id = Number(seg[2]);
  if (method === 'PUT') {
    const ex = db.prepare('SELECT * FROM metrics WHERE id = ?').get(id);
    if (!ex) return notFound();
    const n = {
      name: b.name !== undefined ? String(b.name).trim() : ex.name,
      good_direction: b.good_direction !== undefined ? (b.good_direction === 'low' ? 'low' : 'high') : ex.good_direction,
      min_value: b.min_value !== undefined ? Number(b.min_value) : ex.min_value,
      max_value: b.max_value !== undefined ? Number(b.max_value) : ex.max_value,
      time_hint: b.time_hint !== undefined ? b.time_hint : ex.time_hint,
      display_order: b.display_order !== undefined ? Number(b.display_order) : ex.display_order,
      active: b.active !== undefined ? boolInt(b.active) : ex.active, id,
    };
    db.prepare(`UPDATE metrics SET name=@name,good_direction=@good_direction,min_value=@min_value,max_value=@max_value,time_hint=@time_hint,display_order=@display_order,active=@active WHERE id=@id`).run(n);
    return ok(db.prepare('SELECT * FROM metrics WHERE id = ?').get(id));
  }
  if (method === 'DELETE') {
    const ex = db.prepare('SELECT * FROM metrics WHERE id = ?').get(id);
    if (!ex) return notFound();
    if (q.get('hard') === '1') { db.prepare('DELETE FROM metrics WHERE id = ?').run(id); return ok({ ok: true, deleted: true }); }
    db.prepare('UPDATE metrics SET active = 0 WHERE id = ?').run(id);
    return ok(db.prepare('SELECT * FROM metrics WHERE id = ?').get(id));
  }
  return notFound();
}

/* ----------------------------- THERAPIES ------------------------------ */
function therapiesRoute(method, seg, q, b) {
  if (method === 'GET' && seg.length === 2) {
    const inc = q.get('includeInactive') === '1' || q.get('all') === '1';
    return ok(db.prepare(`SELECT * FROM therapies ${inc ? '' : 'WHERE active = 1'} ORDER BY display_order ASC, id ASC`).all());
  }
  if (method === 'POST' && seg.length === 2) {
    if (!b.name || !String(b.name).trim()) return bad('name is required');
    const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order),-1) m FROM therapies').get().m;
    const info = db.prepare('INSERT INTO therapies (name,cadence_days,display_order,active) VALUES (@name,@cadence_days,@display_order,1)').run({
      name: String(b.name).trim(), cadence_days: Number.isInteger(b.cadence_days) ? b.cadence_days : 7, display_order: maxOrder + 1,
    });
    return created(db.prepare('SELECT * FROM therapies WHERE id = ?').get(info.lastInsertRowid));
  }
  const id = Number(seg[2]);
  if (method === 'PUT') {
    const ex = db.prepare('SELECT * FROM therapies WHERE id = ?').get(id);
    if (!ex) return notFound();
    const n = {
      name: b.name !== undefined ? String(b.name).trim() : ex.name,
      cadence_days: b.cadence_days !== undefined ? Number(b.cadence_days) : ex.cadence_days,
      display_order: b.display_order !== undefined ? Number(b.display_order) : ex.display_order,
      active: b.active !== undefined ? boolInt(b.active) : ex.active, id,
    };
    db.prepare('UPDATE therapies SET name=@name,cadence_days=@cadence_days,display_order=@display_order,active=@active WHERE id=@id').run(n);
    return ok(db.prepare('SELECT * FROM therapies WHERE id = ?').get(id));
  }
  if (method === 'DELETE') {
    const ex = db.prepare('SELECT * FROM therapies WHERE id = ?').get(id);
    if (!ex) return notFound();
    if (q.get('hard') === '1') { db.prepare('DELETE FROM therapies WHERE id = ?').run(id); return ok({ ok: true, deleted: true }); }
    db.prepare('UPDATE therapies SET active = 0 WHERE id = ?').run(id);
    return ok(db.prepare('SELECT * FROM therapies WHERE id = ?').get(id));
  }
  return notFound();
}

/* ------------------------------ TRACKERS ------------------------------ */
function trackerWithOptions(t) {
  return { ...t, options: db.prepare('SELECT * FROM tracker_options WHERE tracker_id = ? AND active = 1 ORDER BY display_order, id').all(t.id) };
}
function trackersRoute(method, seg, q, b) {
  const KINDS = ['multi', 'single']; const SECTIONS = ['food', 'feeling'];
  if (method === 'GET' && seg.length === 2) {
    const inc = q.get('includeInactive') === '1' || q.get('all') === '1';
    const trackers = db.prepare(`SELECT * FROM trackers ${inc ? '' : 'WHERE active = 1'} ORDER BY display_order, id`).all();
    return ok(trackers.map((t) => ({ ...t, options: db.prepare(`SELECT * FROM tracker_options WHERE tracker_id = ? ${inc ? '' : 'AND active = 1'} ORDER BY display_order, id`).all(t.id) })));
  }
  if (method === 'POST' && seg[2] === 'reorder') {
    const order = b.order || []; const upd = db.prepare('UPDATE trackers SET display_order = ? WHERE id = ?');
    db.transaction(() => order.forEach((tid, i) => upd.run(i, Number(tid))))();
    return ok({ ok: true });
  }
  if (method === 'POST' && seg.length === 2) {
    if (!b.name || !String(b.name).trim()) return bad('name is required');
    const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order),-1) m FROM trackers').get().m;
    const info = db.prepare(`INSERT INTO trackers (name,kind,section,has_intensity,icon,hint,display_order,active) VALUES (@name,@kind,@section,@has_intensity,@icon,@hint,@display_order,1)`).run({
      name: String(b.name).trim(), kind: KINDS.includes(b.kind) ? b.kind : 'multi', section: SECTIONS.includes(b.section) ? b.section : 'food',
      has_intensity: b.has_intensity ? 1 : 0, icon: b.icon || null, hint: b.hint || null, display_order: maxOrder + 1,
    });
    const tracker = db.prepare('SELECT * FROM trackers WHERE id = ?').get(info.lastInsertRowid);
    if (Array.isArray(b.options)) {
      const insOpt = db.prepare('INSERT INTO tracker_options (tracker_id,label,emoji,display_order,active) VALUES (?,?,?,?,1)');
      b.options.forEach((o, i) => { const label = typeof o === 'string' ? o : o.label; if (label && label.trim()) insOpt.run(tracker.id, label.trim(), (o && o.emoji) || null, i); });
    }
    return created(trackerWithOptions(tracker));
  }
  const id = Number(seg[2]);
  // options sub-routes
  if (seg[3] === 'options') {
    if (method === 'POST' && seg[4] === 'reorder') {
      const order = b.order || []; const upd = db.prepare('UPDATE tracker_options SET display_order = ? WHERE id = ?');
      db.transaction(() => order.forEach((oid, i) => upd.run(i, Number(oid))))();
      return ok({ ok: true });
    }
    if (method === 'POST') {
      if (!db.prepare('SELECT id FROM trackers WHERE id = ?').get(id)) return notFound('tracker not found');
      if (!b.label || !String(b.label).trim()) return bad('label is required');
      const dupe = db.prepare('SELECT * FROM tracker_options WHERE tracker_id = ? AND label = ? COLLATE NOCASE').get(id, String(b.label).trim());
      if (dupe) { db.prepare('UPDATE tracker_options SET active = 1 WHERE id = ?').run(dupe.id); return ok(db.prepare('SELECT * FROM tracker_options WHERE id = ?').get(dupe.id)); }
      const mx = db.prepare('SELECT COALESCE(MAX(display_order),-1) m FROM tracker_options WHERE tracker_id = ?').get(id).m;
      const info = db.prepare('INSERT INTO tracker_options (tracker_id,label,emoji,display_order,active) VALUES (?,?,?,?,1)').run(id, String(b.label).trim(), b.emoji || null, mx + 1);
      return created(db.prepare('SELECT * FROM tracker_options WHERE id = ?').get(info.lastInsertRowid));
    }
    const oid = Number(seg[4]);
    if (method === 'PUT') {
      const ex = db.prepare('SELECT * FROM tracker_options WHERE id = ?').get(oid);
      if (!ex) return notFound();
      const n = { label: b.label !== undefined ? String(b.label).trim() : ex.label, emoji: b.emoji !== undefined ? (b.emoji || null) : ex.emoji, display_order: b.display_order !== undefined ? Number(b.display_order) : ex.display_order, active: b.active !== undefined ? boolInt(b.active) : ex.active, id: oid };
      db.prepare('UPDATE tracker_options SET label=@label,emoji=@emoji,display_order=@display_order,active=@active WHERE id=@id').run(n);
      return ok(db.prepare('SELECT * FROM tracker_options WHERE id = ?').get(oid));
    }
    if (method === 'DELETE') {
      const ex = db.prepare('SELECT * FROM tracker_options WHERE id = ?').get(oid);
      if (!ex) return notFound();
      if (q.get('hard') === '1') { db.prepare('DELETE FROM tracker_options WHERE id = ?').run(oid); return ok({ ok: true, deleted: true }); }
      db.prepare('UPDATE tracker_options SET active = 0 WHERE id = ?').run(oid);
      return ok({ ok: true, retired: true });
    }
  }
  if (method === 'PUT') {
    const ex = db.prepare('SELECT * FROM trackers WHERE id = ?').get(id);
    if (!ex) return notFound();
    const n = {
      name: b.name !== undefined ? String(b.name).trim() : ex.name,
      kind: b.kind !== undefined && KINDS.includes(b.kind) ? b.kind : ex.kind,
      section: b.section !== undefined && SECTIONS.includes(b.section) ? b.section : ex.section,
      has_intensity: b.has_intensity !== undefined ? (b.has_intensity ? 1 : 0) : ex.has_intensity,
      icon: b.icon !== undefined ? (b.icon || null) : ex.icon, hint: b.hint !== undefined ? (b.hint || null) : ex.hint,
      display_order: b.display_order !== undefined ? Number(b.display_order) : ex.display_order,
      active: b.active !== undefined ? (b.active ? 1 : 0) : ex.active, id,
    };
    db.prepare(`UPDATE trackers SET name=@name,kind=@kind,section=@section,has_intensity=@has_intensity,icon=@icon,hint=@hint,display_order=@display_order,active=@active WHERE id=@id`).run(n);
    return ok(trackerWithOptions(db.prepare('SELECT * FROM trackers WHERE id = ?').get(id)));
  }
  if (method === 'DELETE') {
    const ex = db.prepare('SELECT * FROM trackers WHERE id = ?').get(id);
    if (!ex) return notFound();
    if (q.get('hard') === '1') { db.prepare('DELETE FROM trackers WHERE id = ?').run(id); return ok({ ok: true, deleted: true }); }
    db.prepare('UPDATE trackers SET active = 0 WHERE id = ?').run(id);
    return ok({ ok: true, retired: true });
  }
  return notFound();
}

/* -------------------------------- DAY --------------------------------- */
function dayRoute(date) {
  if (!isValidDate(date)) return bad('invalid date');
  const logMap = {};
  db.prepare('SELECT activity_id,status FROM activity_logs WHERE date = ?').all(date).forEach((r) => { logMap[r.activity_id] = r.status; });
  const sym = db.prepare(`SELECT metric_id, ROUND(AVG(value),1) AS avg, COUNT(*) AS count, MAX(value) AS max, MIN(value) AS min FROM symptom_entries WHERE date = ? GROUP BY metric_id`).all(date);
  const last = db.prepare(`SELECT s.metric_id, s.value FROM symptom_entries s JOIN (SELECT metric_id, MAX(id) mid FROM symptom_entries WHERE date = ? GROUP BY metric_id) t ON s.id = t.mid`).all(date);
  const lastMap = {}; last.forEach((r) => { lastMap[r.metric_id] = r.value; });
  const symMap = {}; sym.forEach((r) => { symMap[r.metric_id] = { avg: r.avg, count: r.count, value: lastMap[r.metric_id], min: r.min, max: r.max }; });
  const meta = db.prepare('SELECT notes, cycle_day FROM daily_notes WHERE date = ?').get(date) || { notes: null, cycle_day: null };
  const therapyRows = db.prepare('SELECT therapy_id, note FROM therapy_logs WHERE date = ?').all(date);
  const therapyNotes = {}; therapyRows.forEach((r) => { if (r.note) therapyNotes[r.therapy_id] = r.note; });
  const periodRow = db.prepare('SELECT flow FROM period_days WHERE date = ?').get(date);
  const trackers = {};
  db.prepare('SELECT tracker_id, option_id, intensity FROM tracker_logs WHERE date = ?').all(date).forEach((r) => { (trackers[r.tracker_id] || (trackers[r.tracker_id] = {}))[r.option_id] = { intensity: r.intensity }; });
  return ok({ date, logs: logMap, symptoms: symMap, notes: meta.notes ?? null, cycle_day: meta.cycle_day ?? null, therapies: therapyRows.map((r) => r.therapy_id), therapyNotes, period: periodRow ? (periodRow.flow || 'medium') : null, trackers });
}

function logsRoute(b) {
  const activity_id = Number(b.activity_id); const date = b.date; let status = b.status;
  if (!activity_id || !isValidDate(date)) return bad('activity_id and valid date required');
  if (status === '' || status === 'UNSET' || status == null) { db.prepare('DELETE FROM activity_logs WHERE activity_id = ? AND date = ?').run(activity_id, date); return ok({ ok: true, activity_id, date, status: null }); }
  status = String(status).toUpperCase();
  if (!STATUSES.includes(status)) return bad('invalid status');
  db.prepare(`INSERT INTO activity_logs (activity_id,date,status,updated_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(activity_id,date) DO UPDATE SET status=excluded.status, updated_at=datetime('now')`).run(activity_id, date, status);
  return ok({ ok: true, activity_id, date, status });
}

function symptomsRoute(method, b) {
  const metric_id = Number(b.metric_id); const date = b.date;
  if (!metric_id || !isValidDate(date)) return bad('metric_id and valid date required');
  const metric = db.prepare('SELECT * FROM metrics WHERE id = ?').get(metric_id);
  if (!metric) return notFound('unknown metric');
  if (method === 'PUT') {
    if (b.value === null || b.value === '' || b.value === undefined) { db.prepare('DELETE FROM symptom_entries WHERE metric_id = ? AND date = ?').run(metric_id, date); return ok({ ok: true, cleared: true, metric_id, date }); }
    const value = clampInt(b.value, metric.min_value, metric.max_value);
    if (value === null) return bad('invalid value');
    db.transaction(() => { db.prepare('DELETE FROM symptom_entries WHERE metric_id = ? AND date = ?').run(metric_id, date); db.prepare('INSERT INTO symptom_entries (metric_id,date,value) VALUES (?,?,?)').run(metric_id, date, value); })();
    return ok({ ok: true, metric_id, date, value, avg: value, count: 1 });
  }
  if (method === 'POST') {
    const value = clampInt(b.value, metric.min_value, metric.max_value);
    if (value === null) return bad('invalid value');
    db.prepare('INSERT INTO symptom_entries (metric_id,date,value) VALUES (?,?,?)').run(metric_id, date, value);
    const agg = db.prepare('SELECT ROUND(AVG(value),1) avg, COUNT(*) count FROM symptom_entries WHERE metric_id = ? AND date = ?').get(metric_id, date);
    return ok({ ok: true, metric_id, date, value, avg: agg.avg, count: agg.count });
  }
  if (method === 'DELETE') { db.prepare('DELETE FROM symptom_entries WHERE metric_id = ? AND date = ?').run(metric_id, date); return ok({ ok: true, cleared: true }); }
  return notFound();
}

function dayMetaRoute(b) {
  const date = b.date; if (!isValidDate(date)) return bad('valid date required');
  const notes = b.notes !== undefined ? (b.notes === '' ? null : String(b.notes)) : null;
  let cycle_day = null;
  if (b.cycle_day !== undefined && b.cycle_day !== null && b.cycle_day !== '') cycle_day = clampInt(b.cycle_day, 1, 60);
  db.prepare(`INSERT INTO daily_notes (date,notes,cycle_day,updated_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(date) DO UPDATE SET notes=excluded.notes, cycle_day=excluded.cycle_day, updated_at=datetime('now')`).run(date, notes, cycle_day);
  return ok({ ok: true, date, notes, cycle_day });
}

function therapyLogsRoute(method, q, b) {
  if (method === 'GET') {
    const from = isValidDate(q.get('from')) ? q.get('from') : '0000-01-01';
    const to = isValidDate(q.get('to')) ? q.get('to') : '9999-12-31';
    return ok(db.prepare('SELECT therapy_id,date FROM therapy_logs WHERE date BETWEEN ? AND ? ORDER BY date').all(from, to));
  }
  const therapy_id = Number(b.therapy_id); const date = b.date;
  if (!therapy_id || !isValidDate(date)) return bad('therapy_id and valid date required');
  if (method === 'POST') { db.prepare('INSERT INTO therapy_logs (therapy_id,date) VALUES (?,?) ON CONFLICT(therapy_id,date) DO NOTHING').run(therapy_id, date); return ok({ ok: true, therapy_id, date, done: true }); }
  if (method === 'DELETE') { db.prepare('DELETE FROM therapy_logs WHERE therapy_id = ? AND date = ?').run(therapy_id, date); return ok({ ok: true, therapy_id, date, done: false }); }
  return notFound();
}

function therapyNoteRoute(b) {
  const therapy_id = Number(b.therapy_id); const date = b.date;
  if (!therapy_id || !isValidDate(date)) return bad('therapy_id and valid date required');
  const note = b.note === '' || b.note == null ? null : String(b.note);
  db.prepare(`INSERT INTO therapy_logs (therapy_id,date,note) VALUES (?,?,?) ON CONFLICT(therapy_id,date) DO UPDATE SET note=excluded.note`).run(therapy_id, date, note);
  return ok({ ok: true, therapy_id, date, note });
}

function periodDayRoute(b) {
  const date = b.date; if (!isValidDate(date)) return bad('valid date required');
  const flows = ['spotting', 'light', 'medium', 'heavy'];
  if (b.flow == null || b.flow === '') { db.prepare('DELETE FROM period_days WHERE date = ?').run(date); return ok({ ok: true, date, flow: null }); }
  const flow = flows.includes(b.flow) ? b.flow : 'medium';
  db.prepare('INSERT INTO period_days (date,flow) VALUES (?,?) ON CONFLICT(date) DO UPDATE SET flow=excluded.flow').run(date, flow);
  return ok({ ok: true, date, flow });
}

function trackerLogRoute(b) {
  const tracker_id = Number(b.tracker_id); const option_id = Number(b.option_id); const date = b.date;
  if (!tracker_id || !option_id || !isValidDate(date)) return bad('tracker_id, option_id and valid date required');
  const intensity = b.intensity == null || b.intensity === '' ? null : clampInt(b.intensity, 1, 3);
  db.transaction(() => {
    if (b.selected === false) { db.prepare('DELETE FROM tracker_logs WHERE tracker_id = ? AND option_id = ? AND date = ?').run(tracker_id, option_id, date); return; }
    if (b.single) db.prepare('DELETE FROM tracker_logs WHERE tracker_id = ? AND date = ?').run(tracker_id, date);
    db.prepare(`INSERT INTO tracker_logs (tracker_id,option_id,date,intensity) VALUES (?,?,?,?) ON CONFLICT(tracker_id,option_id,date) DO UPDATE SET intensity=excluded.intensity`).run(tracker_id, option_id, date, intensity);
  })();
  return ok({ ok: true, tracker_id, option_id, date, selected: b.selected !== false, intensity });
}

/* ------------------------------ LIBRARY ------------------------------- */
function libraryRoute(method, seg, q, b) {
  const CATS = ['provider', 'visit', 'tip', 'recipe', 'other'];
  const clean = (bd, ex = {}) => {
    const pick = (k) => (bd[k] !== undefined ? (bd[k] === '' ? null : bd[k]) : (ex[k] ?? null));
    return { category: CATS.includes(bd.category) ? bd.category : (ex.category || 'tip'), title: bd.title !== undefined ? String(bd.title).trim() : ex.title, body: pick('body'), link: pick('link'), contact: pick('contact'), address: pick('address'), image_url: pick('image_url'), entry_date: pick('entry_date'), provider: pick('provider'), pinned: bd.pinned !== undefined ? (bd.pinned ? 1 : 0) : (ex.pinned ?? 0) };
  };
  if (method === 'GET') {
    const cat = q.get('category');
    const rows = CATS.includes(cat)
      ? db.prepare('SELECT * FROM library_entries WHERE category = ? ORDER BY pinned DESC, COALESCE(entry_date, created_at) DESC, id DESC').all(cat)
      : db.prepare('SELECT * FROM library_entries ORDER BY pinned DESC, COALESCE(entry_date, created_at) DESC, id DESC').all();
    return ok(rows);
  }
  if (method === 'POST') {
    if (!b.title || !String(b.title).trim()) return bad('title is required');
    const v = clean(b);
    const info = db.prepare(`INSERT INTO library_entries (category,title,body,link,contact,address,image_url,entry_date,provider,pinned) VALUES (@category,@title,@body,@link,@contact,@address,@image_url,@entry_date,@provider,@pinned)`).run(v);
    return created(db.prepare('SELECT * FROM library_entries WHERE id = ?').get(info.lastInsertRowid));
  }
  const id = Number(seg[2]);
  if (method === 'PUT') {
    const ex = db.prepare('SELECT * FROM library_entries WHERE id = ?').get(id);
    if (!ex) return notFound();
    const v = clean(b, ex);
    db.prepare(`UPDATE library_entries SET category=@category,title=@title,body=@body,link=@link,contact=@contact,address=@address,image_url=@image_url,entry_date=@entry_date,provider=@provider,pinned=@pinned,updated_at=datetime('now') WHERE id=@id`).run({ ...v, id });
    return ok(db.prepare('SELECT * FROM library_entries WHERE id = ?').get(id));
  }
  if (method === 'DELETE') {
    if (!db.prepare('SELECT id FROM library_entries WHERE id = ?').get(id)) return notFound();
    db.prepare('DELETE FROM library_entries WHERE id = ?').run(id);
    return ok({ ok: true, deleted: true });
  }
  return notFound();
}

/* ------------------------------ CYCLE --------------------------------- */
function cycleRoute() {
  const rows = db.prepare('SELECT date, flow FROM period_days ORDER BY date').all();
  const dates = rows.map((r) => r.date); const today = todayStr(); const DEFAULT = 28;
  const between = (a, b2) => Math.round((new Date(b2 + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  if (dates.length === 0) return { enoughData: false, hasAnyData: false, avgCycle: DEFAULT, periodDays: [], starts: [], cycles: [] };
  const starts = []; const runs = []; let runStart = dates[0]; let prev = dates[0]; let runLen = 1;
  for (let i = 1; i < dates.length; i++) { if (between(prev, dates[i]) === 1) runLen += 1; else { starts.push(runStart); runs.push({ start: runStart, length: runLen }); runStart = dates[i]; runLen = 1; } prev = dates[i]; }
  starts.push(runStart); runs.push({ start: runStart, length: runLen });
  const cycles = []; for (let i = 1; i < starts.length; i++) cycles.push({ from: starts[i - 1], to: starts[i], length: between(starts[i - 1], starts[i]) });
  const recent = cycles.slice(-6);
  const avgCycle = recent.length ? Math.round(recent.reduce((s, c) => s + c.length, 0) / recent.length) : DEFAULT;
  const avgPeriodLen = Math.round(runs.reduce((s, r) => s + r.length, 0) / runs.length);
  const lastStart = starts[starts.length - 1];
  const currentDay = between(lastStart, today) + 1;
  const predictedNext = addDays(lastStart, avgCycle);
  const daysUntilNext = between(today, predictedNext);
  const predictedOvulation = addDays(predictedNext, -14);
  return { enoughData: cycles.length >= 1, hasAnyData: true, avgCycle, avgPeriodLen, periodDays: rows, starts, cycles: recent, lastStart, currentDay: currentDay >= 1 ? currentDay : null, predictedNext, daysUntilNext, predictedOvulation, fertileStart: addDays(predictedOvulation, -5), fertileEnd: addDays(predictedOvulation, 1), today };
}

/* ----------------------------- INSIGHTS ------------------------------- */
function insightsRoute(seg, q) {
  const sub = seg[2];
  if (sub === 'activities') return ok(insightActivities(q));
  if (sub === 'symptoms') return ok(insightSymptoms(q));
  if (sub === 'correlation' && seg[3] === 'scan') return ok(correlationScan(q));
  if (sub === 'correlation') return correlationRoute(q);
  if (sub === 'calendar') return ok(insightCalendar(q));
  if (sub === 'streaks') return ok(insightStreaks(q));
  if (sub === 'overview') return ok(insightOverview(q));
  if (sub === 'lookback') return ok(insightLookback(q));
  if (sub === 'tracker-summary') return ok(trackerSummary(q));
  return notFound();
}

function insightActivities(q) {
  const { from, to } = getRange(q, 30); const days = dateRange(from, to);
  const activities = db.prepare('SELECT * FROM activities ORDER BY display_order, id').all();
  const logMap = loadLogMap(from, to); const today = todayStr();
  const out = activities.map((a) => {
    let expected = 0, done = 0, tired = 0, forgot = 0, notScheduled = 0, unset = 0;
    for (const d of days) { if (d > today) continue; if (!isExpectedOn(a, d)) continue; expected += 1; const s = logMap.get(`${a.id}|${d}`); if (s === 'DONE') done += 1; else if (s === 'TIRED') tired += 1; else if (s === 'FORGOT') forgot += 1; else if (s === 'NOT_SCHEDULED') notScheduled += 1; else unset += 1; }
    const denom = Math.max(0, expected - notScheduled);
    return { id: a.id, name: a.name, time_block: a.time_block, is_husband_task: a.is_husband_task, active: a.active, expected: denom, done, tired, forgot, unset, notScheduled, skipped: tired + forgot, completionPct: denom > 0 ? Math.round((done / denom) * 100) : null };
  });
  return { from, to, activities: out };
}

function insightSymptoms(q) {
  const { from, to } = getRange(q, 30);
  const metrics = db.prepare('SELECT * FROM metrics ORDER BY display_order, id').all();
  const rows = db.prepare(`SELECT metric_id, date, ROUND(AVG(value),2) v, COUNT(*) c FROM symptom_entries WHERE date BETWEEN ? AND ? GROUP BY metric_id, date ORDER BY date`).all(from, to);
  const byMetric = new Map();
  rows.forEach((r) => { if (!byMetric.has(r.metric_id)) byMetric.set(r.metric_id, []); byMetric.get(r.metric_id).push({ date: r.date, value: r.v, count: r.c }); });
  const out = metrics.map((m) => {
    const series = byMetric.get(m.id) || []; const vals = series.map((s) => s.value);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { id: m.id, key: m.key, name: m.name, good_direction: m.good_direction, min_value: m.min_value, max_value: m.max_value, series, average: avg === null ? null : Math.round(avg * 10) / 10, daysLogged: series.length, min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null };
  });
  return { from, to, metrics: out };
}

function correlate(activity, metricId, from, to, logMap, symMap) {
  const days = dateRange(from, to); const doneVals = []; const notVals = [];
  for (const d of days) {
    const sym = symMap.get(`${metricId}|${d}`); if (sym === undefined) continue;
    if (!isExpectedOn(activity, d)) { notVals.push(sym); continue; }
    const s = logMap.get(`${activity.id}|${d}`); if (s === 'DONE') doneVals.push(sym); else notVals.push(sym);
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const doneAvg = mean(doneVals); const notDoneAvg = mean(notVals);
  return { doneAvg: doneAvg === null ? null : Math.round(doneAvg * 10) / 10, notDoneAvg: notDoneAvg === null ? null : Math.round(notDoneAvg * 10) / 10, doneCount: doneVals.length, notDoneCount: notVals.length, diff: doneAvg !== null && notDoneAvg !== null ? Math.round((doneAvg - notDoneAvg) * 10) / 10 : null };
}
function sentence(an, mn, gd, c) {
  if (c.diff === null) return null; const lower = c.doneAvg < c.notDoneAvg;
  const better = (gd === 'high' && c.doneAvg > c.notDoneAvg) || (gd === 'low' && c.doneAvg < c.notDoneAvg);
  return `${mn} averages ${c.doneAvg} on days “${an}” was done vs ${c.notDoneAvg} on other days (${lower ? 'lower' : 'higher'} by ${Math.abs(c.diff)}). ${better ? 'On these days the trend looks more favourable.' : 'On these days the trend looks less favourable.'}`;
}
function correlationRoute(q) {
  const { from, to } = getRange(q, 60);
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(Number(q.get('activity_id')));
  const metric = db.prepare('SELECT * FROM metrics WHERE id = ?').get(Number(q.get('metric_id')));
  if (!activity || !metric) return bad('activity_id and metric_id required');
  const c = correlate(activity, metric.id, from, to, loadLogMap(from, to), loadSymptomMap(from, to));
  return ok({ from, to, activity: { id: activity.id, name: activity.name }, metric: { id: metric.id, name: metric.name, good_direction: metric.good_direction }, ...c, note: sentence(activity.name, metric.name, metric.good_direction, c), disclaimer: 'Observational only — this shows averages, not cause and effect, and is not medical advice.' });
}
function correlationScan(q) {
  const { from, to } = getRange(q, 60); const minDays = Math.max(2, parseInt(q.get('minDays'), 10) || 4);
  const activities = db.prepare('SELECT * FROM activities WHERE active = 1').all(); const metrics = db.prepare('SELECT * FROM metrics WHERE active = 1').all();
  const logMap = loadLogMap(from, to); const symMap = loadSymptomMap(from, to); const findings = [];
  for (const a of activities) for (const m of metrics) { const c = correlate(a, m.id, from, to, logMap, symMap); if (c.doneCount >= minDays && c.notDoneCount >= minDays && c.diff !== null) findings.push({ activity: { id: a.id, name: a.name }, metric: { id: m.id, name: m.name, good_direction: m.good_direction }, ...c, absDiff: Math.abs(c.diff), note: sentence(a.name, m.name, m.good_direction, c) }); }
  findings.sort((x, y) => y.absDiff - x.absDiff);
  return { from, to, minDays, findings: findings.slice(0, 12) };
}

function insightCalendar(q) {
  const { from, to } = getRange(q, 42); const days = dateRange(from, to); const today = todayStr();
  const activities = db.prepare('SELECT * FROM activities').all(); const logMap = loadLogMap(from, to);
  const symByDate = {};
  db.prepare('SELECT date, metric_id, ROUND(AVG(value),1) v FROM symptom_entries WHERE date BETWEEN ? AND ? GROUP BY date, metric_id').all(from, to).forEach((r) => { (symByDate[r.date] || (symByDate[r.date] = {}))[r.metric_id] = r.v; });
  const logged = new Set(db.prepare(`SELECT date FROM activity_logs WHERE date BETWEEN ? AND ? UNION SELECT date FROM symptom_entries WHERE date BETWEEN ? AND ? UNION SELECT date FROM daily_notes WHERE date BETWEEN ? AND ?`).all(from, to, from, to, from, to).map((r) => r.date));
  const perDay = days.map((d) => {
    let expected = 0, done = 0;
    for (const a of activities) { if (!isExpectedOn(a, d)) continue; const s = logMap.get(`${a.id}|${d}`); if (s === 'NOT_SCHEDULED') continue; expected += 1; if (s === 'DONE') done += 1; }
    const pct = expected > 0 ? Math.round((done / expected) * 100) : null;
    return { date: d, completionPct: d > today ? null : pct, done, expected, logged: logged.has(d), metrics: symByDate[d] || {} };
  });
  return { from, to, perDay };
}

function insightStreaks(q) {
  const windowDays = Math.min(730, Math.max(30, parseInt(q.get('windowDays'), 10) || 365));
  const today = todayStr(); const start = addDays(today, -(windowDays - 1));
  const activities = db.prepare('SELECT * FROM activities ORDER BY display_order, id').all(); const logMap = loadLogMap(start, today);
  const first = db.prepare('SELECT MIN(date) d FROM activity_logs').get().d || start;
  const effStart = first > start ? first : start; const days = dateRange(effStart, today); const halfLife = 21;
  const out = activities.filter((a) => a.active === 1).map((a) => {
    const seq = [];
    for (const d of days) { if (!isExpectedOn(a, d)) continue; const s = logMap.get(`${a.id}|${d}`); if (s === 'NOT_SCHEDULED') continue; seq.push({ date: d, done: s === 'DONE', recorded: s !== undefined }); }
    let longest = 0, run = 0; for (const e of seq) { if (e.done) { run += 1; longest = Math.max(longest, run); } else run = 0; }
    let current = 0;
    for (let i = seq.length - 1; i >= 0; i--) { const e = seq[i]; if (i === seq.length - 1 && e.date === today && !e.done && !e.recorded) continue; if (e.done) current += 1; else break; }
    let wSum = 0, wDone = 0;
    for (const e of seq) { const ageDays = (new Date(today) - new Date(e.date)) / 86400000; const w = Math.pow(0.5, ageDays / halfLife); wSum += w; if (e.done) wDone += w; }
    return { id: a.id, name: a.name, time_block: a.time_block, is_husband_task: a.is_husband_task, currentStreak: current, longestStreak: longest, consistency: wSum > 0 ? Math.round((wDone / wSum) * 100) : null, expectedDays: seq.length };
  });
  return { windowDays, from: effStart, to: today, activities: out };
}

function insightOverview(q) {
  const { from, to } = getRange(q, 30); const days = dateRange(from, to); const today = todayStr();
  const activities = db.prepare('SELECT * FROM activities').all(); const logMap = loadLogMap(from, to);
  const loggedDates = new Set(db.prepare(`SELECT date FROM activity_logs WHERE date BETWEEN ? AND ? UNION SELECT date FROM symptom_entries WHERE date BETWEEN ? AND ? UNION SELECT date FROM daily_notes WHERE date BETWEEN ? AND ?`).all(from, to, from, to, from, to).map((r) => r.date));
  const perDay = [];
  for (const d of days) { if (d > today) continue; let expected = 0, done = 0, notScheduled = 0; for (const a of activities) { if (!isExpectedOn(a, d)) continue; expected += 1; const s = logMap.get(`${a.id}|${d}`); if (s === 'DONE') done += 1; else if (s === 'NOT_SCHEDULED') notScheduled += 1; } const denom = Math.max(0, expected - notScheduled); perDay.push({ date: d, completionPct: denom > 0 ? Math.round((done / denom) * 100) : null, done, expected: denom, logged: loggedDates.has(d) }); }
  const withPct = perDay.filter((p) => p.completionPct !== null && p.logged);
  const avgCompletion = withPct.length ? Math.round(withPct.reduce((a, b) => a + b.completionPct, 0) / withPct.length) : null;
  const sorted = [...withPct].sort((a, b) => b.completionPct - a.completionPct);
  return { from, to, daysInRange: perDay.length, daysLogged: perDay.filter((p) => p.logged).length, avgCompletion, perDay, best: sorted.slice(0, 3), worst: sorted.slice(-3).reverse() };
}

function insightLookback(q) {
  const { from, to } = getRange(q, 90); const lag = Math.min(7, Math.max(0, parseInt(q.get('lag'), 10) || 3));
  const days = dateRange(from, to); const today = todayStr();
  let toughDays = []; let betterDays = []; let targetLabel = '';
  if (q.get('tracker_id') && q.get('option_id')) {
    const tid = Number(q.get('tracker_id')); const oid = Number(q.get('option_id'));
    const opt = db.prepare('SELECT label FROM tracker_options WHERE id = ?').get(oid); const trk = db.prepare('SELECT name FROM trackers WHERE id = ?').get(tid);
    targetLabel = `${trk ? trk.name : 'Tracker'} = ${opt ? opt.label : oid}`;
    const onDays = new Set(db.prepare('SELECT date FROM tracker_logs WHERE tracker_id = ? AND option_id = ? AND date BETWEEN ? AND ?').all(tid, oid, from, to).map((r) => r.date));
    const loggedRows = db.prepare(`SELECT DISTINCT date FROM activity_logs WHERE date BETWEEN ? AND ? UNION SELECT DISTINCT date FROM tracker_logs WHERE date BETWEEN ? AND ? UNION SELECT DISTINCT date FROM symptom_entries WHERE date BETWEEN ? AND ?`).all(from, to, from, to, from, to);
    for (const r of loggedRows) { if (r.date > today) continue; if (onDays.has(r.date)) toughDays.push(r.date); else betterDays.push(r.date); }
  } else {
    const metricId = Number(q.get('metric_id')); const metric = db.prepare('SELECT * FROM metrics WHERE id = ?').get(metricId);
    if (!metric) return { from, to, lag, target: '', enoughData: false, message: 'metric_id or tracker_id+option_id required', worseBefore: [], betterBefore: [] };
    targetLabel = metric.name; const sym = loadSymptomMap(from, to); const valued = [];
    for (const d of days) { if (d > today) continue; const v = sym.get(`${metricId}|${d}`); if (v !== undefined) valued.push({ date: d, v }); }
    if (valued.length < 4) return { from, to, lag, target: targetLabel, enoughData: false, message: 'Not enough days logged yet — keep tracking and check back in a couple of weeks.', worseBefore: [], betterBefore: [] };
    const sorted = [...valued].map((x) => x.v).sort((a, b) => a - b); const median = sorted[Math.floor(sorted.length / 2)];
    const isTough = (v) => (metric.good_direction === 'low' ? v > median : v < median);
    for (const x of valued) (isTough(x.v) ? toughDays : betterDays).push(x.date);
  }
  if (toughDays.length < 2 || betterDays.length < 2) return { from, to, lag, target: targetLabel, enoughData: false, message: 'Not enough contrast in the data yet — a few more weeks will make this clearer.', worseBefore: [], betterBefore: [] };
  const actByDate = new Map(); const labels = {};
  const addItem = (date, key) => { if (!actByDate.has(date)) actByDate.set(date, new Set()); actByDate.get(date).add(key); };
  db.prepare("SELECT activity_id, date FROM activity_logs WHERE status = 'DONE' AND date BETWEEN ? AND ?").all(addDays(from, -lag), to).forEach((r) => addItem(r.date, `act:${r.activity_id}`));
  db.prepare('SELECT name, id FROM activities').all().forEach((a) => { labels[`act:${a.id}`] = a.name; });
  db.prepare('SELECT option_id, date FROM tracker_logs WHERE date BETWEEN ? AND ?').all(addDays(from, -lag), to).forEach((r) => addItem(r.date, `opt:${r.option_id}`));
  db.prepare('SELECT o.id, o.label, t.name tname FROM tracker_options o JOIN trackers t ON t.id = o.tracker_id').all().forEach((o) => { labels[`opt:${o.id}`] = `${o.label} (${o.tname})`; });
  const presence = (targetSet) => { const counts = new Map(); for (const D of targetSet) { const seen = new Set(); for (let k = 0; k <= lag; k++) { const wd = addDays(D, -k); const items = actByDate.get(wd); if (items) for (const it of items) seen.add(it); } for (const it of seen) counts.set(it, (counts.get(it) || 0) + 1); } return counts; };
  const tCounts = presence(toughDays); const bCounts = presence(betterDays);
  const allKeys = new Set([...tCounts.keys(), ...bCounts.keys()]); const findings = [];
  for (const key of allKeys) { const tRate = (tCounts.get(key) || 0) / toughDays.length; const bRate = (bCounts.get(key) || 0) / betterDays.length; findings.push({ key, label: labels[key] || key, toughPct: Math.round(tRate * 100), betterPct: Math.round(bRate * 100), diff: Math.round((tRate - bRate) * 100), toughCount: tCounts.get(key) || 0, betterCount: bCounts.get(key) || 0 }); }
  const meaningful = findings.filter((f) => f.toughCount + f.betterCount >= 3 && Math.abs(f.diff) >= 15);
  return { from, to, lag, target: targetLabel, enoughData: true, toughDays: toughDays.length, betterDays: betterDays.length, worseBefore: meaningful.filter((f) => f.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 8), betterBefore: meaningful.filter((f) => f.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 8), disclaimer: `Observational only. This shows which things happened more often in the ${lag} day(s) before tougher days — it suggests patterns to explore, not causes. It is not medical advice.` };
}

function trackerSummary(q) {
  const { from, to } = getRange(q, 30);
  const trackers = db.prepare('SELECT * FROM trackers ORDER BY display_order, id').all();
  const rows = db.prepare('SELECT tracker_id, option_id, date FROM tracker_logs WHERE date BETWEEN ? AND ?').all(from, to);
  const optDays = new Map(); const trkDays = new Map();
  for (const r of rows) { if (!optDays.has(r.option_id)) optDays.set(r.option_id, new Set()); optDays.get(r.option_id).add(r.date); if (!trkDays.has(r.tracker_id)) trkDays.set(r.tracker_id, new Set()); trkDays.get(r.tracker_id).add(r.date); }
  const optStmt = db.prepare('SELECT * FROM tracker_options WHERE tracker_id = ? ORDER BY display_order, id');
  const out = trackers.map((t) => ({ id: t.id, name: t.name, section: t.section, kind: t.kind, icon: t.icon, daysLogged: trkDays.get(t.id)?.size || 0, options: optStmt.all(t.id).map((o) => ({ id: o.id, label: o.label, emoji: o.emoji, days: optDays.get(o.id)?.size || 0 })).filter((o) => o.days > 0).sort((a, b) => b.days - a.days) })).filter((t) => t.options.length > 0);
  return { from, to, trackers: out };
}

/* ------------------------------ BACKUP -------------------------------- */
const DUMP_TABLES = ['activities', 'metrics', 'therapies', 'trackers', 'tracker_options', 'activity_logs', 'symptom_entries', 'daily_notes', 'therapy_logs', 'tracker_logs', 'library_entries', 'period_days', 'settings'];
export function dumpAll() {
  const data = {};
  for (const t of DUMP_TABLES) {
    let rows = db.prepare(`SELECT * FROM ${t}`).all();
    if (t === 'settings') rows = rows.filter((r) => !['drive_', 'google_'].some((pre) => String(r.key).startsWith(pre)));
    data[t] = rows;
  }
  return { app: 'WellNest', version: 1, exportedAt: new Date().toISOString(), data };
}
function importRoute(body) {
  const payload = body.data ? body : (body.app === 'WellNest' ? body : null); const data = payload?.data;
  if (!data || typeof data !== 'object') return bad('Invalid backup file (expected a WellNest JSON export).');
  const clearOrder = ['tracker_logs', 'tracker_options', 'therapy_logs', 'symptom_entries', 'activity_logs', 'daily_notes', 'library_entries', 'period_days', 'activities', 'metrics', 'therapies', 'trackers', 'settings'];
  const insertRows = (table, rows, cols) => { if (!Array.isArray(rows) || rows.length === 0) return; const present = cols.filter((c) => Object.prototype.hasOwnProperty.call(rows[0], c)); if (!present.length) return; const stmt = db.prepare(`INSERT INTO ${table} (${present.join(',')}) VALUES (${present.map((c) => '@' + c).join(',')})`); for (const r of rows) { const clean = {}; present.forEach((c) => { clean[c] = r[c] ?? null; }); stmt.run(clean); } };
  db.transaction(() => {
    for (const t of clearOrder) db.prepare(`DELETE FROM ${t}`).run();
    insertRows('metrics', data.metrics, ['id', 'key', 'name', 'good_direction', 'min_value', 'max_value', 'time_hint', 'display_order', 'active']);
    insertRows('therapies', data.therapies, ['id', 'name', 'cadence_days', 'display_order', 'active']);
    insertRows('trackers', data.trackers, ['id', 'name', 'kind', 'section', 'has_intensity', 'icon', 'hint', 'display_order', 'active']);
    insertRows('tracker_options', data.tracker_options, ['id', 'tracker_id', 'label', 'emoji', 'display_order', 'active']);
    insertRows('activities', data.activities, ['id', 'name', 'time_block', 'is_husband_task', 'expected_days', 'display_order', 'active', 'reminder_enabled', 'reminder_time', 'created_at', 'updated_at']);
    insertRows('activity_logs', data.activity_logs, ['id', 'activity_id', 'date', 'status', 'updated_at']);
    insertRows('symptom_entries', data.symptom_entries, ['id', 'metric_id', 'date', 'value', 'created_at']);
    insertRows('daily_notes', data.daily_notes, ['date', 'notes', 'cycle_day', 'updated_at']);
    insertRows('therapy_logs', data.therapy_logs, ['id', 'therapy_id', 'date', 'note', 'created_at']);
    insertRows('tracker_logs', data.tracker_logs, ['id', 'tracker_id', 'option_id', 'date', 'intensity', 'created_at']);
    insertRows('library_entries', data.library_entries, ['id', 'category', 'title', 'body', 'link', 'contact', 'address', 'image_url', 'entry_date', 'provider', 'pinned', 'display_order', 'created_at', 'updated_at']);
    insertRows('period_days', data.period_days, ['date', 'flow', 'created_at']);
    insertRows('settings', data.settings, ['key', 'value']);
  })();
  const counts = {}; for (const t of DUMP_TABLES) counts[t] = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  return ok({ ok: true, counts });
}
