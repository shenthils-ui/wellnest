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
  notes: null,
  cycle_day: null,
});

/* ------------------------------- CATALOG ------------------------------ */
export async function loadCatalog() {
  try {
    const [activities, metrics, therapies] = await Promise.all([
      apiGet('/api/activities'),
      apiGet('/api/metrics'),
      apiGet('/api/therapies'),
    ]);
    const catalog = { activities, metrics, therapies };
    await cacheSet('catalog', catalog);
    return { catalog, fromCache: false };
  } catch (e) {
    const cached = await cacheGet('catalog');
    if (cached) return { catalog: cached, fromCache: true };
    return { catalog: { activities: [], metrics: [], therapies: [] }, fromCache: true };
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

/* ------------------------------- BACKUP ------------------------------- */
export const exportJsonUrl = () => '/api/export/json';
export const exportCsvUrl = (type) => `/api/export/csv?type=${type}`;
export async function importBackup(payload) {
  return apiPost('/api/import', payload);
}
