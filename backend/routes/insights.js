'use strict';

// Analytics: per-activity adherence, symptom trends, observational correlations,
// streaks / consistency, and an overview. All computed from the local DB.
const express = require('express');
const { db } = require('../db');
const {
  isValidDate,
  todayStr,
  isExpectedOn,
  dateRange,
  addDays,
} = require('../helpers');

const router = express.Router();

function getRange(req, defaultDays = 30) {
  const to = isValidDate(req.query.to) ? req.query.to : todayStr();
  const from = isValidDate(req.query.from) ? req.query.from : addDays(to, -(defaultDays - 1));
  return { from, to };
}

// Map "activity_id|date" -> status, for a date window.
function loadLogMap(from, to) {
  const rows = db
    .prepare('SELECT activity_id, date, status FROM activity_logs WHERE date BETWEEN ? AND ?')
    .all(from, to);
  const m = new Map();
  rows.forEach((r) => m.set(`${r.activity_id}|${r.date}`, r.status));
  return m;
}

// Map "metric_id|date" -> averaged value for the day.
function loadSymptomMap(from, to) {
  const rows = db
    .prepare(
      `SELECT metric_id, date, AVG(value) v FROM symptom_entries
       WHERE date BETWEEN ? AND ? GROUP BY metric_id, date`
    )
    .all(from, to);
  const m = new Map();
  rows.forEach((r) => m.set(`${r.metric_id}|${r.date}`, r.v));
  return m;
}

/* ------------------------- ACTIVITY ADHERENCE ------------------------- */
// GET /api/insights/activities?from=&to=
router.get('/activities', (req, res) => {
  const { from, to } = getRange(req, 30);
  const days = dateRange(from, to);
  const activities = db.prepare('SELECT * FROM activities ORDER BY display_order, id').all();
  const logMap = loadLogMap(from, to);
  const today = todayStr();

  const out = activities.map((a) => {
    let expected = 0, done = 0, tired = 0, forgot = 0, notScheduled = 0, unset = 0;
    for (const d of days) {
      if (d > today) continue; // don't penalise future days
      if (!isExpectedOn(a, d)) continue;
      expected += 1;
      const s = logMap.get(`${a.id}|${d}`);
      if (s === 'DONE') done += 1;
      else if (s === 'TIRED') tired += 1;
      else if (s === 'FORGOT') forgot += 1;
      else if (s === 'NOT_SCHEDULED') notScheduled += 1;
      else unset += 1;
    }
    const denom = Math.max(0, expected - notScheduled);
    const completionPct = denom > 0 ? Math.round((done / denom) * 100) : null;
    return {
      id: a.id,
      name: a.name,
      time_block: a.time_block,
      is_husband_task: a.is_husband_task,
      active: a.active,
      expected: denom,
      done,
      tired,
      forgot,
      unset,
      notScheduled,
      skipped: tired + forgot,
      completionPct,
    };
  });

  res.json({ from, to, activities: out });
});

/* --------------------------- SYMPTOM TRENDS --------------------------- */
// GET /api/insights/symptoms?from=&to=
// Returns, per metric, a daily series of averaged values + summary stats.
router.get('/symptoms', (req, res) => {
  const { from, to } = getRange(req, 30);
  const metrics = db.prepare('SELECT * FROM metrics ORDER BY display_order, id').all();
  const rows = db
    .prepare(
      `SELECT metric_id, date, ROUND(AVG(value),2) v, COUNT(*) c
       FROM symptom_entries WHERE date BETWEEN ? AND ? GROUP BY metric_id, date ORDER BY date`
    )
    .all(from, to);

  const byMetric = new Map();
  rows.forEach((r) => {
    if (!byMetric.has(r.metric_id)) byMetric.set(r.metric_id, []);
    byMetric.get(r.metric_id).push({ date: r.date, value: r.v, count: r.c });
  });

  const out = metrics.map((m) => {
    const series = byMetric.get(m.id) || [];
    const vals = series.map((s) => s.value);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return {
      id: m.id,
      key: m.key,
      name: m.name,
      good_direction: m.good_direction,
      min_value: m.min_value,
      max_value: m.max_value,
      series,
      average: avg === null ? null : Math.round(avg * 10) / 10,
      daysLogged: series.length,
      min: vals.length ? Math.min(...vals) : null,
      max: vals.length ? Math.max(...vals) : null,
    };
  });
  res.json({ from, to, metrics: out });
});

