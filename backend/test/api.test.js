const request = require('supertest');
const { freshApp } = require('./testApp');

describe('WellNest API', () => {
  let app;
  let activityId;
  let metricId;
  let trackerId;
  let optionIds;
  let therapyId;
  const DATE = '2026-06-28';

  beforeAll(() => {
    app = freshApp(); // auto-seeded, isolated temp DB
  });

  it('health check responds', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  it('seeds a non-trivial starter catalog', async () => {
    const acts = await request(app).get('/api/activities');
    const mets = await request(app).get('/api/metrics');
    const thers = await request(app).get('/api/therapies');
    const trks = await request(app).get('/api/trackers');
    expect(acts.body.length).toBeGreaterThan(20);
    expect(mets.body.length).toBe(6);
    expect(thers.body.length).toBe(4);
    expect(trks.body.length).toBeGreaterThan(0);

    activityId = acts.body[0].id;
    metricId = mets.body[0].id;
    therapyId = thers.body[0].id;
    trackerId = trks.body.find((t) => t.kind === 'multi' && t.options.length >= 2).id;
    optionIds = trks.body.find((t) => t.id === trackerId).options.map((o) => o.id);
  });

  describe('activity logs', () => {
    it('rejects an unknown status', async () => {
      const r = await request(app).put('/api/logs').send({ activity_id: activityId, date: DATE, status: 'BOGUS' });
      expect(r.status).toBe(400);
    });

    it('sets, reads back, then clears a status', async () => {
      let r = await request(app).put('/api/logs').send({ activity_id: activityId, date: DATE, status: 'DONE' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('DONE');

      const day = await request(app).get(`/api/day/${DATE}`);
      expect(day.body.logs[activityId]).toBe('DONE');

      // clearing (empty status) removes the entry entirely
      r = await request(app).put('/api/logs').send({ activity_id: activityId, date: DATE, status: '' });
      expect(r.status).toBe(200);
      const day2 = await request(app).get(`/api/day/${DATE}`);
      expect(day2.body.logs[activityId]).toBeUndefined();

      // restore for later tests
      await request(app).put('/api/logs').send({ activity_id: activityId, date: DATE, status: 'DONE' });
    });
  });

  describe('symptoms', () => {
    it('clamps out-of-range values into the metric bounds (1-10)', async () => {
      const r = await request(app).put('/api/symptoms').send({ metric_id: metricId, date: DATE, value: 99 });
      expect(r.status).toBe(200);
      expect(r.body.value).toBe(10);
    });

    it('averages repeated readings on the same day (POST = log again)', async () => {
      await request(app).put('/api/symptoms').send({ metric_id: metricId, date: DATE, value: 4 });
      const r = await request(app).post('/api/symptoms').send({ metric_id: metricId, date: DATE, value: 8 });
      expect(r.status).toBe(200);
      expect(r.body.avg).toBe(6);
      expect(r.body.count).toBe(2);
    });

    it('404s for an unknown metric id', async () => {
      const r = await request(app).put('/api/symptoms').send({ metric_id: 999999, date: DATE, value: 5 });
      expect(r.status).toBe(404);
    });
  });

  describe('trackers (chip logging)', () => {
    it('multi-select: selecting a second option keeps the first', async () => {
      await request(app).put('/api/tracker-log').send({ tracker_id: trackerId, option_id: optionIds[0], date: DATE, selected: true });
      await request(app).put('/api/tracker-log').send({ tracker_id: trackerId, option_id: optionIds[1], date: DATE, selected: true });
      const day = await request(app).get(`/api/day/${DATE}`);
      const sel = day.body.trackers[trackerId];
      expect(Object.keys(sel).map(Number).sort()).toEqual([optionIds[0], optionIds[1]].sort());
    });

    it('deselecting removes just that option', async () => {
      await request(app).put('/api/tracker-log').send({ tracker_id: trackerId, option_id: optionIds[0], date: DATE, selected: false });
      const day = await request(app).get(`/api/day/${DATE}`);
      expect(day.body.trackers[trackerId][optionIds[0]]).toBeUndefined();
      expect(day.body.trackers[trackerId][optionIds[1]]).toBeDefined();
    });
  });

  describe('period / cycle', () => {
    it('cycle has no data before any period is logged', async () => {
      const r = await request(app).get('/api/cycle');
      expect(r.body.hasAnyData).toBe(false);
    });

    it('predicts a next period after two logged cycles', async () => {
      const days = ['2026-04-02', '2026-04-03', '2026-04-30', '2026-05-01', '2026-05-28', '2026-05-29'];
      for (const d of days) {
        await request(app).put('/api/period-day').send({ date: d, flow: 'medium' });
      }
      const r = await request(app).get('/api/cycle');
      expect(r.body.hasAnyData).toBe(true);
      expect(r.body.avgCycle).toBeGreaterThan(0);
      expect(r.body.predictedNext).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('therapy notes', () => {
    it('adding a note also marks the therapy done that day', async () => {
      const r = await request(app).put('/api/therapy-note').send({ therapy_id: therapyId, date: DATE, note: 'Felt good' });
      expect(r.status).toBe(200);
      const day = await request(app).get(`/api/day/${DATE}`);
      expect(day.body.therapies).toContain(therapyId);
      expect(day.body.therapyNotes[therapyId]).toBe('Felt good');
    });
  });

  describe('insights', () => {
    it('overview reflects the logged data', async () => {
      const r = await request(app).get(`/api/insights/overview?from=${DATE}&to=${DATE}`);
      expect(r.status).toBe(200);
      expect(r.body.daysLogged).toBeGreaterThanOrEqual(1);
    });

    it('streaks returns one entry per active activity', async () => {
      const acts = await request(app).get('/api/activities');
      const r = await request(app).get('/api/insights/streaks');
      expect(r.body.activities.length).toBe(acts.body.length);
    });
  });

  describe('backup / export / import', () => {
    it('export never includes Drive/Google secrets', async () => {
      // simulate a saved token, then confirm it is stripped from the export
      const dbModule = require('../db');
      dbModule.db.prepare("INSERT INTO settings (key, value) VALUES ('drive_refresh_token', 'super-secret')").run();

      const r = await request(app).get('/api/export/json');
      expect(r.status).toBe(200);
      const keys = r.body.data.settings.map((s) => s.key);
      expect(keys).not.toContain('drive_refresh_token');
    });

    it('round-trips through import without losing data', async () => {
      const before = await request(app).get('/api/export/json');
      const r = await request(app).post('/api/import').send(before.body);
      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);
      expect(r.body.counts.activities).toBeGreaterThan(20);

      const after = await request(app).get(`/api/day/${DATE}`);
      expect(after.body.logs[activityId]).toBe('DONE');
      expect(after.body.therapyNotes[therapyId]).toBe('Felt good');
    });

    it('rejects a malformed import payload with a clear error', async () => {
      const r = await request(app).post('/api/import').send({ not: 'a backup' });
      expect(r.status).toBe(400);
      expect(r.body.error).toBeTruthy();
    });
  });
});
