/**
 * A private vault on this device only: AES-GCM with a key derived from the user's code (PBKDF2, 210,000 rounds).
 * The code is never stored. Without it the data cannot be read, not even by the app. Nothing here is ever sent anywhere.
 */
const KEY = 'hamasa:vault'
const enc = new TextEncoder()
const dec = new TextDecoder()
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

interface Sealed {
  v: 1
  salt: string
  iv: string
  data: string
}

async function derive(code: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export const vaultExists = () => {
  try {
    return !!localStorage.getItem(KEY)
  } catch {
    return false
  }
}

export async function seal<T>(code: string, value: T) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await derive(code, salt)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)))
  const sealed: Sealed = { v: 1, salt: b64(salt), iv: b64(iv), data: b64(data) }
  localStorage.setItem(KEY, JSON.stringify(sealed))
}

/** Returns the value, or null when the code is wrong. */
export async function open<T>(code: string): Promise<T | null> {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  const s = JSON.parse(raw) as Sealed
  try {
    const key = await derive(code, unb64(s.salt))
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, key, unb64(s.data))
    return JSON.parse(dec.decode(plain)) as T
  } catch {
    return null
  }
}

export const destroyVault = () => localStorage.removeItem(KEY)
