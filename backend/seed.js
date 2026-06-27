'use strict';

// Seeds the database with the starter routine. Safe to run multiple times:
// it only inserts rows when a table is empty, so it never duplicates or
// overwrites the user's edits/history.

const { db, migrate } = require('./db');
const { METRICS, ACTIVITIES, THERAPIES } = require('./seedData');

function seed({ silent = false } = {}) {
  migrate();

  const log = (...a) => { if (!silent) console.log(...a); };

  const result = { metrics: 0, activities: 0, therapies: 0 };

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
  });

  seedAll();

  log(`WellNest seed complete:`);
  log(`  metrics inserted:    ${result.metrics}`);
  log(`  activities inserted: ${result.activities}`);
  log(`  therapies inserted:  ${result.therapies}`);
  if (result.metrics === 0 && result.activities === 0 && result.therapies === 0) {
    log('  (database already had data — nothing changed)');
  }
  return result;
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