/* ---------------------------- CORRELATION ----------------------------- */
function correlate(activity, metricId, from, to, logMap, symMap) {
  const days = dateRange(from, to);
  const doneVals = [];
  const notVals = [];
  for (const d of days) {
    const sym = symMap.get(`${metricId}|${d}`);
    if (sym === undefined) continue; // need a symptom reading to compare
    if (!isExpectedOn(activity, d)) {
      // not scheduled that day -> treat as "not done" only if there's a reading
      notVals.push(sym);
      continue;
    }
    const s = logMap.get(`${activity.id}|${d}`);
    if (s === 'DONE') doneVals.push(sym);
    else notVals.push(sym); // TIRED/FORGOT/NOT_SCHEDULED/unset all count as "not done"
  }
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const doneAvg = mean(doneVals);
  const notDoneAvg = mean(notVals);
  return {
    doneAvg: doneAvg === null ? null : Math.round(doneAvg * 10) / 10,
    notDoneAvg: notDoneAvg === null ? null : Math.round(notDoneAvg * 10) / 10,
    doneCount: doneVals.length,
    notDoneCount: notVals.length,
    diff: doneAvg !== null && notDoneAvg !== null ? Math.round((doneAvg - notDoneAvg) * 10) / 10 : null,
  };
}

function sentence(activityName, metricName, goodDir, c) {
  if (c.diff === null) return null;
  const lower = c.doneAvg < c.notDoneAvg;
  const better =
    (goodDir === 'high' && c.doneAvg > c.notDoneAvg) ||
    (goodDir === 'low' && c.doneAvg < c.notDoneAvg);
  const dirWord = lower ? 'lower' : 'higher';
  return (
    `${metricName} averages ${c.doneAvg} on days “${activityName}” was done ` +
    `vs ${c.notDoneAvg} on other days (${dirWord} by ${Math.abs(c.diff)}). ` +
    (better
      ? 'On these days the trend looks more favourable.'
      : 'On these days the trend looks less favourable.')
  );
}

// GET /api/insights/correlation?activity_id=&metric_id=&from=&to=
router.get('/correlation', (req, res) => {
  const { from, to } = getRange(req, 60);
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(Number(req.query.activity_id));
  const metric = db.prepare('SELECT * FROM metrics WHERE id = ?').get(Number(req.query.metric_id));
  if (!activity || !metric) return res.status(400).json({ error: 'activity_id and metric_id required' });
  const logMap = loadLogMap(from, to);
  const symMap = loadSymptomMap(from, to);
  const c = correlate(activity, metric.id, from, to, logMap, symMap);
  res.json({
    from,
    to,
    activity: { id: activity.id, name: activity.name },
    metric: { id: metric.id, name: metric.name, good_direction: metric.good_direction },
    ...c,
    note: sentence(activity.name, metric.name, metric.good_direction, c),
    disclaimer: 'Observational only — this shows averages, not cause and effect, and is not medical advice.',
  });
});

