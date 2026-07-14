'use strict';

const STATUSES = ['DONE', 'TIRED', 'FORGOT', 'NOT_SCHEDULED'];
const TIME_BLOCKS = ['EARLY_MORNING', 'MID_MORNING', 'MIDDAY', 'AFTERNOON', 'EVENING'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  // JS's Date silently rolls over invalid day-of-month (e.g. Feb 29 in a
  // non-leap year, or day 31 of a 30-day month) into the next month instead
  // of rejecting it — confirm the round-trip matches what was asked for.
  const [y, m, day] = s.split('-').map(Number);
  return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day;
}

// Local-time today as YYYY-MM-DD (server's local clock).
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// JS weekday number 0..6 (0=Sun) for a YYYY-MM-DD string.
function weekdayOf(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay();
}

// Parse "1,3,5,0" -> [1,3,5,0]; null/'' -> null (every day).
function parseExpectedDays(csv) {
  if (csv === null || csv === undefined || csv === '') return null;
  const arr = String(csv)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return arr.length ? arr : null;
}

// Is the activity expected (scheduled) on the given date?
function isExpectedOn(activity, dateStr) {
  if (!activity.active) return false;
  const days = parseExpectedDays(activity.expected_days);
  if (!days) return true; // every day
  return days.includes(weekdayOf(dateStr));
}

// Inclusive list of YYYY-MM-DD strings from -> to.
function dateRange(from, to) {
  const out = [];
  let d = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (d <= end) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function clampInt(v, lo, hi) {
  const n = Math.round(Number(v));
  if (Number.isNaN(n)) return null;
  return Math.max(lo, Math.min(hi, n));
}

module.exports = {
  STATUSES,
  TIME_BLOCKS,
  isValidDate,
  todayStr,
  weekdayOf,
  parseExpectedDays,
  isExpectedOn,
  dateRange,
  addDays,
  clampInt,
};
