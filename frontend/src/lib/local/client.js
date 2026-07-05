// Standalone (on-device) client: boots the sql.js engine, restores/saves the
// database to IndexedDB, and answers API calls locally. Loaded only in the
// standalone build (dynamically imported by net.js), so sql.js never ships in
// the server build.
import { openDB } from 'idb';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { initEngine } from './engine.js';

const IDB_NAME = 'wellnest-local';
const STORE = 'kv';
const KEY = 'sqlite-db';

function kv() {
  return openDB(IDB_NAME, 1, {
    upgrade(d) { if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE); },
  });
}

let enginePromise = null;
let engine = null;
let saveTimer = null;
let saving = null;

async function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      let dbBytes;
      try { dbBytes = await (await kv()).get(STORE, KEY); } catch { /* first run */ }
      engine = await initEngine({ wasmUrl, dbBytes });
      return engine;
    })();
  }
  return enginePromise;
}

async function persist() {
  try {
    const bytes = engine.exportBytes();
    await (await kv()).put(STORE, bytes, KEY);
  } catch (e) {
    console.warn('WellNest: could not save local database', e);
  }
}
function schedulePersist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saving = persist(); }, 350);
}

// Flush pending writes to storage (e.g. before the page is hidden/closed).
export async function flushLocal() {
  clearTimeout(saveTimer);
  if (engine) await persist();
  if (saving) await saving;
}

export async function localCall(method, path, body) {
  const eng = await getEngine();
  const res = eng.handle(method, path, body || {});
  if (method !== 'GET') schedulePersist();
  return res; // { status, body }
}

// Full JSON export as a string (used by the standalone download button).
export async function localExportJson() {
  const eng = await getEngine();
  return JSON.stringify(eng.handle('GET', '/api/export/json').body, null, 2);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushLocal(); });
  window.addEventListener('pagehide', () => { flushLocal(); });
}
