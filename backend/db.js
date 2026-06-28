'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Database lives in a local file on disk so nothing is lost on restart/reboot.
// Override location with WELLNEST_DB_PATH if desired.
const DATA_DIR = process.env.WELLNEST_DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.WELLNEST_DB_PATH || path.join(DATA_DIR, 'wellnest.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // resilient to crashes, good for concurrent reads
db.pragma('foreign_keys = ON');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  time_block TEXT NOT NULL,
  is_husband_task INTEGER NOT NULL DEFAULT 0,
  expected_days TEXT,                       -- CSV of weekday numbers 0..6 (0=Sun). NULL/'' = every day
  display_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  reminder_time TEXT,                       -- 'HH:MM' local time
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE,
  name TEXT NOT NULL,
  good_direction TEXT NOT NULL DEFAULT 'high',  -- 'high' = higher is better, 'low' = lower is better
  min_value INTEGER NOT NULL DEFAULT 1,
  max_value INTEGER NOT NULL DEFAULT 10,
  time_hint TEXT,                               -- 'morning' | 'evening' | 'anytime'
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
  date TEXT NOT NULL,                            -- 'YYYY-MM-DD'
  status TEXT NOT NULL,                          -- DONE | TIRED | FORGOT | NOT_SCHEDULED
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(activity_id, date)
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON activity_logs(date);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity ON activity_logs(activity_id);

CREATE TABLE IF NOT EXISTS symptom_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id INTEGER NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                            -- 'YYYY-MM-DD'
  value INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_symptom_date ON symptom_entries(date);
CREATE INDEX IF NOT EXISTS idx_symptom_metric ON symptom_entries(metric_id);

CREATE TABLE IF NOT EXISTS daily_notes (
  date TEXT PRIMARY KEY,                         -- 'YYYY-MM-DD'
  notes TEXT,
  cycle_day INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS therapy_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  therapy_id INTEGER NOT NULL REFERENCES therapies(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                            -- 'YYYY-MM-DD'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(therapy_id, date)
);
CREATE INDEX IF NOT EXISTS idx_therapy_logs_date ON therapy_logs(date);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- "Chip" trackers: editable option lists (ingredients, mood, pain, etc.) that
-- are logged per day by tapping. One row per tracker.
CREATE TABLE IF NOT EXISTS trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'multi',       -- 'multi' (many chips) | 'single' (one choice)
  section TEXT NOT NULL DEFAULT 'food',      -- 'food' | 'feeling'  (where it shows on Today)
  has_intensity INTEGER NOT NULL DEFAULT 0,  -- chips cycle light/medium/strong (e.g. pain)
  icon TEXT,                                 -- optional emoji shown by the title
  hint TEXT,                                 -- optional helper line
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
  intensity INTEGER,                          -- 1..3 when the tracker has_intensity
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tracker_id, option_id, date)
);
CREATE INDEX IF NOT EXISTS idx_tracker_logs_date ON tracker_logs(date);
CREATE INDEX IF NOT EXISTS idx_tracker_logs_tracker ON tracker_logs(tracker_id);

-- Library: reference notes kept off the daily screen — provider contacts,
-- visit notes ("what the doctor said"), tips and recipes. Photos are stored as
-- links (e.g. a Google Drive share URL), keeping the database small & portable.
CREATE TABLE IF NOT EXISTS library_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'tip',   -- 'provider' | 'visit' | 'tip' | 'recipe' | 'other'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  contact TEXT,
  address TEXT,
  image_url TEXT,
  entry_date TEXT,                        -- e.g. the date of a visit
  provider TEXT,                          -- free-text provider name (Dr / NAET / …)
  pinned INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_library_category ON library_entries(category);
`;

function migrate() {
  db.exec(SCHEMA);
}

module.exports = { db, migrate, DB_PATH, DATA_DIR };
