'use strict';

// Shared full-database export, used by the JSON download and the Drive backup.
// Secrets (Google Drive tokens / client secret) are stripped so they never end
// up inside a backup file.
const { db } = require('./db');

const TABLES = [
  'activities',
  'metrics',
  'therapies',
  'trackers',
  'tracker_options',
  'activity_logs',
  'symptom_entries',
  'daily_notes',
  'therapy_logs',
  'tracker_logs',
  'library_entries',
  'period_days',
  'settings',
];

const SECRET_PREFIXES = ['drive_', 'google_'];

function dumpAll() {
  const data = {};
  for (const t of TABLES) {
    let rows = db.prepare(`SELECT * FROM ${t}`).all();
    if (t === 'settings') {
      rows = rows.filter((r) => !SECRET_PREFIXES.some((p) => String(r.key).startsWith(p)));
    }
    data[t] = rows;
  }
  return { app: 'WellNest', version: 1, exportedAt: new Date().toISOString(), data };
}

module.exports = { dumpAll, TABLES };
