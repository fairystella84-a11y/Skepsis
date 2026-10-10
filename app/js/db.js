// Local-first storage on IndexedDB.
//
// Stores:
//   meta    key/value: settings, keyring
//   entries id, type, mood, emotions [{id, intensity}], tagIds, exerciseId,
//           secret (encrypted {title, body, answers}), created_at, updated_at, deleted_at
//   tags    id, color, secret (encrypted {name}), updated_at, deleted_at
//
// Every record carries updated_at / deleted_at (soft delete) so a future sync
// can send whatever changed since the last sync.

const DB_NAME = 'skepsis';
const DB_VERSION = 1;
let dbPromise = null;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('meta');
      const entries = db.createObjectStore('entries', { keyPath: 'id' });
      entries.createIndex('created_at', 'created_at');
      db.createObjectStore('tags', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbPromise;
}

async function store(name, mode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function getMeta(key) {
  return req((await store('meta')).get(key));
}

export async function setMeta(key, value) {
  return req((await store('meta', 'readwrite')).put(value, key));
}

export async function put(name, record) {
  record.updated_at = new Date().toISOString();
  await req((await store(name, 'readwrite')).put(record));
  return record;
}

export async function get(name, id) {
  return req((await store(name)).get(id));
}

export async function all(name, { includeDeleted = false } = {}) {
  const rows = await req((await store(name)).getAll());
  return includeDeleted ? rows : rows.filter((r) => !r.deleted_at);
}

export async function softDelete(name, id) {
  const rec = await get(name, id);
  if (!rec) return;
  rec.deleted_at = new Date().toISOString();
  return put(name, rec);
}

// Permanent deletion of everything on this device.
export async function wipe() {
  const db = await open();
  db.close();
  dbPromise = null;
  await req(indexedDB.deleteDatabase(DB_NAME));
}