// GET /api/insights/correlation/scan?from=&to=&minDays=
// Scans every activity × metric pair and returns the strongest observed gaps.
router.get('/correlation/scan', (req, res) => {
  const { from, to } = getRange(req, 60);
  const minDays = Math.max(2, parseInt(req.query.minDays, 10) || 4);
  const activities = db.prepare('SELECT * FROM activities WHERE active = 1').all();
  const metrics = db.prepare('SELECT * FROM metrics WHERE active = 1').all();
  const logMap = loadLogMap(from, to);
  const symMap = loadSymptomMap(from, to);

  const findings = [];
  for (const a of activities) {
    for (const m of metrics) {
      const c = correlate(a, m.id, from, to, logMap, symMap);
      if (c.doneCount >= minDays && c.notDoneCount >= minDays && c.diff !== null) {
        findings.push({
          activity: { id: a.id, name: a.name },
          metric: { id: m.id, name: m.name, good_direction: m.good_direction },
          ...c,
          absDiff: Math.abs(c.diff),
          note: sentence(a.name, m.name, m.good_direction, c),
        });
      }
    }
  }
  findings.sort((x, y) => y.absDiff - x.absDiff);
  res.json({ from, to, minDays, findings: findings.slice(0, 12) });
});

/* ------------------------------ CALENDAR ------------------------------ */
// GET /api/insights/calendar?from=&to=
// Per-day completion % + per-metric daily averages for the heatmap.
router.get('/calendar', (req, res) => {
  const { from, to } = getRange(req, 42);
  const days = dateRange(from, to);
  const today = todayStr();
  const activities = db.prepare('SELECT * FROM activities').all();
  const logMap = loadLogMap(from, to);

  const symRows = db
    .prepare(
      `SELECT date, metric_id, ROUND(AVG(value),1) v FROM symptom_entries
       WHERE date BETWEEN ? AND ? GROUP BY date, metric_id`
    )
    .all(from, to);
  const symByDate = {};
  symRows.forEach((r) => {
    (symByDate[r.date] || (symByDate[r.date] = {}))[r.metric_id] = r.v;
  });

  const loggedRows = db
    .prepare(
      `SELECT date FROM activity_logs WHERE date BETWEEN ? AND ?
       UNION SELECT date FROM symptom_entries WHERE date BETWEEN ? AND ?
       UNION SELECT date FROM daily_notes WHERE date BETWEEN ? AND ?`
    )
    .all(from, to, from, to, from, to);
  const logged = new Set(loggedRows.map((r) => r.date));

  const perDay = days.map((d) => {
    let expected = 0;
    let done = 0;
    for (const a of activities) {
      if (!isExpectedOn(a, d)) continue;
      const s = logMap.get(`${a.id}|${d}`);
      if (s === 'NOT_SCHEDULED') continue;
      expected += 1;
      if (s === 'DONE') done += 1;
    }
    const pct = expected > 0 ? Math.round((done / expected) * 100) : null;
    return {
      date: d,
      completionPct: d > today ? null : pct,
      done,
      expected,
      logged: logged.has(d),
      metrics: symByDate[d] || {},
    };
  });
  res.json({ from, to, perDay });
});

