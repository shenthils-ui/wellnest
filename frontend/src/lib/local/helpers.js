// Date/status helpers — mirror of backend/helpers.js.
export const STATUSES = ['DONE', 'TIRED', 'FORGOT', 'NOT_SCHEDULED'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00');
  return !Number.isNaN(d.getTime());
}
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function weekdayOf(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay();
}
export function parseExpectedDays(csv) {
  if (csv === null || csv === undefined || csv === '') return null;
  const arr = String(csv).split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return arr.length ? arr : null;
}
export function isExpectedOn(activity, dateStr) {
  if (!activity.active) return false;
  const days = parseExpectedDays(activity.expected_days);
  if (!days) return true;
  return days.includes(weekdayOf(dateStr));
}
export function dateRange(from, to) {
  const out = [];
  let d = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (d <= end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function clampInt(v, lo, hi) {
  const n = Math.round(Number(v));
  if (Number.isNaN(n)) return null;
  return Math.max(lo, Math.min(hi, n));
}
