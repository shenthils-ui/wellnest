// Local-time date helpers. Everything is keyed by 'YYYY-MM-DD' in the user's
// local timezone so "today" matches the wall clock on the phone / PC.

export function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function parseISO(s) {
  return new Date(s + 'T00:00:00');
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function weekday(iso) {
  return parseISO(iso).getDay(); // 0=Sun
}

export function isToday(iso) {
  return iso === todayISO();
}

export function isFuture(iso) {
  return iso > todayISO();
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function prettyDate(iso) {
  const d = parseISO(iso);
  return `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function prettyShort(iso) {
  const d = parseISO(iso);
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function monthLabel(year, monthIdx) {
  return `${MONTHS[monthIdx]} ${year}`;
}

export function relativeLabel(iso) {
  const t = todayISO();
  if (iso === t) return 'Today';
  if (iso === addDays(t, -1)) return 'Yesterday';
  if (iso === addDays(t, 1)) return 'Tomorrow';
  return null;
}

// Build a calendar grid (weeks of 7) for a given month, Sun-first.
// Returns array of weeks; each cell is { iso, inMonth }.
export function monthGrid(year, monthIdx) {
  const first = new Date(year, monthIdx, 1);
  const startDow = first.getDay();
  const gridStart = new Date(year, monthIdx, 1 - startDow);
  const weeks = [];
  let cur = gridStart;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push({ iso: toISO(cur), inMonth: cur.getMonth() === monthIdx });
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
    weeks.push(week);
    // stop after we've passed the month and completed a week
    if (cur.getMonth() !== monthIdx && cur > new Date(year, monthIdx + 1, 0)) break;
  }
  return weeks;
}

export function timeNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
