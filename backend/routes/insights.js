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

module.exports = router;