/* ------------------------- STREAKS / CONSISTENCY ---------------------- */
// GET /api/insights/streaks?windowDays=
router.get('/streaks', (req, res) => {
  const windowDays = Math.min(730, Math.max(30, parseInt(req.query.windowDays, 10) || 365));
  const today = todayStr();
  const start = addDays(today, -(windowDays - 1));
  const activities = db.prepare('SELECT * FROM activities ORDER BY display_order, id').all();
  const logMap = loadLogMap(start, today);

  // Earliest log date overall, so we don't count a streak before tracking began.
  const first = db.prepare('SELECT MIN(date) d FROM activity_logs').get().d || start;
  const effStart = first > start ? first : start;
  const days = dateRange(effStart, today);
  const halfLife = 21; // days; recent regularity weighted more

  const out = activities
    .filter((a) => a.active === 1)
    .map((a) => {
      // Build chronological list of expected days with done flag.
      const seq = [];
      for (const d of days) {
        if (!isExpectedOn(a, d)) continue;
        const s = logMap.get(`${a.id}|${d}`);
        if (s === 'NOT_SCHEDULED') continue; // explicitly not applicable
        seq.push({ date: d, done: s === 'DONE', recorded: s !== undefined });
      }

      // Longest streak of consecutive expected days done.
      let longest = 0, run = 0;
      for (const e of seq) {
        if (e.done) { run += 1; longest = Math.max(longest, run); }
        else run = 0;
      }

      // Current streak: from the end backwards. A not-yet-recorded *today*
      // at the tail doesn't break the streak (it's just not done yet).
      let current = 0;
      for (let i = seq.length - 1; i >= 0; i--) {
        const e = seq[i];
        if (i === seq.length - 1 && e.date === today && !e.done && !e.recorded) continue;
        if (e.done) current += 1;
        else break;
      }

      // Loop-style consistency: recency-weighted fraction done (0..100).
      let wSum = 0, wDone = 0;
      for (const e of seq) {
        const ageDays = (new Date(today) - new Date(e.date)) / 86400000;
        const w = Math.pow(0.5, ageDays / halfLife);
        wSum += w;
        if (e.done) wDone += w;
      }
      const consistency = wSum > 0 ? Math.round((wDone / wSum) * 100) : null;

      return {
        id: a.id,
        name: a.name,
        time_block: a.time_block,
        is_husband_task: a.is_husband_task,
        currentStreak: current,
        longestStreak: longest,
        consistency,
        expectedDays: seq.length,
      };
    });

  res.json({ windowDays, from: effStart, to: today, activities: out });
});

/* ------------------------------ OVERVIEW ------------------------------ */
// GET /api/insights/overview?from=&to=
router.get('/overview', (req, res) => {
  const { from, to } = getRange(req, 30);
  const days = dateRange(from, to);
  const today = todayStr();
  const activities = db.prepare('SELECT * FROM activities').all();
  const logMap = loadLogMap(from, to);

  const loggedDatesRow = db
    .prepare(
      `SELECT date FROM activity_logs WHERE date BETWEEN ? AND ?
       UNION SELECT date FROM symptom_entries WHERE date BETWEEN ? AND ?
       UNION SELECT date FROM daily_notes WHERE date BETWEEN ? AND ?`
    )
    .all(from, to, from, to, from, to);
  const loggedDates = new Set(loggedDatesRow.map((r) => r.date));

  const perDay = [];
  for (const d of days) {
    if (d > today) continue;
    let expected = 0, done = 0, notScheduled = 0;
    for (const a of activities) {
      if (!isExpectedOn(a, d)) continue;
      expected += 1;
      const s = logMap.get(`${a.id}|${d}`);
      if (s === 'DONE') done += 1;
      else if (s === 'NOT_SCHEDULED') notScheduled += 1;
    }
    const denom = Math.max(0, expected - notScheduled);
    const pct = denom > 0 ? Math.round((done / denom) * 100) : null;
    perDay.push({ date: d, completionPct: pct, done, expected: denom, logged: loggedDates.has(d) });
  }

  const withPct = perDay.filter((p) => p.completionPct !== null && p.logged);
  const avgCompletion =
    withPct.length ? Math.round(withPct.reduce((a, b) => a + b.completionPct, 0) / withPct.length) : null;
  const sorted = [...withPct].sort((a, b) => b.completionPct - a.completionPct);
  const best = sorted.slice(0, 3);
  const worst = sorted.slice(-3).reverse();

  res.json({
    from,
    to,
    daysInRange: perDay.length,
    daysLogged: perDay.filter((p) => p.logged).length,
    avgCompletion,
    perDay,
    best,
    worst,
  });
});

