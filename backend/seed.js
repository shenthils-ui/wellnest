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

  // Starter provider cards in the Library (only if it's empty), ready to fill in.
  const libCount = db.prepare('SELECT COUNT(*) c FROM library_entries').get().c;
  if (libCount === 0) {
    const insL = db.prepare(
      `INSERT INTO library_entries (category, title, provider, pinned, display_order)
       VALUES ('provider', ?, ?, 1, ?)`
    );
    ['Doctor', 'NAET', 'Hyperbaric', 'Osteopath'].forEach((name, i) => insL.run(name, name, i));
  }

  applyContentV2();
}

// One-time content tidy-up (runs once per database, guarded by a settings flag),
// so existing installs pick up the routine/tracker changes without manual edits.
function applyContentV2() {
  const done = db.prepare("SELECT value FROM settings WHERE key = 'content_v2'").get();
  if (done) return;

  const tx = db.transaction(() => {
    const retireAct = db.prepare("UPDATE activities SET active = 0 WHERE name = ? COLLATE NOCASE AND active = 1");
    retireAct.run('Prepare Salad #2');
    retireAct.run('Remove castor oil pack');
    retireAct.run('Light activity/reading');

    // Castor oil pack lives in the evening; drop the "Apply" wording.
    db.prepare(
      "UPDATE activities SET name = 'Castor oil pack', time_block = 'EVENING' WHERE name = 'Apply castor oil pack'"
    ).run();

    // Tracker renames
    const renameTrk = db.prepare('UPDATE trackers SET name = ?, hint = ? WHERE name = ? COLLATE NOCASE');
    renameTrk.run('Snacks', 'Nuts, seeds and other snacks.', 'Nuts & seeds');
    renameTrk.run('Lunch — vegetables', 'What lunch contained.', 'Salad vegetables');
    renameTrk.run('Lunch — cooking style', null, 'Cooking style');

    // Add Dinner trackers if missing
    const VEG = ['Zucchini', 'Paprika', 'Onion', 'Avocado', 'Cucumber', 'Tomato',
      'Carrot', 'Beetroot', 'Lettuce', 'Spinach', 'Lentils', 'Lemon', 'Coconut'];
    const COOKING = ['Fresh / raw', 'Steamed', 'Cooked', 'Fried'];
    const addTracker = (name, kind, icon, hint, options) => {
      const exists = db.prepare('SELECT id FROM trackers WHERE name = ? COLLATE NOCASE').get(name);
      if (exists) return;
      const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order), -1) m FROM trackers').get().m;
      const info = db.prepare(
        `INSERT INTO trackers (name, kind, section, has_intensity, icon, hint, display_order, active)
         VALUES (?, ?, 'food', 0, ?, ?, ?, 1)`
      ).run(name, kind, icon, hint, maxOrder + 1);
      const insOpt = db.prepare('INSERT INTO tracker_options (tracker_id, label, emoji, display_order, active) VALUES (?, ?, NULL, ?, 1)');
      options.forEach((o, i) => insOpt.run(info.lastInsertRowid, o, i));
    };
    addTracker('Dinner — vegetables', 'multi', '🍽️', 'What dinner contained.', VEG);
    addTracker('Dinner — cooking style', 'single', '🍳', null, COOKING);

    // Order food trackers sensibly: juice, lunch (veg, cooking), dinner (veg, cooking), snacks, drinks
    const order = ['Green juice ingredients', 'Lunch — vegetables', 'Lunch — cooking style',
      'Dinner — vegetables', 'Dinner — cooking style', 'Snacks', 'Other drinks'];
    const setOrder = db.prepare('UPDATE trackers SET display_order = ? WHERE name = ? COLLATE NOCASE');
    order.forEach((name, i) => setOrder.run(i, name));

    // Reorder symptoms: Sleep, Energy, Morning Mood, Evening Pain, Evening Mood, Stress
    const metricOrder = ['sleep', 'energy', 'mood_am', 'pain', 'mood_pm', 'stress'];
    const setMetric = db.prepare('UPDATE metrics SET display_order = ? WHERE key = ?');
    metricOrder.forEach((key, i) => setMetric.run(i, key));

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('content_v2', '1')").run();
  });
  tx();
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
