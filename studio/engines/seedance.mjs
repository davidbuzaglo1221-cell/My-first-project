// Dreamina Seedance — ByteDance's official API through BytePlus ModelArk.
// The Dreamina website itself has no developer API; ModelArk is the official route to the same model family.
// Raw clips (5-12 s, optional native audio) that the studio stitches into a full edit. Paid per second.
import path from 'node:path';
import { api, poll } from './http.mjs';
import { download } from '../lib/media.mjs';
import fs from 'node:fs';
import { getKey } from '../lib/secrets.mjs';
import { imagePath } from '../lib/characters.mjs';

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

  capabilities: { t2v: true, i2v: true, image: false, lipsync: 'native audio (dialogue in prompt); Hebrew not verified', voice: 'native audio', consistency: 'up to 9 reference images', resolution: '480p–4K', length: '4–15 s per clip' },

  clipPlan(p) {
    // Few clips reused across scenes: the cheapest way to get real motion into a full edit.
    // With lip sync on, every spoken scene gets its own clip with the line in the prompt.
    if (p.lipsync) return p.scenes.map(s => ({ prompt: s.speaker !== 'narrator' ? `${s.visual}. ${s.speakerName} says: "${s.narration}"` : s.visual, seconds: Math.max(4, Math.min(15, Math.ceil(s.durationSec))) }));
    const n = Math.min(p.scenes.length, Math.max(2, Math.ceil(p.brief.lengthSec / 10)));
    return p.scenes.slice(0, n).map(s => ({ prompt: s.visual, seconds: 5 }));
  },

  /** Character reference images (max 9) as data URLs, so every clip shows the same faces. */
  references(p) {
    return (p.cast || []).map(imagePath).filter(f => f && fs.existsSync(f)).slice(0, 9).map(f => {
      const ext = f.endsWith('.png') ? 'png' : f.endsWith('.webp') ? 'webp' : 'jpeg';
      return { type: 'image_url', image_url: { url: `data:image/${ext};base64,${fs.readFileSync(f).toString('base64')}` }, role: 'reference_image' };
    });
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

  async generate(p, { aspect, work, onProgress = () => {}, signal, model = DEFAULT_MODEL, saved = {}, remember = () => {} }) {
    const k = getKey('seedance').value;
    const clips = this.clipPlan(p);
    const refs = this.references(p);
    onProgress(10, `שולח ${clips.length} קליפים ל-Seedance`);
    let done = 0;
    const tasks = { ...(saved.tasks || {}) };
    const files = await Promise.all(clips.map(async (c, i) => {
      // Resume: a task that was already submitted is polled again, never paid for twice.
      let t = tasks[i] ? { id: tasks[i] } : null;
      if (!t) {
        t = await api(BASE, k, 'POST', '/contents/generations/tasks', {
          model, content: [{ type: 'text', text: c.prompt }, ...refs], ratio: aspect, duration: c.seconds,
          resolution: '1080p', generate_audio: !!p.lipsync, watermark: false,
        });
        tasks[i] = t.id; remember({ tasks });
      }
      const r = await poll(() => api(BASE, k, 'GET', `/contents/generations/tasks/${t.id}`), x => ['succeeded', 'failed', 'cancelled', 'expired'].includes(x.status), { everyMs: 8000, signal });
      if (r.status !== 'succeeded') throw new Error(`Seedance: ${r.error?.message || r.status}`);
      const f = path.join(work, `seedance_${i}.mp4`);
      await download(r.content.video_url, f);
      onProgress(10 + Math.round((++done / clips.length) * 60), `Seedance: ${done}/${clips.length} קליפים`);
      return f;
    }));
    return { file: null, clips: files, keepClipAudio: !!p.lipsync, money: this.estimate(p, model).money };
  },
};