/* ------------------------------ LOOK BACK ----------------------------- */
// "What came before the tougher days?" Compares how often each food / activity
// appeared in the lag-day window leading up to tougher days vs better days.
// Target is either a symptom metric, or a tracker option (e.g. Mood = Low).
// GET /api/insights/lookback?metric_id=&tracker_id=&option_id=&lag=&from=&to=
router.get('/lookback', (req, res) => {
  const { from, to } = getRange(req, 90);
  const lag = Math.min(7, Math.max(0, parseInt(req.query.lag, 10) || 3));
  const days = dateRange(from, to);
  const today = todayStr();

  // --- decide tough vs better target days ---
  let toughDays = [];
  let betterDays = [];
  let targetLabel = '';

  if (req.query.tracker_id && req.query.option_id) {
    const tid = Number(req.query.tracker_id);
    const oid = Number(req.query.option_id);
    const opt = db.prepare('SELECT label FROM tracker_options WHERE id = ?').get(oid);
    const trk = db.prepare('SELECT name FROM trackers WHERE id = ?').get(tid);
    targetLabel = `${trk ? trk.name : 'Tracker'} = ${opt ? opt.label : oid}`;
    const rows = db
      .prepare('SELECT date FROM tracker_logs WHERE tracker_id = ? AND option_id = ? AND date BETWEEN ? AND ?')
      .all(tid, oid, from, to);
    const onDays = new Set(rows.map((r) => r.date));
    // "better" = days that had any logging but not this option
    const loggedRows = db
      .prepare(
        `SELECT DISTINCT date FROM activity_logs WHERE date BETWEEN ? AND ?
         UNION SELECT DISTINCT date FROM tracker_logs WHERE date BETWEEN ? AND ?
         UNION SELECT DISTINCT date FROM symptom_entries WHERE date BETWEEN ? AND ?`
      )
      .all(from, to, from, to, from, to);
    for (const r of loggedRows) {
      if (r.date > today) continue;
      if (onDays.has(r.date)) toughDays.push(r.date);
      else betterDays.push(r.date);
    }
  } else {
    const metricId = Number(req.query.metric_id);
    const metric = db.prepare('SELECT * FROM metrics WHERE id = ?').get(metricId);
    if (!metric) return res.status(400).json({ error: 'metric_id or tracker_id+option_id required' });
    targetLabel = metric.name;
    const sym = loadSymptomMap(from, to);
    const valued = [];
    for (const d of days) {
      if (d > today) continue;
      const v = sym.get(`${metricId}|${d}`);
      if (v !== undefined) valued.push({ date: d, v });
    }
    if (valued.length < 4) {
      return res.json({
        from, to, lag, target: targetLabel, enoughData: false,
        message: 'Not enough days logged yet — keep tracking and check back in a couple of weeks.',
        worseBefore: [], betterBefore: [],
      });
    }
    const sorted = [...valued].map((x) => x.v).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    // worse depends on direction: for 'low' good (pain/stress) higher = tougher
    const isTough = (v) => (metric.good_direction === 'low' ? v > median : v < median);
    for (const x of valued) (isTough(x.v) ? toughDays : betterDays).push(x.date);
  }

  if (toughDays.length < 2 || betterDays.length < 2) {
    return res.json({
      from, to, lag, target: targetLabel, enoughData: false,
      message: 'Not enough contrast in the data yet — a few more weeks will make this clearer.',
      worseBefore: [], betterBefore: [],
    });
  }

  // --- antecedent items present per date (activities DONE + tracker options) ---
  const actByDate = new Map(); // date -> Set(item key)
  const addItem = (date, key) => {
    if (!actByDate.has(date)) actByDate.set(date, new Set());
    actByDate.get(date).add(key);
  };
  const labels = {}; // key -> display label

  db.prepare("SELECT activity_id, date FROM activity_logs WHERE status = 'DONE' AND date BETWEEN ? AND ?")
    .all(addDays(from, -lag), to)
    .forEach((r) => addItem(r.date, `act:${r.activity_id}`));
  db.prepare('SELECT name, id FROM activities').all().forEach((a) => { labels[`act:${a.id}`] = a.name; });

  db.prepare('SELECT option_id, date FROM tracker_logs WHERE date BETWEEN ? AND ?')
    .all(addDays(from, -lag), to)
    .forEach((r) => addItem(r.date, `opt:${r.option_id}`));
  db.prepare('SELECT o.id, o.label, t.name tname FROM tracker_options o JOIN trackers t ON t.id = o.tracker_id')
    .all()
    .forEach((o) => { labels[`opt:${o.id}`] = `${o.label} (${o.tname})`; });

  // presence of an item in the window [D-lag, D]
  function windowPresence(targetDays) {
    const counts = new Map();
    for (const D of targetDays) {
      const seen = new Set();
      for (let k = 0; k <= lag; k++) {
        const wd = addDays(D, -k);
        const items = actByDate.get(wd);
        if (items) for (const it of items) seen.add(it);
      }
      for (const it of seen) counts.set(it, (counts.get(it) || 0) + 1);
    }
    return counts;
  }

  const toughCounts = windowPresence(toughDays);
  const betterCounts = windowPresence(betterDays);
  const allKeys = new Set([...toughCounts.keys(), ...betterCounts.keys()]);

  const findings = [];
  for (const key of allKeys) {
    const tRate = (toughCounts.get(key) || 0) / toughDays.length;
    const bRate = (betterCounts.get(key) || 0) / betterDays.length;
    findings.push({
      key,
      label: labels[key] || key,
      toughPct: Math.round(tRate * 100),
      betterPct: Math.round(bRate * 100),
      diff: Math.round((tRate - bRate) * 100),
      toughCount: toughCounts.get(key) || 0,
      betterCount: betterCounts.get(key) || 0,
    });
  }
  const meaningful = findings.filter((f) => f.toughCount + f.betterCount >= 3 && Math.abs(f.diff) >= 15);
  const worseBefore = meaningful.filter((f) => f.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 8);
  const betterBefore = meaningful.filter((f) => f.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 8);

  res.json({
    from, to, lag, target: targetLabel, enoughData: true,
    toughDays: toughDays.length,
    betterDays: betterDays.length,
    worseBefore,
    betterBefore,
    disclaimer:
      'Observational only. This shows which things happened more often in the ' +
      `${lag} day(s) before tougher days — it suggests patterns to explore, not causes. ` +
      'It is not medical advice.',
  });
});

