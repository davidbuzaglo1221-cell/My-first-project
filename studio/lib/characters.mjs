// Character library: saved characters with a reference image, look, colours, face, personality and voice.
// Stored in data/characters.json; images in data/characters/<id>.<ext>. Engines keep their own ids per character
// (e.g. an AITuber element handle) under `engines`, so the same character is reused, not re-uploaded.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = () => process.env.STUDIO_DATA || path.join(ROOT, 'data');
const FILE = () => path.join(DATA(), 'characters.json');
export const IMG_DIR = () => path.join(DATA(), 'characters');

export const KINDS = {
  fruit: 'פרי / ירק',
  animal: 'חיה',
  cartoon3d: 'דמות תלת־ממד',
  realistic: 'דמות ריאליסטית',
  object: 'חפץ מדבר',
};

// Voices that read Hebrew well (edge-tts). Pitch/rate give each character its own colour.
export const VOICES = {
  'deep-m': { he: 'גבר, עמוק', voice: 'en-US-BrianMultilingualNeural', pitch: '-6Hz', rate: '+8%' },
  'bright-m': { he: 'גבר, אנרגטי', voice: 'en-US-AndrewMultilingualNeural', pitch: '+4Hz', rate: '+14%' },
  'warm-f': { he: 'אישה, חמה', voice: 'en-US-EmmaMultilingualNeural', pitch: '+0Hz', rate: '+10%' },
  'bright-f': { he: 'אישה, אנרגטית', voice: 'en-US-AvaMultilingualNeural', pitch: '+6Hz', rate: '+16%' },
  'cartoon': { he: 'מצויר, גבוה', voice: 'en-US-AndrewMultilingualNeural', pitch: '+28Hz', rate: '+18%' },
  'giant': { he: 'ענק, נמוך', voice: 'en-US-BrianMultilingualNeural', pitch: '-22Hz', rate: '-2%' },
  'he-m': { he: 'אבי (עברית)', voice: 'he-IL-AvriNeural', pitch: '+0Hz', rate: '+10%' },
  'he-f': { he: 'הילה (עברית)', voice: 'he-IL-HilaNeural', pitch: '+0Hz', rate: '+10%' },
};
export const NARRATOR_VOICE = 'deep-m';

function read() { try { return JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch { return []; } }
function write(list) {
  fs.mkdirSync(DATA(), { recursive: true });
  fs.writeFileSync(FILE() + '.tmp', JSON.stringify(list, null, 2));
  fs.renameSync(FILE() + '.tmp', FILE());
}

const str = (v, max) => String(v ?? '').trim().slice(0, max);

export function validateCharacter(b) {
  const name = str(b.name, 40);
  if (name.length < 1) throw new Error('לדמות צריך שם');
  return {
    name,
    kind: KINDS[b.kind] ? b.kind : 'cartoon3d',
    look: str(b.look, 600), // English or Hebrew: species, body, clothes — goes into every visual prompt
    colors: str(b.colors, 160),
    face: str(b.face, 240),
    personality: str(b.personality, 300),
    voice: VOICES[b.voice] ? b.voice : 'bright-m',
  };
}

export function listCharacters() { return read(); }
export function getCharacter(id) { return read().find(c => c.id === id) || null; }

export function createCharacter(b) {
  const c = { id: crypto.randomBytes(4).toString('hex'), ...validateCharacter(b), image: null, engines: {}, createdAt: new Date().toISOString() };
  write([...read(), c]);
  return c;
}

export function updateCharacter(id, b) {
  const list = read(); const i = list.findIndex(c => c.id === id);
  if (i < 0) throw new Error('הדמות לא נמצאה');
  list[i] = { ...list[i], ...validateCharacter({ ...list[i], ...b }), updatedAt: new Date().toISOString() };
  write(list);
  return list[i];
}

export function deleteCharacter(id) {
  const list = read(); const c = list.find(x => x.id === id);
  if (!c) throw new Error('הדמות לא נמצאה');
  if (c.image) fs.rmSync(path.join(IMG_DIR(), c.image), { force: true });
  write(list.filter(x => x.id !== id));
}

/** Save the reference image from a data URL (png/jpeg/webp, max 8 MB). Checks the real file signature. */
export function setCharacterImage(id, dataUrl) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('תמונה בפורמט PNG, JPG או WEBP בלבד');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) throw new Error('התמונה גדולה מ-8MB');
  const sig = buf.subarray(0, 12).toString('hex');
  const ok = (m[1] === 'png' && sig.startsWith('89504e47')) || (m[1] === 'jpeg' && sig.startsWith('ffd8ff')) || (m[1] === 'webp' && sig.startsWith('52494646') && buf.subarray(8, 12).toString() === 'WEBP');
  if (!ok) throw new Error('הקובץ אינו תמונה תקינה');
  const list = read(); const c = list.find(x => x.id === id);
  if (!c) throw new Error('הדמות לא נמצאה');
  fs.mkdirSync(IMG_DIR(), { recursive: true });
  if (c.image) fs.rmSync(path.join(IMG_DIR(), c.image), { force: true });
  c.image = `${id}-${Date.now()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  c.engines = {}; // a new face means engines must re-learn it
  fs.writeFileSync(path.join(IMG_DIR(), c.image), buf);
  write(list);
  return c;
}

export function imagePath(c) { return c?.image ? path.join(IMG_DIR(), c.image) : null; }

export function setEngineRef(id, engine, ref) {
  const list = read(); const c = list.find(x => x.id === id); if (!c) return;
  c.engines = { ...(c.engines || {}), [engine]: ref };
  write(list);
}

/** One English sentence that keeps the character identical in every prompt. */
export function describe(c) {
  return [c.name, c.look, c.colors && `colors: ${c.colors}`, c.face && `face: ${c.face}`].filter(Boolean).join(', ');
}
