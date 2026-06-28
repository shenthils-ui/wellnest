'use strict';

// Seeds the database with the starter routine. Safe to run multiple times:
// it only inserts rows when a table is empty, so it never duplicates or
// overwrites the user's edits/history.

const { db, migrate } = require('./db');
const { METRICS, ACTIVITIES, THERAPIES, TRACKERS } = require('./seedData');

function seed({ silent = false } = {}) {
  migrate();

  const log = (...a) => { if (!silent) console.log(...a); };

  const result = { metrics: 0, activities: 0, therapies: 0, trackers: 0 };

  const seedAll = db.transaction(() => {
    // Metrics
    const metricCount = db.prepare('SELECT COUNT(*) c FROM metrics').get().c;
    if (metricCount === 0) {
      const insM = db.prepare(
        `INSERT INTO metrics (key, name, good_direction, min_value, max_value, time_hint, display_order, active)
         VALUES (@key, @name, @good_direction, 1, 10, @time_hint, @display_order, 1)`
      );
      METRICS.forEach((m, i) => insM.run({ ...m, display_order: i }));
      result.metrics = METRICS.length;
    }

    // Activities
    const actCount = db.prepare('SELECT COUNT(*) c FROM activities').get().c;
    if (actCount === 0) {
      const insA = db.prepare(
        `INSERT INTO activities (name, time_block, is_husband_task, expected_days, display_order, active)
         VALUES (@name, @time_block, @is_husband_task, @expected_days, @display_order, 1)`
      );
      ACTIVITIES.forEach(([name, time_block, is_husband_task, expected_days], i) => {
        insA.run({ name, time_block, is_husband_task, expected_days, display_order: i });
      });
      result.activities = ACTIVITIES.length;
    }

    // Therapies
    const thCount = db.prepare('SELECT COUNT(*) c FROM therapies').get().c;
    if (thCount === 0) {
      const insT = db.prepare(
        `INSERT INTO therapies (name, cadence_days, display_order, active)
         VALUES (@name, @cadence_days, @display_order, 1)`
      );
      THERAPIES.forEach(([name, cadence_days], i) => {
        insT.run({ name, cadence_days, display_order: i });
      });
      result.therapies = THERAPIES.length;
    }

    // Trackers (+ their options)
    const trkCount = db.prepare('SELECT COUNT(*) c FROM trackers').get().c;
    if (trkCount === 0) {
      const insTr = db.prepare(
        `INSERT INTO trackers (name, kind, section, has_intensity, icon, hint, display_order, active)
         VALUES (@name, @kind, @section, @has_intensity, @icon, @hint, @display_order, 1)`
      );
      const insOpt = db.prepare(
        `INSERT INTO tracker_options (tracker_id, label, emoji, display_order, active)
         VALUES (?, ?, ?, ?, 1)`
      );
      TRACKERS.forEach((t, i) => {
        const info = insTr.run({
          name: t.name,
          kind: t.kind || 'multi',
          section: t.section || 'food',
          has_intensity: t.has_intensity ? 1 : 0,
          icon: t.icon || null,
          hint: t.hint || null,
          display_order: i,
        });
        (t.options || []).forEach((opt, j) => {
          const [label, emoji] = Array.isArray(opt) ? opt : [opt, null];
          insOpt.run(info.lastInsertRowid, label, emoji, j);
        });
      });
      result.trackers = TRACKERS.length;
    }
  });

  seedAll();
  ensureExtras();

  log(`WellNest seed complete:`);
  log(`  metrics inserted:    ${result.metrics}`);
  log(`  activities inserted: ${result.activities}`);
  log(`  therapies inserted:  ${result.therapies}`);
  log(`  trackers inserted:   ${result.trackers}`);
  if (!result.metrics && !result.activities && !result.therapies && !result.trackers) {
    log('  (database already had data — nothing changed)');
  }
  return result;
}

// Idempotent top-ups for databases seeded before a feature existed. Safe to run
// every start: each step only acts when its item is missing.
function ensureExtras() {
  // Make sure "Oil pulling" exists and sits first in Early morning.
  const exists = db
    .prepare("SELECT id FROM activities WHERE name = 'Oil pulling' COLLATE NOCASE")
    .get();
  if (!exists) {
    const min = db
      .prepare("SELECT COALESCE(MIN(display_order), 0) m FROM activities WHERE time_block = 'EARLY_MORNING'")
      .get().m;
    db.prepare(
      `INSERT INTO activities (name, time_block, is_husband_task, expected_days, display_order, active)
       VALUES ('Oil pulling', 'EARLY_MORNING', 0, NULL, ?, 1)`
    ).run(min - 1);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
