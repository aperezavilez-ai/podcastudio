// utils/storageCrypto.js - Encriptación simple para credenciales en localStorage
const STORAGE_KEY = 'podcastudio_encryption_key';

function getOrCreateKey() {
  let key = localStorage.getItem(STORAGE_KEY);
  if (!key) {
    key = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(STORAGE_KEY, key);
  }
  return key;
}

export function encrypt(value) {
  if (!value) return '';
  const key = getOrCreateKey();
  const encoded = btoa(unescape(encodeURIComponent(value)))
    .split('')
    .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
    .join('');
  return btoa(encoded);
}

export function decrypt(value) {
  if (!value) return '';
  try {
    const key = getOrCreateKey();
    const decoded = atob(value)
      .split('')
      .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
      .join('');
    return decodeURIComponent(escape(decoded));
  } catch (e) {
    return '';
  }
}