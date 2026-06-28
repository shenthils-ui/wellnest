'use strict';

// Menstrual cycle summary derived from logged period days: cycle length,
// current day, and a simple prediction of the next period & fertile window.
const express = require('express');
const { db } = require('../db');
const { todayStr, addDays } = require('../helpers');

const router = express.Router();

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

router.get('/cycle', (req, res) => {
  const rows = db.prepare('SELECT date, flow FROM period_days ORDER BY date').all();
  const dates = rows.map((r) => r.date);
  const today = todayStr();
  const DEFAULT_CYCLE = 28;

  if (dates.length === 0) {
    return res.json({
      enoughData: false,
      hasAnyData: false,
      avgCycle: DEFAULT_CYCLE,
      periodDays: [],
      starts: [],
      cycles: [],
    });
  }

  // group consecutive days into period runs; a run's first day is a "start"
  const starts = [];
  const runs = [];
  let runStart = dates[0];
  let prev = dates[0];
  let runLen = 1;
  for (let i = 1; i < dates.length; i++) {
    if (daysBetween(prev, dates[i]) === 1) {
      runLen += 1;
    } else {
      starts.push(runStart);
      runs.push({ start: runStart, length: runLen });
      runStart = dates[i];
      runLen = 1;
    }
    prev = dates[i];
  }
  starts.push(runStart);
  runs.push({ start: runStart, length: runLen });

  // cycle lengths between consecutive starts
  const cycles = [];
  for (let i = 1; i < starts.length; i++) {
    cycles.push({ from: starts[i - 1], to: starts[i], length: daysBetween(starts[i - 1], starts[i]) });
  }
  const recent = cycles.slice(-6);
  const avgCycle = recent.length
    ? Math.round(recent.reduce((s, c) => s + c.length, 0) / recent.length)
    : DEFAULT_CYCLE;
  const avgPeriodLen = Math.round(runs.reduce((s, r) => s + r.length, 0) / runs.length);

  const lastStart = starts[starts.length - 1];
  const currentDay = daysBetween(lastStart, today) + 1; // day 1 = first day of period
  const predictedNext = addDays(lastStart, avgCycle);
  const daysUntilNext = daysBetween(today, predictedNext);
  // ovulation ≈ 14 days before the next period; fertile window ≈ 5 days before to 1 day after
  const predictedOvulation = addDays(predictedNext, -14);
  const fertileStart = addDays(predictedOvulation, -5);
  const fertileEnd = addDays(predictedOvulation, 1);

  res.json({
    enoughData: cycles.length >= 1,
    hasAnyData: true,
    avgCycle,
    avgPeriodLen,
    periodDays: rows,
    starts,
    cycles: recent,
    lastStart,
    currentDay: currentDay >= 1 ? currentDay : null,
    predictedNext,
    daysUntilNext,
    predictedOvulation,
    fertileStart,
    fertileEnd,
    today,
  });
});

module.exports = router;
