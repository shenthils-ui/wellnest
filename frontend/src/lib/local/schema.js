// Schema + seed content for the on-device engine. Kept identical to the server
// (backend/db.js + backend/seedData.js) so a backup exported on the phone imports
// cleanly on the PC and vice-versa.

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  time_block TEXT NOT NULL,
  is_husband_task INTEGER NOT NULL DEFAULT 0,
  expected_days TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  reminder_time TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE,
  name TEXT NOT NULL,
  good_direction TEXT NOT NULL DEFAULT 'high',
  min_value INTEGER NOT NULL DEFAULT 1,
  max_value INTEGER NOT NULL DEFAULT 10,
  time_hint TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS therapies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cadence_days INTEGER NOT NULL DEFAULT 7,
  display_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(activity_id, date)
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON activity_logs(date);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity ON activity_logs(activity_id);
CREATE TABLE IF NOT EXISTS symptom_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id INTEGER NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  value INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_symptom_date ON symptom_entries(date);
CREATE INDEX IF NOT EXISTS idx_symptom_metric ON symptom_entries(metric_id);
CREATE TABLE IF NOT EXISTS daily_notes (
  date TEXT PRIMARY KEY,
  notes TEXT,
  cycle_day INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS therapy_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  therapy_id INTEGER NOT NULL REFERENCES therapies(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(therapy_id, date)
);
CREATE INDEX IF NOT EXISTS idx_therapy_logs_date ON therapy_logs(date);
CREATE TABLE IF NOT EXISTS period_days (
  date TEXT PRIMARY KEY,
  flow TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'multi',
  section TEXT NOT NULL DEFAULT 'food',
  has_intensity INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  hint TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS tracker_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id INTEGER NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  emoji TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_tracker_options_tracker ON tracker_options(tracker_id);
CREATE TABLE IF NOT EXISTS tracker_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id INTEGER NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES tracker_options(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  intensity INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tracker_id, option_id, date)
);
CREATE INDEX IF NOT EXISTS idx_tracker_logs_date ON tracker_logs(date);
CREATE INDEX IF NOT EXISTS idx_tracker_logs_tracker ON tracker_logs(tracker_id);
CREATE TABLE IF NOT EXISTS library_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'tip',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  contact TEXT,
  address TEXT,
  image_url TEXT,
  entry_date TEXT,
  provider TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_library_category ON library_entries(category);
`;

export const METRICS = [
  { key: 'sleep', name: 'Sleep Quality', good_direction: 'high', time_hint: 'morning' },
  { key: 'energy', name: 'Morning Energy', good_direction: 'high', time_hint: 'morning' },
  { key: 'mood_am', name: 'Morning Mood', good_direction: 'high', time_hint: 'morning' },
  { key: 'pain', name: 'Evening Pain', good_direction: 'low', time_hint: 'evening' },
  { key: 'mood_pm', name: 'Evening Mood', good_direction: 'high', time_hint: 'evening' },
  { key: 'stress', name: 'Stress', good_direction: 'low', time_hint: 'anytime' },
];

const VEG = ['Greens', 'Avocado', 'Zucchini', 'Paprika', 'Onion', 'Cucumber', 'Tomato',
  'Carrot', 'Beetroot', 'Lettuce', 'Spinach', 'Lentils', 'Edamame', 'Peas', 'Tofu',
  'Soup', 'Lemon', 'Coconut'];
const COOKING = ['Fresh / raw', 'Steamed', 'Cooked', 'Fried'];

export const ACTIVITIES = [
  ['Gratitude & affirmation', 'EARLY_MORNING', 0, null],
  ['Oil pulling', 'EARLY_MORNING', 0, null],
  ['Lemon + sodium bicarbonate shot', 'EARLY_MORNING', 0, null],
  ['Prepare bicarbonate water for the day', 'EARLY_MORNING', 1, null],
  ['Lemon water + shilajit (1 L)', 'EARLY_MORNING', 0, null],
  ['Black garlic (10)', 'EARLY_MORNING', 0, null],
  ['Vitamin D3 + K2 + Mg', 'EARLY_MORNING', 0, null],
  ['Yoga 30 min', 'EARLY_MORNING', 0, null],
  ['Wild yam cream (abdomen)', 'EARLY_MORNING', 0, null],
  ['Ointment - Morning', 'EARLY_MORNING', 0, null],
  ['Trampoline #1 (5 min)', 'EARLY_MORNING', 0, null],
  ['Breakfast/Salad #1', 'MID_MORNING', 0, null],
  ['Hemp drops', 'MID_MORNING', 0, null],
  ['Microgreens care/cut (30 min)', 'MID_MORNING', 0, null],
  ['Walking outside (60-90 min)', 'MID_MORNING', 0, null],
  ['Green juice', 'MID_MORNING', 0, null],
  ['Trampoline #2 (5 min)', 'MID_MORNING', 0, null],
  ['Gentian tea (before lunch)', 'MIDDAY', 0, null],
  ['Lunch (~12:00)', 'MIDDAY', 0, null],
  ['Digestive enzymes (after lunch)', 'MIDDAY', 0, null],
  ['Walk after lunch (30 min)', 'MIDDAY', 0, null],
  ['Quiet rest 30 min', 'MIDDAY', 0, null],
  ['Reading time', 'MIDDAY', 0, null],
  ['Trampoline #3 (5 min)', 'AFTERNOON', 0, null],
  ['Warm bath / sauna', 'AFTERNOON', 0, null],
  ['Green juice (snack)', 'AFTERNOON', 0, null],
  ['Trampoline #4 (5 min)', 'AFTERNOON', 0, null],
  ['Gentian tea (before dinner)', 'EVENING', 0, null],
  ['Dinner (~17:30)', 'EVENING', 1, null],
  ['Walk after dinner (30 min)', 'EVENING', 0, null],
  ['Ointment - Evening', 'EVENING', 0, null],
  ['Castor oil pack', 'EVENING', 0, null],
  ['Wind-down activity', 'EVENING', 0, null],
  ['Sleep by 21:30-22:00', 'EVENING', 0, null],
];

export const THERAPIES = [
  ['Hyperbaric', 7], ['NAET', 7], ['Osteopathic', 7], ['Hospital visit', 14],
];

export const TRACKERS = [
  { name: 'Green juice ingredients', kind: 'multi', section: 'food', icon: '🥬',
    hint: 'Tap what went into today’s juice.',
    options: ['Celery', 'Carrot', 'Beetroot', 'White pumpkin', 'Bottle gourd', 'Ginger',
      'Amla', 'Cucumber', 'Spinach', 'Lemon', ['Second serving', '🔁']] },
  { name: 'Lunch — vegetables', kind: 'multi', section: 'food', icon: '🥗', hint: 'What lunch contained.', options: VEG },
  { name: 'Lunch — cooking style', kind: 'single', section: 'food', icon: '🍳', options: COOKING },
  { name: 'Dinner — vegetables', kind: 'multi', section: 'food', icon: '🍽️', hint: 'What dinner contained.', options: VEG },
  { name: 'Dinner — cooking style', kind: 'single', section: 'food', icon: '🍳', options: COOKING },
  { name: 'Snacks', kind: 'multi', section: 'food', icon: '🥜', hint: 'Nuts, seeds and other snacks.',
    options: ['Almond', 'Walnut', 'Cashew', 'Brazil nut', 'Pumpkin seed', 'Sunflower seed', 'Flax seed', 'Fruit'] },
  { name: 'Other drinks', kind: 'multi', section: 'food', icon: '🥤',
    options: ['Coconut milk', 'Bone broth', 'Herbal tea', 'Lemon water'] },
  { name: 'Mood', kind: 'single', section: 'feeling', icon: '🫶',
    options: [['Happy', '😀'], ['Good', '🙂'], ['Normal', '😐'], ['Dull', '😟'], ['Low', '😢']] },
  { name: 'Pain', kind: 'multi', section: 'feeling', has_intensity: 1, icon: '🩹',
    hint: 'Tap a spot; tap again for light → medium → strong.',
    options: ['Head', 'Neck', 'Shoulder', 'Back', 'Bones', 'Breast', 'Stomach', 'Joints', 'Legs'] },
  { name: 'Bowel movement', kind: 'single', section: 'feeling', icon: '🚽',
    options: ['None', 'Normal', 'Loose', 'Hard', 'Constipated'] },
];
