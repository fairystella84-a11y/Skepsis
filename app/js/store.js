// In-memory state on top of the encrypted local database. Plaintext lives
// only here, and only while the app is unlocked.

import * as db from './db.js';
import * as kc from './crypto.js';

export const state = {
  settings: { lang: 'el', theme: 'system', autoLock: true, onboarded: false },
  masterKey: null,
  keyring: null,
  entries: [], // decrypted, newest first
  tags: [], // decrypted
};

export async function loadSettings() {
  const s = await db.getMeta('settings');
  if (s) Object.assign(state.settings, s);
  state.keyring = (await db.getMeta('keyring')) || null;
  return state.settings;
}

export function saveSettings() {
  return db.setMeta('settings', { ...state.settings });
}

export async function setupKeys(pin, recoveryKey) {
  const { masterKey, keyring } = await kc.createKeyring(pin, recoveryKey);
  await db.setMeta('keyring', keyring);
  state.keyring = keyring;
  state.masterKey = masterKey;
  await loadData();
}

export async function unlock(pin) {
  state.masterKey = await kc.unlockWithPin(state.keyring, pin);
  await loadData();
}

export async function recover(recoveryKey, newPin) {
  const mk = await kc.unlockWithRecovery(state.keyring, recoveryKey);
  state.keyring = await kc.rewrapPin(state.keyring, mk, newPin);
  await db.setMeta('keyring', state.keyring);
  state.masterKey = mk;
  await loadData();
}

export async function changePin(currentPin, newPin) {
  const mk = await kc.unlockWithPin(state.keyring, currentPin);
  state.keyring = await kc.rewrapPin(state.keyring, mk, newPin);
  await db.setMeta('keyring', state.keyring);
}

export function lock() {
  state.masterKey = null;
  state.entries = [];
  state.tags = [];
}

export const isUnlocked = () => !!state.masterKey;

async function loadData() {
  const [rows, tagRows] = await Promise.all([db.all('entries'), db.all('tags')]);
  state.entries = await Promise.all(rows.map(decryptEntry));
  state.entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
  state.tags = await Promise.all(
    tagRows.map(async (r) => ({ ...r, ...(await kc.decryptJSON(state.masterKey, r.secret)) }))
  );
  state.tags.sort((a, b) => a.name.localeCompare(b.name));
}

async function decryptEntry(row) {
  const secret = (await kc.decryptJSON(state.masterKey, row.secret)) || {};
  return { ...row, title: secret.title || '', body: secret.body || '', answers: secret.answers || null };
}

// Entry shape (plaintext, in memory):
// { id, type: free|guided|exercise|checkin, mood: 1–10|null, emotions: [{id, intensity}],
//   tagIds: [], promptIndex, exerciseId, title, body, answers, created_at, updated_at }
export async function saveEntry(entry) {
  const now = new Date().toISOString();
  if (!entry.id) entry.id = db.uid();
  if (!entry.created_at) entry.created_at = now;
  const { title, body, answers, ...plain } = entry;
  const row = { ...plain, secret: await kc.encryptJSON(state.masterKey, { title, body, answers }) };
  delete row.deleted_at;
  await db.put('entries', row);
  entry.updated_at = row.updated_at;
  const i = state.entries.findIndex((e) => e.id === entry.id);
  if (i >= 0) state.entries[i] = { ...entry };
  else state.entries.unshift({ ...entry });
  state.entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return entry;
}

export async function deleteEntry(id) {
  await db.softDelete('entries', id);
  state.entries = state.entries.filter((e) => e.id !== id);
}

const TAG_COLORS = ['#8ab6a9', '#a99bc9', '#e9c46a', '#d48c84', '#7d9cc4', '#c4a484'];

export async function createTag(name) {
  name = name.trim();
  if (!name) return null;
  const existing = state.tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const tag = { id: db.uid(), color: TAG_COLORS[state.tags.length % TAG_COLORS.length], created_at: new Date().toISOString() };
  await db.put('tags', { ...tag, secret: await kc.encryptJSON(state.masterKey, { name }) });
  const full = { ...tag, name };
  state.tags.push(full);
  state.tags.sort((a, b) => a.name.localeCompare(b.name));
  return full;
}

export function tagById(id) {
  return state.tags.find((t) => t.id === id);
}

export function exportAll() {
  return {
    app: 'skepsis',
    exported_at: new Date().toISOString(),
    entries: state.entries,
    tags: state.tags.map(({ id, name, color, created_at }) => ({ id, name, color, created_at })),
  };
}

export async function deleteEverything() {
  lock();
  await db.wipe();
}
