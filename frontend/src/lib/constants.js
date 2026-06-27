// Shared enums, labels, colours and gentle copy used across the app.

export const TIME_BLOCKS = [
  { key: 'EARLY_MORNING', label: 'Early morning', emoji: '🌅' },
  { key: 'MID_MORNING', label: 'Mid morning', emoji: '☀️' },
  { key: 'MIDDAY', label: 'Midday', emoji: '🍃' },
  { key: 'AFTERNOON', label: 'Afternoon', emoji: '🌤️' },
  { key: 'EVENING', label: 'Evening', emoji: '🌙' },
];

export const TIME_BLOCK_LABEL = Object.fromEntries(
  TIME_BLOCKS.map((b) => [b.key, b.label])
);

// Tap cycle: unset → DONE → TIRED → FORGOT → unset
export const STATUS_CYCLE = [null, 'DONE', 'TIRED', 'FORGOT'];

export function nextStatus(current) {
  const i = STATUS_CYCLE.indexOf(current ?? null);
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
}

// Status visuals. Language is intentionally neutral & kind — a "too tired"
// skip is valid self-care, never a failure.
export const STATUS_META = {
  DONE: {
    label: 'Done',
    short: 'Done',
    dot: 'bg-emerald-500',
    rowLight: 'bg-emerald-50 border-emerald-200',
    rowDark: 'dark:bg-emerald-900/30 dark:border-emerald-700/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    chipBg: 'bg-emerald-500',
  },
  TIRED: {
    label: 'Rested instead',
    short: 'Rested',
    dot: 'bg-amber-400',
    rowLight: 'bg-amber-50 border-amber-200',
    rowDark: 'dark:bg-amber-900/25 dark:border-amber-700/50',
    text: 'text-amber-700 dark:text-amber-300',
    chipBg: 'bg-amber-400',
  },
  FORGOT: {
    label: 'Slipped by',
    short: 'Missed',
    dot: 'bg-rose-400',
    rowLight: 'bg-rose-50 border-rose-200',
    rowDark: 'dark:bg-rose-900/25 dark:border-rose-700/50',
    text: 'text-rose-700 dark:text-rose-300',
    chipBg: 'bg-rose-400',
  },
  NOT_SCHEDULED: {
    label: 'Not scheduled',
    short: 'Skip',
    dot: 'bg-slate-300',
    rowLight: 'bg-slate-50 border-slate-200',
    rowDark: 'dark:bg-slate-800/40 dark:border-slate-700',
    text: 'text-slate-500 dark:text-slate-400',
    chipBg: 'bg-slate-300',
  },
};

// Colour for a 1-10 value given whether higher or lower is better.
// Returns an { bg, ring } pair of hex colours for heatmaps / pixels.
export function valueColor(value, goodDirection = 'high') {
  if (value == null) return { bg: 'transparent', text: '#9ca3af' };
  // normalise so 1 = worst, 10 = best regardless of direction
  const norm = goodDirection === 'low' ? (11 - value) / 10 : value / 10;
  // red (bad) → amber → green (good)
  const stops = [
    [0.0, [0xe1, 0x6a, 0x6a]],
    [0.5, [0xe6, 0xb8, 0x53]],
    [1.0, [0x4d, 0x8a, 0x6e]],
  ];
  let c = stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (norm >= t0 && norm <= t1) {
      const t = (norm - t0) / (t1 - t0 || 1);
      c = [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * t));
      break;
    }
  }
  const hex = '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  return { bg: hex, text: '#ffffff' };
}

// completion % → soft colour for the calendar ring
export function completionColor(pct) {
  if (pct == null) return '#d8d2c6';
  if (pct >= 80) return '#4d8a6e';
  if (pct >= 50) return '#83b08f';
  if (pct >= 25) return '#e6b853';
  return '#e1928a';
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// A small rotation of warm, non-pressuring encouragements.
export const ENCOURAGEMENTS = [
  'One gentle step at a time. 🌿',
  'Resting counts as healing too.',
  'You showed up today — that matters.',
  'Small and steady is more than enough.',
  'Be as kind to yourself as you would a friend.',
];
