// Pure helpers shared by Today / History for deciding what's scheduled and
// computing completion — kept in sync with the backend's logic.
import { weekday } from './date';
import { TIME_BLOCKS } from './constants';

export function parseExpectedDays(csv) {
  if (csv === null || csv === undefined || csv === '') return null;
  const arr = String(csv)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return arr.length ? arr : null;
}

export function isExpectedOn(activity, iso) {
  if (!activity.active) return false;
  const days = parseExpectedDays(activity.expected_days);
  if (!days) return true;
  return days.includes(weekday(iso));
}

// Completion for a day: done / (expected − explicitly-not-scheduled).
export function dayCompletion(activities, iso, logs) {
  let expected = 0;
  let done = 0;
  let notScheduled = 0;
  for (const a of activities) {
    if (!isExpectedOn(a, iso)) continue;
    const s = logs?.[a.id];
    if (s === 'NOT_SCHEDULED') {
      notScheduled += 1;
      continue;
    }
    expected += 1;
    if (s === 'DONE') done += 1;
  }
  const percent = expected > 0 ? Math.round((done / expected) * 100) : null;
  return { expected, done, percent };
}

// Group active+scheduled activities by time block, preserving block + display order.
export function groupByBlock(activities, iso, { onlyScheduled = true } = {}) {
  const groups = TIME_BLOCKS.map((b) => ({ ...b, activities: [] }));
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
  const sorted = [...activities].sort((a, b) => a.display_order - b.display_order || a.id - b.id);
  for (const a of sorted) {
    if (!a.active) continue;
    if (onlyScheduled && !isExpectedOn(a, iso)) continue;
    (byKey[a.time_block] || byKey.MID_MORNING).activities.push(a);
  }
  return groups.filter((g) => g.activities.length > 0);
}
