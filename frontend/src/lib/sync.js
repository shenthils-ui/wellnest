// Offline-first sync engine.
//
// Every daily-data write becomes a mutation that is (1) applied optimistically
// in the UI, (2) written to the IndexedDB cache, and (3) queued in the outbox.
// The engine drains the outbox to the server whenever it's reachable, and
// exposes a subscribable status for the sync indicator.
import { outboxAdd, outboxAll, outboxDelete, outboxDeleteByDedupe, metaGet, metaSet } from './idb';
import { apiGet, apiPost, apiPut, apiDelete, NetworkError, HttpError } from './net';

const status = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  reachable: true, // assume reachable until a send proves otherwise
  syncing: false,
  pending: 0,
  lastSyncAt: null,
  error: null,
};

const listeners = new Set();
function emit() {
  for (const cb of listeners) cb({ ...status });
}
export function subscribeSync(cb) {
  listeners.add(cb);
  cb({ ...status });
  return () => listeners.delete(cb);
}
export function getStatus() {
  return { ...status };
}

// Map a queued mutation to its HTTP request.
function send(item) {
  const p = item.payload;
  switch (item.kind) {
    case 'log':
      return apiPut('/api/logs', { activity_id: p.activity_id, date: p.date, status: p.status });
    case 'symptom_set':
      return apiPut('/api/symptoms', { metric_id: p.metric_id, date: p.date, value: p.value });
    case 'symptom_add':
      return apiPost('/api/symptoms', { metric_id: p.metric_id, date: p.date, value: p.value });
    case 'symptom_clear':
      return apiDelete('/api/symptoms', { metric_id: p.metric_id, date: p.date });
    case 'daymeta':
      return apiPut('/api/day-meta', { date: p.date, notes: p.notes, cycle_day: p.cycle_day });
    case 'therapy_on':
      return apiPost('/api/therapy-logs', { therapy_id: p.therapy_id, date: p.date });
    case 'therapy_off':
      return apiDelete('/api/therapy-logs', { therapy_id: p.therapy_id, date: p.date });
    case 'tracker_set':
      return apiPut('/api/tracker-log', {
        tracker_id: p.tracker_id, option_id: p.option_id, date: p.date,
        selected: p.selected, single: p.single, intensity: p.intensity,
      });
    case 'request': // generic (catalog/settings CRUD)
      if (p.method === 'POST') return apiPost(p.path, p.body);
      if (p.method === 'PUT') return apiPut(p.path, p.body);
      if (p.method === 'DELETE') return apiDelete(p.path, p.body);
      return apiGet(p.path);
    default:
      return Promise.resolve();
  }
}

let draining = false;
let drainQueued = false;

export async function drain() {
  if (draining) { drainQueued = true; return; }
  draining = true;
  status.syncing = true;
  status.error = null;
  emit();

  try {
    let items = await outboxAll();
    status.pending = items.length;
    emit();

    for (const item of items) {
      try {
        await send(item);
        await outboxDelete(item.id);
        status.reachable = true;
        status.pending = Math.max(0, status.pending - 1);
        emit();
      } catch (e) {
        if (e instanceof NetworkError) {
          // server unreachable — stop, keep the rest queued, try again later
          status.reachable = false;
          status.error = 'offline';
          break;
        } else if (e instanceof HttpError && e.status >= 400 && e.status < 500) {
          // a bad/rejected write would never succeed — drop it so it can't block the queue
          console.warn('Dropping rejected mutation', item, e.body);
          await outboxDelete(item.id);
          status.pending = Math.max(0, status.pending - 1);
          emit();
        } else {
          // 5xx / unknown — leave queued, retry later
          status.error = 'server';
          break;
        }
      }
    }

    if (status.pending === 0) {
      status.lastSyncAt = Date.now();
      await metaSet('lastSyncAt', status.lastSyncAt);
    }
  } finally {
    status.syncing = false;
    draining = false;
    emit();
    if (drainQueued) { drainQueued = false; drain(); }
  }
}

// Queue a mutation (deduping idempotent ones), then kick a drain.
export async function enqueue(kind, payload, { dedupeKey = null } = {}) {
  if (dedupeKey) await outboxDeleteByDedupe(dedupeKey);
  await outboxAdd({ kind, payload, dedupeKey });
  drain();
}

export async function refreshPending() {
  const items = await outboxAll();
  status.pending = items.length;
  emit();
}

// Wire up connectivity triggers once.
let started = false;
export async function startSync() {
  if (started) return;
  started = true;
  status.lastSyncAt = (await metaGet('lastSyncAt')) || null;
  await refreshPending();

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      status.online = true;
      emit();
      drain();
    });
    window.addEventListener('offline', () => {
      status.online = false;
      status.reachable = false;
      emit();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') drain();
    });
    // periodic retry while anything is pending
    setInterval(() => {
      if (status.pending > 0) drain();
    }, 20000);
  }
  drain();
}

// Apply still-pending outbox mutations on top of a freshly fetched day, so
// unsynced optimistic edits don't flash back to the server's older state.
export async function overlayDay(date, day) {
  const items = await outboxAll();
  const d = {
    logs: { ...(day.logs || {}) },
    symptoms: { ...(day.symptoms || {}) },
    therapies: [...(day.therapies || [])],
    trackers: JSON.parse(JSON.stringify(day.trackers || {})),
    notes: day.notes ?? null,
    cycle_day: day.cycle_day ?? null,
    date,
  };
  for (const item of items) {
    const p = item.payload;
    if (!p || p.date !== date) continue;
    switch (item.kind) {
      case 'log':
        if (p.status == null) delete d.logs[p.activity_id];
        else d.logs[p.activity_id] = p.status;
        break;
      case 'symptom_set':
        d.symptoms[p.metric_id] = { avg: p.value, count: 1, value: p.value };
        break;
      case 'symptom_add': {
        const prev = d.symptoms[p.metric_id];
        if (prev) {
          const count = (prev.count || 1) + 1;
          const avg = Math.round(((prev.avg * (count - 1) + p.value) / count) * 10) / 10;
          d.symptoms[p.metric_id] = { avg, count, value: p.value };
        } else {
          d.symptoms[p.metric_id] = { avg: p.value, count: 1, value: p.value };
        }
        break;
      }
      case 'symptom_clear':
        delete d.symptoms[p.metric_id];
        break;
      case 'daymeta':
        d.notes = p.notes ?? null;
        d.cycle_day = p.cycle_day ?? null;
        break;
      case 'therapy_on':
        if (!d.therapies.includes(p.therapy_id)) d.therapies.push(p.therapy_id);
        break;
      case 'therapy_off':
        d.therapies = d.therapies.filter((t) => t !== p.therapy_id);
        break;
      case 'tracker_set': {
        const t = String(p.tracker_id);
        if (p.single) d.trackers[t] = {};
        if (!d.trackers[t]) d.trackers[t] = {};
        if (p.selected === false) delete d.trackers[t][p.option_id];
        else d.trackers[t][p.option_id] = { intensity: p.intensity ?? null };
        if (Object.keys(d.trackers[t]).length === 0) delete d.trackers[t];
        break;
      }
      default:
        break;
    }
  }
  return d;
}
