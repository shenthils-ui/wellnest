'use strict';

// Initial seed content for WellNest. Husband-prepared items are flagged with
// is_husband_task and the "(husband)" suffix is dropped from the display name
// because the UI shows a badge instead.
//
// expected_days uses JS weekday numbers: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu,
// 5=Fri, 6=Sat. null means "every day".

const METRICS = [
  { key: 'energy',  name: 'Morning Energy', good_direction: 'high', time_hint: 'morning' },
  { key: 'sleep',   name: 'Sleep Quality',  good_direction: 'high', time_hint: 'morning' },
  { key: 'mood_am', name: 'Morning Mood',   good_direction: 'high', time_hint: 'morning' },
  { key: 'pain',    name: 'Evening Pain',   good_direction: 'low',  time_hint: 'evening' },
  { key: 'mood_pm', name: 'Evening Mood',   good_direction: 'high', time_hint: 'evening' },
  { key: 'stress',  name: 'Stress',         good_direction: 'low',  time_hint: 'anytime' },
];

// [name, time_block, is_husband_task, expected_days]
const ACTIVITIES = [
  // EARLY_MORNING
  ['Lemon + sodium bicarbonate shot', 'EARLY_MORNING', 0, null],
  ['Prepare bicarbonate water for the day', 'EARLY_MORNING', 1, null],
  ['Shilajit drink', 'EARLY_MORNING', 0, null],
  ['Yoga 30 min', 'EARLY_MORNING', 0, null],
  ['Ointment - Morning', 'EARLY_MORNING', 0, null],
  ['Trampoline #1 (5 min)', 'EARLY_MORNING', 0, null],

  // MID_MORNING
  ['Breakfast/Salad #1', 'MID_MORNING', 0, null],
  ['Hemp drops', 'MID_MORNING', 0, null],
  ['Apply castor oil pack', 'MID_MORNING', 0, null],
  ['Microgreens care/cut (30 min)', 'MID_MORNING', 0, null],
  ['Walking outside (60-90 min)', 'MID_MORNING', 0, null],
  ['Green juice', 'MID_MORNING', 0, '1,3,5,0'], // Mon/Wed/Fri/Sun
  ['Trampoline #2 (5 min)', 'MID_MORNING', 0, null],

  // MIDDAY
  ['Prepare Salad #2', 'MIDDAY', 1, null],
  ['Lunch (~12:00)', 'MIDDAY', 0, null],
  ['Quiet rest 30 min', 'MIDDAY', 0, null],
  ['Reading time', 'MIDDAY', 0, null],

  // AFTERNOON
  ['Trampoline #3 (5 min)', 'AFTERNOON', 0, null],
  ['Light activity/reading', 'AFTERNOON', 0, null],
  ['Trampoline #4 (5 min)', 'AFTERNOON', 0, null],

  // EVENING
  ['Dinner ~18:00-19:00', 'EVENING', 1, null],
  ['Ointment - Evening', 'EVENING', 0, null],
  ['Remove castor oil pack', 'EVENING', 0, null],
  ['Wind-down activity', 'EVENING', 0, null],
  ['Sleep by 21:30-22:00', 'EVENING', 0, null],
];

// [name, cadence_days]
const THERAPIES = [
  ['Hyperbaric', 7],
  ['NAET', 7],
  ['Osteopathic', 7],
  ['Hospital visit', 14],
];

const TIME_BLOCKS = ['EARLY_MORNING', 'MID_MORNING', 'MIDDAY', 'AFTERNOON', 'EVENING'];

module.exports = { METRICS, ACTIVITIES, THERAPIES, TIME_BLOCKS };
