// API keys. Never stored in the repo.
// Order: environment variable -> studio/.secrets.json (git-ignored, chmod 600) -> null.
// In the Claude cloud container the keys are saved as *network secrets*: the proxy injects the real
// Authorization header for that host, so the code sends a placeholder and never sees the value.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SECRETS_FILE = path.join(ROOT, '.secrets.json');

const ENV = {
  vaideo: 'VAIDEO_API_KEY',
  aituber: 'AITUBER_API_KEY',
  korpi: 'KORPI_MCP_TOKEN',
  seedance: 'ARK_API_KEY',
};

function fileSecrets() {
  try {
    const st = fs.statSync(SECRETS_FILE);
    if ((st.mode & 0o077) !== 0) fs.chmodSync(SECRETS_FILE, 0o600);
    return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
  } catch { return {}; }
}

/** Returns { value, source } where source is 'env' | 'file' | 'proxy' | null. */
export function getKey(engine) {
  const envName = ENV[engine];
  if (envName && process.env[envName]) return { value: process.env[envName], source: 'env' };
  const f = fileSecrets()[engine];
  if (f) return { value: f, source: 'file' };
  // Network secret mode: the proxy replaces this placeholder with the saved key.
  if (process.env.STUDIO_PROXY_SECRETS === '1' || process.env.HTTPS_PROXY) return { value: 'proxy-injected', source: 'proxy' };
  return { value: null, source: null };
}

export function saveKey(engine, value) {
  const cur = fileSecrets();
  cur[engine] = value;
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(cur, null, 2), { mode: 0o600 });
}

export function mask(v) {
  if (!v || v === 'proxy-injected') return v;
  return v.slice(0, 6) + '…' + v.slice(-3);
}
