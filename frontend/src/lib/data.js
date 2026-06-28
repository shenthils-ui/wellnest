// High-level data access used by the screens. Reads fall back to the offline
// cache; writes update the cache, queue to the outbox, and return immediately
// (optimistic). The catalog (activities/metrics/therapies) is managed online
// but cached so the app still renders offline.
import { apiGet, apiPost, apiPut, apiDelete } from './net';
import { cacheGet, cacheSet } from './idb';
import { enqueue, overlayDay } from './sync';

const emptyDay = (date) => ({
  date,
  logs: {},
  symptoms: {},
  therapies: [],
  therapyNotes: {},
  period: null,
  trackers: {},
  notes: null,
  cycle_day: null,
});

/* ------------------------------- CATALOG ------------------------------ */
export async function loadCatalog() {
  try {
    const [activities, metrics, therapies, trackers] = await Promise.all([
      apiGet('/api/activities'),
      apiGet('/api/metrics'),
      apiGet('/api/therapies'),
      apiGet('/api/trackers'),
    ]);
    const catalog = { activities, metrics, therapies, trackers };
    await cacheSet('catalog', catalog);
    return { catalog, fromCache: false };
  } catch (e) {
    const cached = await cacheGet('catalog');
    if (cached) return { catalog: { trackers: [], ...cached }, fromCache: true };
    return { catalog: { activities: [], metrics: [], therapies: [], trackers: [] }, fromCache: true };
  }
}

/* --------------------------------- DAY -------------------------------- */
export async function loadDay(date) {
  let base;
  let fromCache = false;
  try {
    base = await apiGet(`/api/day/${date}`);
    await cacheSet(`day:${date}`, base);
  } catch (e) {
    base = (await cacheGet(`day:${date}`)) || emptyDay(date);
    fromCache = true;
  }
  const merged = await overlayDay(date, base);
  await cacheSet(`day:${date}`, merged);
  return { day: merged, fromCache };
}

// Persist the current optimistic day snapshot to the cache (so an offline
// reload shows the latest), without going to the network.
export async function cacheDay(date, day) {
  await cacheSet(`day:${date}`, day);
}

/* ------------------------- DAILY-DATA MUTATIONS ----------------------- */
export function queueSetLog(date, activity_id, status) {
  return enqueue('log', { date, activity_id, status }, { dedupeKey: `log:${date}:${activity_id}` });
}
export function queueSetSymptom(date, metric_id, value) {
  return enqueue('symptom_set', { date, metric_id, value }, { dedupeKey: `sym:${date}:${metric_id}` });
}
export function queueAddSymptom(date, metric_id, value) {
  // a deliberate extra reading — not deduped
  return enqueue('symptom_add', { date, metric_id, value });
}
export function queueClearSymptom(date, metric_id) {
  return enqueue('symptom_clear', { date, metric_id }, { dedupeKey: `sym:${date}:${metric_id}` });
}
export function queueDayMeta(date, notes, cycle_day) {
  return enqueue('daymeta', { date, notes, cycle_day }, { dedupeKey: `meta:${date}` });
}
export function queueTherapy(date, therapy_id, on) {
  return enqueue(on ? 'therapy_on' : 'therapy_off', { date, therapy_id }, {
    dedupeKey: `ther:${date}:${therapy_id}`,
  });
}
export function queueTherapyNote(date, therapy_id, note) {
  return enqueue('therapy_note', { date, therapy_id, note }, { dedupeKey: `thernote:${date}:${therapy_id}` });
}
export function queuePeriod(date, flow) {
  return enqueue('period_set', { date, flow }, { dedupeKey: `period:${date}` });
}
export function queueSetTracker(date, tracker_id, option_id, selected, { single = false, intensity = null } = {}) {
  // single-select dedupes by tracker (replacing the choice); multi by option
  const dedupeKey = single ? `trk:${date}:${tracker_id}` : `trk:${date}:${tracker_id}:${option_id}`;
  return enqueue('tracker_set', { date, tracker_id, option_id, selected, single, intensity }, { dedupeKey });
}

