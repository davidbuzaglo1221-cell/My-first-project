// The savings ledger: credits left, free quota, cost per generation, quality, length and connection status.
// data/ledger.json is the live state; every generation is appended to data/history.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = process.env.STUDIO_DATA || path.join(ROOT, 'data');
const LEDGER = () => path.join(DATA, 'ledger.json');
const HISTORY = () => path.join(DATA, 'history.json');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(file + '.tmp', file);
}

export function readLedger() { return readJson(LEDGER(), { engines: {}, settings: { allowPaid: false } }); }

export function updateEngine(id, patch) {
  const l = readLedger();
  l.engines[id] = { ...(l.engines[id] || {}), ...patch, updatedAt: new Date().toISOString() };
  writeJson(LEDGER(), l);
  return l.engines[id];
}

export function recordGeneration(entry) {
  const h = readJson(HISTORY(), []);
  h.push({ at: new Date().toISOString(), ...entry });
  writeJson(HISTORY(), h);
  const l = readLedger();
  const e = l.engines[entry.engine] || {};
  e.generations = (e.generations || 0) + 1;
  e.spentCredits = +((e.spentCredits || 0) + (entry.credits || 0)).toFixed(3);
  e.spentMoney = +((e.spentMoney || 0) + (entry.money || 0)).toFixed(3);
  if (entry.ok) {
    e.lastQuality = entry.quality ?? e.lastQuality;
    e.lastDurationSec = entry.durationSec ?? e.lastDurationSec;
    e.lastResolution = entry.resolution ?? e.lastResolution;
  }
  l.engines[entry.engine] = e;
  writeJson(LEDGER(), l);
}

export function readHistory() { return readJson(HISTORY(), []); }

export function setSetting(k, v) {
  const l = readLedger();
  l.settings = { ...(l.settings || {}), [k]: v };
  writeJson(LEDGER(), l);
}
