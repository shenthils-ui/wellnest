// Thin IndexedDB wrapper. Holds the offline outbox (queued writes) and a cache
// of GET responses so the app works fully offline on the phone.
import { openDB } from 'idb';

const DB_NAME = 'wellnest';
const DB_VERSION = 1;

let _dbPromise = null;
function getDB() {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return _dbPromise;
}

/* ---- cache ---- */
export async function cacheGet(key) {
  const db = await getDB();
  const row = await db.get('cache', key);
  return row ? row.value : undefined;
}
export async function cacheSet(key, value) {
  const db = await getDB();
  await db.put('cache', { key, value, ts: Date.now() });
}

/* ---- meta (small key/values) ---- */
export async function metaGet(key) {
  const db = await getDB();
  const row = await db.get('meta', key);
  return row ? row.value : undefined;
}
export async function metaSet(key, value) {
  const db = await getDB();
  await db.put('meta', { key, value });
}

/* ---- outbox ---- */
export async function outboxAll() {
  const db = await getDB();
  return db.getAll('outbox'); // sorted by id (insertion order)
}
export async function outboxAdd(item) {
  const db = await getDB();
  const id = await db.add('outbox', { ...item, ts: Date.now() });
  return id;
}
export async function outboxDelete(id) {
  const db = await getDB();
  await db.delete('outbox', id);
}
export async function outboxDeleteByDedupe(dedupeKey) {
  if (!dedupeKey) return;
  const db = await getDB();
  const tx = db.transaction('outbox', 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.dedupeKey === dedupeKey) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}
export async function outboxCount() {
  const db = await getDB();
  return db.count('outbox');
}