/* -------------------- CATALOG / SETTINGS MUTATIONS -------------------- */
// These are done at home on the PC; they go straight to the server (and throw
// if offline, so the UI can show a friendly message).
export async function createActivity(body) {
  return apiPost('/api/activities', body);
}
export async function updateActivity(id, body) {
  return apiPut(`/api/activities/${id}`, body);
}
export async function deleteActivity(id, hard = false) {
  return apiDelete(`/api/activities/${id}${hard ? '?hard=1' : ''}`);
}
export async function reorderActivities(order) {
  return apiPost('/api/activities/reorder', { order });
}
export async function createMetric(body) {
  return apiPost('/api/metrics', body);
}
export async function updateMetric(id, body) {
  return apiPut(`/api/metrics/${id}`, body);
}
export async function deleteMetric(id, hard = false) {
  return apiDelete(`/api/metrics/${id}${hard ? '?hard=1' : ''}`);
}
export async function createTracker(body) {
  return apiPost('/api/trackers', body);
}
export async function updateTracker(id, body) {
  return apiPut(`/api/trackers/${id}`, body);
}
export async function deleteTracker(id, hard = false) {
  return apiDelete(`/api/trackers/${id}${hard ? '?hard=1' : ''}`);
}
export async function reorderTrackers(order) {
  return apiPost('/api/trackers/reorder', { order });
}
export async function addTrackerOption(trackerId, label, emoji) {
  return apiPost(`/api/trackers/${trackerId}/options`, { label, emoji });
}
export async function updateTrackerOption(trackerId, optionId, body) {
  return apiPut(`/api/trackers/${trackerId}/options/${optionId}`, body);
}
export async function deleteTrackerOption(trackerId, optionId, hard = false) {
  return apiDelete(`/api/trackers/${trackerId}/options/${optionId}${hard ? '?hard=1' : ''}`);
}
export const getLookback = (params) => {
  const qs = new URLSearchParams(params).toString();
  return apiGet(`/api/insights/lookback?${qs}`);
};

export async function createTherapy(body) {
  return apiPost('/api/therapies', body);
}
export async function updateTherapy(id, body) {
  return apiPut(`/api/therapies/${id}`, body);
}
export async function deleteTherapy(id, hard = false) {
  return apiDelete(`/api/therapies/${id}${hard ? '?hard=1' : ''}`);
}

/* ------------------------------ INSIGHTS ------------------------------ */
export const getActivityInsights = (from, to) =>
  apiGet(`/api/insights/activities?from=${from}&to=${to}`);
export const getSymptomInsights = (from, to) =>
  apiGet(`/api/insights/symptoms?from=${from}&to=${to}`);
export const getCorrelation = (activity_id, metric_id, from, to) =>
  apiGet(`/api/insights/correlation?activity_id=${activity_id}&metric_id=${metric_id}&from=${from}&to=${to}`);
export const getCorrelationScan = (from, to) =>
  apiGet(`/api/insights/correlation/scan?from=${from}&to=${to}`);
export const getStreaks = () => apiGet('/api/insights/streaks');
export const getOverview = (from, to) => apiGet(`/api/insights/overview?from=${from}&to=${to}`);
export const getTherapyLogs = (from, to) => apiGet(`/api/therapy-logs?from=${from}&to=${to}`);
export const getTrackerSummary = (from, to) => apiGet(`/api/insights/tracker-summary?from=${from}&to=${to}`);
export async function getCycle() {
  try {
    const c = await apiGet('/api/cycle');
    await cacheSet('cycle', c);
    return c;
  } catch (e) {
    return (await cacheGet('cycle')) || { enoughData: false, hasAnyData: false, avgCycle: 28, periodDays: [], starts: [] };
  }
}
export const getCalendar = (from, to) => apiGet(`/api/insights/calendar?from=${from}&to=${to}`);

// Calendar for a whole year, cached so History still shows (stale) data offline.
export async function loadCalendarYear(year) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  try {
    const r = await apiGet(`/api/insights/calendar?from=${from}&to=${to}`);
    await cacheSet(`cal:${year}`, r);
    return { data: r, fromCache: false };
  } catch (e) {
    const cached = await cacheGet(`cal:${year}`);
    return { data: cached || { perDay: [] }, fromCache: true };
  }
}

/* ------------------------------ LIBRARY ------------------------------- */
// Reference notes (providers, visit notes, tips, recipes). Cached for offline
// reading — handy for a recipe while shopping or a clinic address on the go.
export async function getLibrary() {
  try {
    const rows = await apiGet('/api/library');
    await cacheSet('library', rows);
    return { rows, fromCache: false };
  } catch (e) {
    const cached = await cacheGet('library');
    return { rows: cached || [], fromCache: true };
  }
}
export async function createLibraryEntry(body) {
  const row = await apiPost('/api/library', body);
  return row;
}
export async function updateLibraryEntry(id, body) {
  return apiPut(`/api/library/${id}`, body);
}
export async function deleteLibraryEntry(id) {
  return apiDelete(`/api/library/${id}`);
}

/* ---------------------------- GOOGLE DRIVE ---------------------------- */
export const getDriveStatus = () => apiGet('/api/drive/status');
export const saveDriveConfig = (client_id, client_secret) => apiPost('/api/drive/config', { client_id, client_secret });
export const backupToDrive = () => apiPost('/api/drive/backup', {});
export const setDriveAuto = (enabled) => apiPost('/api/drive/auto', { enabled });
export const disconnectDrive = () => apiPost('/api/drive/disconnect', {});

/* ------------------------------- BACKUP ------------------------------- */
export const exportJsonUrl = () => '/api/export/json';
export const exportCsvUrl = (type) => `/api/export/csv?type=${type}`;
export async function importBackup(payload) {
  return apiPost('/api/import', payload);
}
