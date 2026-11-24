// AITuber — official REST API + MCP (https://aituber.app/api). Finished video with voice, AI visuals and synced captions.
// Characters: saved characters become AITuber "elements" (reference photo -> same face in every scene, used as @handle).
// Lip sync: a single speaking character can be a talking-head avatar (mediaType "avatar").
// Free: 100 credits on sign-up, no card. ~35 credits for a 30 s Short with AI images (aituber.app/mcp, 24.11.2026).
import fs from 'node:fs';
import path from 'node:path';
import { api, poll } from './http.mjs';
import { download } from '../lib/media.mjs';
import { getKey } from '../lib/secrets.mjs';
import { imagePath, setEngineRef } from '../lib/characters.mjs';

const BASE = 'https://app.aituber.app/api/v1';

/** Upload a character's reference photo once and keep its handle for every later video. */
async function ensureElement(k, c) {
  if (c.engines?.aituber?.handle) return c.engines.aituber;
  const file = imagePath(c); if (!file || !fs.existsSync(file)) return null;
  const buf = fs.readFileSync(file);
  const type = file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const up = await api(BASE, k, 'POST', '/uploads', { purpose: 'element-image', contentType: type, fileSizeBytes: buf.length });
  const put = await fetch(up.uploadUrl, { method: 'PUT', headers: { 'Content-Type': type }, body: buf });
  if (!put.ok) throw new Error(`העלאת תמונת הדמות ל-AITuber נכשלה (${put.status})`);
  const el = await api(BASE, k, 'POST', '/elements', { name: c.name, type: 'character', imageAssetId: up.assetId, description: c.personality || undefined });
  const ref = { id: el.id, handle: el.handle };
  setEngineRef(c.id, 'aituber', ref);
  return ref;
}

export default {
  id: 'aituber',
  name: 'AITuber',
  kind: 'finished',
  official: 'API ו-MCP רשמיים',
  site: 'https://app.aituber.app/dashboard/api-keys',
  freeGrant: 100,
  unit: 'קרדיט',
  moneyPerCredit: 39 / 2500, // USD, first paid plan
  currency: '$',
  strengths: ['דמויות עקביות', 'אווטאר מדבר', 'כתוביות מסונכרנות'],
  maxSec: 600,
  textOnly: true,
  hebrew: null, // multilingual voices; Hebrew pronunciation to be verified in the first test
  capabilities: { t2v: true, i2v: 'clips from a first frame', image: 'AI images per scene', lipsync: 'talking-head avatars', voice: '1,300+ voices, cloning', consistency: 'elements with a reference photo (@handle)', resolution: '1080p / 4K export', length: 'up to 20 min; clips 1–15 s' },

  estimate(p) {
    // Public figure: ~35 credits per 30 s with AI images. Avatar videos cost more; counted as x2 to stay on the safe side.
    const credits = Math.ceil((p.brief.lengthSec / 30) * 35 * (p.lipsync ? 2 : 1));
    return { credits, money: +(credits * this.moneyPerCredit).toFixed(2) };
  },

  async status() {
    const k = getKey('aituber');
    if (!k.value) return { connected: false, note: 'חסר מפתח API' };
    try {
      const s = await api(BASE, k.value, 'GET', '/subscription');
      return { connected: true, verified: true, credits: s.credits, plan: s.plan, freePlan: s.plan === 'Free' || s.status === 'free', raw: s };
    } catch (e) { return { connected: false, note: e.code === 'auth' ? 'חסר מפתח API' : e.message }; }
  },

  async generate(p, { aspect, work, onProgress = () => {}, signal, saved = {}, remember = () => {} }) {
    const k = getKey('aituber').value;
    let videoId = saved.videoId;
    if (!videoId) {
      const refs = {};
      for (const c of p.cast || []) { try { const r = await ensureElement(k, c); if (r) refs[c.id] = r; } catch (e) { onProgress(8, e.message); } }
      const speakers = [...new Set(p.scenes.filter(s => s.speaker !== 'narrator').map(s => s.speaker))];
      const solo = speakers.length === 1 && refs[speakers[0]];
      let body;
      if (p.lipsync && solo) {
        // Talking head: the character's photo speaks the whole script, lips in sync.
        body = { script: p.scenes.map(s => s.narration).join(' '), inputType: 'script', mediaType: 'avatar', avatarId: solo.id, aspectRatio: aspect === '16:9' ? '16:9' : '9:16', captionsEnabled: true };
      } else if (p.cast?.length) {
        // Script mode: [what we see, with @handles] then the spoken line. Every scene shows the same faces.
        const tag = id => refs[id] ? `@${refs[id].handle}` : (p.cast.find(c => c.id === id)?.name || '');
        const script = p.scenes.map(s => `[${s.speaker !== 'narrator' ? `${tag(s.speaker)} speaking, ` : ''}${p.cast.map(c => tag(c.id)).join(' and ')}, ${s.visual.split('. ')[0]}] ${s.narration}`).join(' ');
        body = { script, inputType: 'script', mediaType: 'images', imageQuality: 'good', aspectRatio: aspect, captionsEnabled: true, captionPosition: aspect === '9:16' ? 'center' : 'bottom', voiceSpeed: 1.1 };
      } else {
        body = { script: p.enginePrompt, inputType: 'idea', expectedDurationSeconds: p.brief.lengthSec, aspectRatio: aspect, mediaType: 'images', imageQuality: 'good', captionsEnabled: true, captionPosition: aspect === '9:16' ? 'center' : 'bottom', voiceSpeed: 1.1 };
      }
      const g = await api(BASE, k, 'POST', '/videos/generate', body);
      videoId = g.videoId; remember({ videoId });
    }
    onProgress(12, 'נשלח ל-AITuber');
    const v = await poll(() => api(BASE, k, 'GET', `/videos/${videoId}`), r => ['completed', 'failed', 'error'].includes(r.status),
      { everyMs: 10000, signal, onTick: r => onProgress(Math.min(75, 12 + Math.round((r.progress || 0) * 0.6)), 'AITuber מייצר') });
    if (v.status !== 'completed') throw new Error(v.error || v.errorMessage || 'AITuber נכשל');
    // Export to MP4 is free; credits are only consumed during generation.
    let exportId = saved.exportId;
    if (!exportId) { exportId = (await api(BASE, k, 'POST', '/exports', { videoId, resolution: '1080p' })).exportId; remember({ videoId, exportId }); }
    onProgress(80, 'מייצא MP4');
    const q = `/exports/download?videoId=${videoId}&exportId=${exportId}`;
    await poll(() => api(BASE, k, 'GET', q).catch(e => (e.status === 409 || e.status === 404 ? {} : Promise.reject(e))), r => !!r.url, { everyMs: 6000, timeoutMs: 15 * 60000, signal });
    // The signed link lives 2 minutes: ask for a fresh one right before downloading.
    const d = await api(BASE, k, 'GET', q);
    const file = path.join(work, 'aituber.mp4');
    await download(d.url, file);
    return { file, credits: v.creditsUsed ?? v.credits ?? this.estimate(p).credits, remoteId: videoId };
  },
};
