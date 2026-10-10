// Client-side encryption (Web Crypto, AES-GCM).
//
// A random master key encrypts all private text. The master key itself is
// stored only in wrapped form: once with a key derived from the PIN and once
// with a key derived from the recovery key. Losing both means the data is gone.

const enc = new TextEncoder();
const dec = new TextDecoder();
const PBKDF2_ITERATIONS = 310000;

export function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromB64(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function deriveWrappingKey(secret, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

async function wrapWith(masterKey, secret) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const wk = await deriveWrappingKey(secret, salt);
  const wrapped = await crypto.subtle.wrapKey('raw', masterKey, wk, { name: 'AES-GCM', iv });
  return { salt: toB64(salt), iv: toB64(iv), key: toB64(wrapped) };
}

async function unwrapWith(blob, secret) {
  const wk = await deriveWrappingKey(secret, fromB64(blob.salt));
  return crypto.subtle.unwrapKey(
    'raw',
    fromB64(blob.key),
    wk,
    { name: 'AES-GCM', iv: fromB64(blob.iv) },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

// Recovery key: 24 characters from an unambiguous alphabet, grouped by 4.
export function generateRecoveryKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(24);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    if (i && i % 4 === 0) out += '-';
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function normalizeRecoveryKey(s) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-');
}

export async function createKeyring(pin, recoveryKey) {
  const masterKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
    'wrapKey',
    'unwrapKey',
  ]);
  return {
    masterKey,
    keyring: {
      byPin: await wrapWith(masterKey, pin),
      byRecovery: await wrapWith(masterKey, normalizeRecoveryKey(recoveryKey)),
    },
  };
}

// Throws if the PIN is wrong (AES-GCM authentication fails).
export function unlockWithPin(keyring, pin) {
  return unwrapWith(keyring.byPin, pin);
}

export function unlockWithRecovery(keyring, recoveryKey) {
  return unwrapWith(keyring.byRecovery, normalizeRecoveryKey(recoveryKey));
}

export async function rewrapPin(keyring, masterKey, newPin) {
  return { ...keyring, byPin: await wrapWith(masterKey, newPin) };
}

export async function encryptJSON(masterKey, value) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, enc.encode(JSON.stringify(value)));
  return { iv: toB64(iv), ct: toB64(ct) };
}

export async function decryptJSON(masterKey, blob) {
  if (!blob) return null;
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, masterKey, fromB64(blob.ct));
  return JSON.parse(dec.decode(pt));
}
