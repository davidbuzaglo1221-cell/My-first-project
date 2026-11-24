// Dreamina Seedance — ByteDance's official API through BytePlus ModelArk.
// The Dreamina website itself has no developer API; ModelArk is the official route to the same model family.
// Raw clips (5-12 s, optional native audio) that the studio stitches into a full edit. Paid per second.
import path from 'node:path';
import { api, poll } from './http.mjs';
import { download } from '../lib/media.mjs';
import { getKey } from '../lib/secrets.mjs';

const BASE = 'https://ark.ap-southeast.bytepluses.com/api/v3';
// Model ids from docs.byteplus.com/en/docs/modelark/video-generation-tutorial (24.11.2026).
export const MODELS = {
  'dreamina-seedance-2-0-fast-260128': { he: 'Seedance 2.0 מהיר', usdPerSec: 0.07 },
  'dreamina-seedance-2-0-260128': { he: 'Seedance 2.0', usdPerSec: 0.15 },
  'dreamina-seedance-2-5-flash-261115': { he: 'Seedance 2.5 פלאש', usdPerSec: 0.103 },
  'dreamina-seedance-2-5-260628': { he: 'Seedance 2.5', usdPerSec: 0.231 },
};
const DEFAULT_MODEL = 'dreamina-seedance-2-0-fast-260128';

export default {
  id: 'seedance',
  name: 'Dreamina Seedance',
  kind: 'clips',
  official: 'API רשמי של BytePlus (ByteDance)',
  site: 'https://console.byteplus.com/ark',
  freeGrant: 0, // BytePlus lists free tokens for some models on new accounts; counted only after it shows in the user's console
  unit: '$',
  currency: '$',
  strengths: ['וידאו גנרטיבי אמיתי', 'סאונד מובנה', 'קולנועי'],
  maxSec: 12,
  textOnly: true,
  hebrew: false, // no narration; the studio adds Hebrew voice and captions

  clipPlan(p) {
    // Few clips, each 5 s, reused across scenes: the cheapest way to get real motion into a full edit.
    const n = Math.min(p.scenes.length, Math.max(2, Math.ceil(p.brief.lengthSec / 10)));
    return p.scenes.slice(0, n).map(s => ({ prompt: s.visual, seconds: 5 }));
  },

  estimate(p, model = DEFAULT_MODEL) {
    const clips = this.clipPlan(p);
    const sec = clips.reduce((a, c) => a + c.seconds, 0);
    return { credits: null, money: +(sec * MODELS[model].usdPerSec).toFixed(2), seconds: sec, clips: clips.length };
  },

  async status() {
    if (!getKey('seedance').value) return { connected: false, note: 'חסר מפתח ARK' };
    try {
      await api(BASE, getKey('seedance').value, 'GET', '/contents/generations/tasks?page_size=1');
      return { connected: true, credits: null, plan: 'תשלום לפי שימוש' };
    } catch (e) { return { connected: false, note: e.code === 'auth' ? 'חסר מפתח ARK' : e.message }; }
  },

  async generate(p, { aspect, work, onProgress = () => {}, signal, model = DEFAULT_MODEL }) {
    const k = getKey('seedance').value;
    const clips = this.clipPlan(p);
    onProgress(10, `שולח ${clips.length} קליפים ל-Seedance`);
    let done = 0;
    const files = await Promise.all(clips.map(async (c, i) => {
      const t = await api(BASE, k, 'POST', '/contents/generations/tasks', {
        model, content: [{ type: 'text', text: c.prompt }], ratio: aspect, duration: c.seconds,
        resolution: '1080p', generate_audio: false, watermark: false,
      });
      const r = await poll(() => api(BASE, k, 'GET', `/contents/generations/tasks/${t.id}`), x => ['succeeded', 'failed', 'cancelled', 'expired'].includes(x.status), { everyMs: 8000, signal });
      if (r.status !== 'succeeded') throw new Error(`Seedance: ${r.error?.message || r.status}`);
      const f = path.join(work, `seedance_${i}.mp4`);
      await download(r.content.video_url, f);
      onProgress(10 + Math.round((++done / clips.length) * 60), `Seedance: ${done}/${clips.length} קליפים`);
      return f;
    }));
    return { file: null, clips: files, money: this.estimate(p, model).money, remoteId: null };
  },
};
