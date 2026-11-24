// AITuber — official REST API + MCP (https://aituber.app/api). Finished faceless video with voice, AI visuals, captions.
// Free: 100 credits on sign-up, no card. ~35 credits for a 30 s Short with AI images (aituber.app/mcp, 24.11.2026).
import path from 'node:path';
import { api, poll } from './http.mjs';
import { download } from '../lib/media.mjs';
import { getKey } from '../lib/secrets.mjs';

const BASE = 'https://app.aituber.app/api/v1';

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
  strengths: ['תמונות AI', 'כתוביות מסונכרנות', '1:1 מובנה'],
  maxSec: 600,
  textOnly: true,
  hebrew: null, // multilingual voices; Hebrew pronunciation to be verified in the first test

  estimate(p) {
    // Public figure: ~35 credits per 30 s with AI images. Scale linearly, round up.
    const credits = Math.ceil((p.brief.lengthSec / 30) * 35);
    return { credits, money: +(credits * this.moneyPerCredit).toFixed(2) };
  },

  async status() {
    const k = getKey('aituber');
    if (!k.value) return { connected: false, note: 'חסר מפתח API' };
    try {
      const s = await api(BASE, k.value, 'GET', '/subscription');
      return { connected: true, credits: s.credits, plan: s.plan, freePlan: s.plan === 'Free' || s.status === 'free', raw: s };
    } catch (e) { return { connected: false, note: e.code === 'auth' ? 'חסר מפתח API' : e.message }; }
  },

  async generate(p, { aspect, work, onProgress = () => {}, signal }) {
    const k = getKey('aituber').value;
    const g = await api(BASE, k, 'POST', '/videos/generate', {
      script: p.enginePrompt,
      inputType: 'idea',
      expectedDurationSeconds: p.brief.lengthSec,
      aspectRatio: aspect,
      mediaType: 'images',
      imageQuality: 'good',
      captionsEnabled: true,
      captionPosition: aspect === '9:16' ? 'center' : 'bottom',
      voiceSpeed: 1.1,
    });
    onProgress(12, 'נשלח ל-AITuber');
    const v = await poll(() => api(BASE, k, 'GET', `/videos/${g.videoId}`), r => ['completed', 'failed', 'error'].includes(r.status),
      { everyMs: 10000, signal, onTick: r => onProgress(Math.min(75, 12 + Math.round((r.progress || 0) * 0.6)), 'AITuber מייצר') });
    if (v.status !== 'completed') throw new Error(v.error || v.errorMessage || 'AITuber נכשל');
    // Export to MP4 is free; credits are only consumed during generation.
    const ex = await api(BASE, k, 'POST', '/exports', { videoId: g.videoId, resolution: '1080p' });
    onProgress(80, 'מייצא MP4');
    await poll(() => api(BASE, k, 'GET', `/exports/download?videoId=${g.videoId}&exportId=${ex.exportId}`).catch(e => (e.status === 409 || e.status === 404 ? {} : Promise.reject(e))),
      r => !!r.url, { everyMs: 6000, timeoutMs: 15 * 60000, signal });
    // The signed link lives 2 minutes: ask for a fresh one right before downloading.
    const d = await api(BASE, k, 'GET', `/exports/download?videoId=${g.videoId}&exportId=${ex.exportId}`);
    const file = path.join(work, 'aituber.mp4');
    await download(d.url, file);
    return { file, credits: v.creditsUsed ?? v.credits ?? this.estimate(p).credits, remoteId: g.videoId };
  },
};