/* -------------------------- TRACKER SUMMARY --------------------------- */
// GET /api/insights/tracker-summary?from=&to=
// Per-tracker option frequencies over a range — used by the doctor report and
// to show "what was eaten / how she felt most often".
router.get('/tracker-summary', (req, res) => {
  const { from, to } = getRange(req, 30);
  const trackers = db.prepare('SELECT * FROM trackers ORDER BY display_order, id').all();
  const optStmt = db.prepare('SELECT * FROM tracker_options WHERE tracker_id = ? ORDER BY display_order, id');
  const rows = db
    .prepare('SELECT tracker_id, option_id, date FROM tracker_logs WHERE date BETWEEN ? AND ?')
    .all(from, to);

  // option_id -> set of days, and tracker_id -> set of days with any log
  const optDays = new Map();
  const trkDays = new Map();
  for (const r of rows) {
    if (!optDays.has(r.option_id)) optDays.set(r.option_id, new Set());
    optDays.get(r.option_id).add(r.date);
    if (!trkDays.has(r.tracker_id)) trkDays.set(r.tracker_id, new Set());
    trkDays.get(r.tracker_id).add(r.date);
  }

  const out = trackers.map((t) => {
    const options = optStmt
      .all(t.id)
      .map((o) => ({ id: o.id, label: o.label, emoji: o.emoji, days: optDays.get(o.id)?.size || 0 }))
      .filter((o) => o.days > 0)
      .sort((a, b) => b.days - a.days);
    return {
      id: t.id,
      name: t.name,
      section: t.section,
      kind: t.kind,
      icon: t.icon,
      daysLogged: trkDays.get(t.id)?.size || 0,
      options,
    };
  }).filter((t) => t.options.length > 0);

  res.json({ from, to, trackers: out });
});

module.exports = router;
