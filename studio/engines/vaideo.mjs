// Vaideo — official REST API (https://app2.vaideo.org/developers). Finished narrated video, Hebrew narration supported.
// Pricing (developers page, 24.11.2026): 1 credit per <=60 s, +1 for AI images; 5 free API credits on sign-up.
import path from 'node:path';
import { api, poll } from './http.mjs';
import { download } from '../lib/media.mjs';
import { getKey } from '../lib/secrets.mjs';
import { STYLES } from '../lib/planner.mjs';

const BASE = 'https://app2.vaideo.org/api/v1';

export default {
  id: 'vaideo',
  name: 'Vaideo',
  kind: 'finished',
  official: 'API ו-MCP רשמיים',
  site: 'https://app2.vaideo.org/developers/keys',
  freeGrant: 5, // credits
  unit: 'קרדיט',
  moneyPerCredit: 0.29, // EUR, Starter pack
  currency: '€',
  strengths: ['עברית', 'סרטון מוגמר', 'זול'],
  maxSec: 300,
  textOnly: true,
  hebrew: true,

  estimate(p) {
    const s = p.brief.lengthSec;
    const credits = (s <= 60 ? 1 : s <= 120 ? 2 : s <= 180 ? 3 : 5) + (p.useAiImages ? 1 : 0);
    return { credits, money: +(credits * this.moneyPerCredit).toFixed(2) };
  },

  async status() {
    const k = getKey('vaideo');
    if (!k.value) return { connected: false, note: 'חסר מפתח API' };
    try {
      const a = await api(BASE, k.value, 'GET', '/account');
      const credits = a.credits ?? a.balance ?? a.credit_balance ?? a.data?.credits;
      return { connected: true, credits, plan: a.plan || 'קרדיטים', raw: a };
    } catch (e) { return { connected: false, note: e.code === 'auth' ? 'חסר מפתח API' : e.message }; }
  },

  async generate(p, { aspect, work, onProgress = () => {}, signal }) {
    const k = getKey('vaideo').value;
    const body = {
      prompt: p.enginePrompt.slice(0, 4000),
      duration_sec: Math.max(6, Math.min(300, p.brief.lengthSec)),
      aspect_ratio: aspect === '16:9' ? '16:9' : '9:16', // Vaideo makes 9:16 or 16:9; 1:1 is cut in our finishing pass
      language: p.brief.language,
      style: STYLES[p.brief.style]?.vaideo || 'cinematic',
      ai_images: !!p.useAiImages,
      subtitles: true,
      metadata: { source: 'titan-video-studio' },
    };
    const v0 = await api(BASE, k, 'POST', '/videos', body, { headers: { 'Idempotency-Key': p.jobId + '-vaideo' } });
    onProgress(15, 'נשלח ל-Vaideo');
    const v = await poll(() => api(BASE, k, 'GET', `/videos/${v0.id}`), r => ['completed', 'failed'].includes(r.status),
      { everyMs: 15000, signal, onTick: r => onProgress(15 + Math.round((r.progress || 0) * 0.75), 'Vaideo מייצר') });
    if (v.status !== 'completed') throw new Error(v.error?.message || v.error || 'Vaideo נכשל (הקרדיט מוחזר אוטומטית)');
    const file = path.join(work, 'vaideo.mp4');
    await download(v.video_url, file);
    return { file, credits: v.credits ?? this.estimate(p).credits, remoteId: v.id };
  },
};
