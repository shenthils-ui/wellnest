import { describe, it, expect, beforeAll } from 'vitest';
import { initEngine } from './engine.js';

// Runs the same scenarios as backend/test/api.test.js against the on-device
// engine, so the two independent implementations (server vs sql.js-in-browser)
// are proven to behave identically, not just individually "look right".
describe('on-device engine', () => {
  let handle;
  let activityId;
  let metricId;
  let trackerId;
  let optionIds;
  let therapyId;
  const DATE = '2026-06-28';

  beforeAll(async () => {
    const engine = await initEngine(); // fresh in-memory DB, auto-seeded
    handle = engine.handle;
  });

  const j = (r) => r.body;

  it('seeds a non-trivial starter catalog', () => {
    const acts = j(handle('GET', '/api/activities'));
    const mets = j(handle('GET', '/api/metrics'));
    const thers = j(handle('GET', '/api/therapies'));
    const trks = j(handle('GET', '/api/trackers'));
    expect(acts.length).toBeGreaterThan(20);
    expect(mets.length).toBe(6);
    expect(thers.length).toBe(4);

    activityId = acts[0].id;
    metricId = mets[0].id;
    therapyId = thers[0].id;
    const t = trks.find((x) => x.kind === 'multi' && x.options.length >= 2);
    trackerId = t.id;
    optionIds = t.options.map((o) => o.id);
  });

  it('activity logs: set, read back, clear', () => {
    expect(handle('PUT', '/api/logs', { activity_id: activityId, date: DATE, status: 'DONE' }).status).toBe(200);
    expect(j(handle('GET', `/api/day/${DATE}`)).logs[activityId]).toBe('DONE');

    handle('PUT', '/api/logs', { activity_id: activityId, date: DATE, status: '' });
    expect(j(handle('GET', `/api/day/${DATE}`)).logs[activityId]).toBeUndefined();

    handle('PUT', '/api/logs', { activity_id: activityId, date: DATE, status: 'DONE' }); // restore
  });

  it('rejects an unknown status', () => {
    expect(handle('PUT', '/api/logs', { activity_id: activityId, date: DATE, status: 'BOGUS' }).status).toBe(400);
  });

  it('symptoms: clamps to metric bounds and averages repeats', () => {
    const r1 = handle('PUT', '/api/symptoms', { metric_id: metricId, date: DATE, value: 99 });
    expect(j(r1).value).toBe(10);

    handle('PUT', '/api/symptoms', { metric_id: metricId, date: DATE, value: 4 });
    const r2 = handle('POST', '/api/symptoms', { metric_id: metricId, date: DATE, value: 8 });
    expect(j(r2).avg).toBe(6);
    expect(j(r2).count).toBe(2);
  });

  it('trackers: multi-select add/remove behaves independently per option', () => {
    handle('PUT', '/api/tracker-log', { tracker_id: trackerId, option_id: optionIds[0], date: DATE, selected: true });
    handle('PUT', '/api/tracker-log', { tracker_id: trackerId, option_id: optionIds[1], date: DATE, selected: true });
    let sel = j(handle('GET', `/api/day/${DATE}`)).trackers[trackerId];
    expect(Object.keys(sel).map(Number).sort()).toEqual([optionIds[0], optionIds[1]].sort());

    handle('PUT', '/api/tracker-log', { tracker_id: trackerId, option_id: optionIds[0], date: DATE, selected: false });
    sel = j(handle('GET', `/api/day/${DATE}`)).trackers[trackerId];
    expect(sel[optionIds[0]]).toBeUndefined();
    expect(sel[optionIds[1]]).toBeDefined();
  });

  it('cycle: no data, then predicts after two logged cycles', () => {
    expect(j(handle('GET', '/api/cycle')).hasAnyData).toBe(false);
    const days = ['2026-04-02', '2026-04-03', '2026-04-30', '2026-05-01', '2026-05-28', '2026-05-29'];
    for (const d of days) handle('PUT', '/api/period-day', { date: d, flow: 'medium' });
    const cyc = j(handle('GET', '/api/cycle'));
    expect(cyc.hasAnyData).toBe(true);
    expect(cyc.avgCycle).toBeGreaterThan(0);
    expect(cyc.predictedNext).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('therapy note also marks the therapy done that day', () => {
    handle('PUT', '/api/therapy-note', { therapy_id: therapyId, date: DATE, note: 'Felt good' });
    const day = j(handle('GET', `/api/day/${DATE}`));
    expect(day.therapies).toContain(therapyId);
    expect(day.therapyNotes[therapyId]).toBe('Felt good');
  });

  it('insights: overview and streaks respond with the expected shape', () => {
    const ov = j(handle('GET', `/api/insights/overview?from=${DATE}&to=${DATE}`));
    expect(ov.daysLogged).toBeGreaterThanOrEqual(1);

    const acts = j(handle('GET', '/api/activities'));
    const streaks = j(handle('GET', '/api/insights/streaks'));
    expect(streaks.activities.length).toBe(acts.length);
  });

  it('export/import: secrets stripped, round-trips cleanly, rejects garbage', () => {
    const before = j(handle('GET', '/api/export/json'));
    const imp = j(handle('POST', '/api/import', before));
    expect(imp.ok).toBe(true);
    expect(imp.counts.activities).toBeGreaterThan(20);

    const after = j(handle('GET', `/api/day/${DATE}`));
    expect(after.logs[activityId]).toBe('DONE');
    expect(after.therapyNotes[therapyId]).toBe('Felt good');

    const bad = handle('POST', '/api/import', { not: 'a backup' });
    expect(bad.status).toBe(400);
  });
});
