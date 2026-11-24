// Korpi — official MCP server (https://backend.korpi.ai/mcp, manifest: korpi.ai/mcp/manifest.md).
// Free on every account: write_script + plan_storyboard (fair use ~30/h). Rendering spends AI credits (paid plans).
import path from 'node:path';
import { McpClient } from '../lib/mcp.mjs';
import { download } from '../lib/media.mjs';
import { getKey } from '../lib/secrets.mjs';
import { poll } from './http.mjs';

const URL_ = 'https://backend.korpi.ai/mcp';
const client = () => new McpClient(URL_, getKey('korpi').value);

export default {
  id: 'korpi',
  name: 'Korpi',
  kind: 'clips',
  official: 'MCP רשמי',
  site: 'https://korpi.ai/mcp',
  freeGrant: 0, // video always spends credits; planning is free
  unit: 'קרדיט',
  moneyPerCredit: null,
  currency: '$',
  strengths: ['תסריט ותכנון בחינם', 'Veo / Kling / Seedance במקום אחד'],
  maxSec: 15,
  textOnly: true,
  hebrew: null,

  estimate(p) { return { credits: null, money: null, note: 'המחיר מוצג על ידי Korpi לפני ההפקה (list_video_models)' }; },

  async status() {
    if (!getKey('korpi').value) return { connected: false, note: 'חסר טוקן MCP' };
    try {
      const c = client(); await c.connect();
      const a = await c.call('account_status', {});
      return { connected: true, credits: a.credits ?? a.ai_credits ?? a.balance, plan: a.subscription || a.plan, raw: a };
    } catch (e) { return { connected: false, note: e.code === 'auth' ? 'חסר טוקן MCP' : e.message }; }
  },

  /** Free: a better script and storyboard from Korpi's planner. Returns null if not connected. */
  async enrichPlan(p) {
    try {
      const c = client(); await c.connect();
      const s = await c.call('write_script', { topic: p.brief.idea, duration_seconds: p.brief.lengthSec, language: p.brief.language === 'he' ? 'Hebrew' : 'English' });
      const sb = await c.call('plan_storyboard', { script: s.script || s.text, aspect_ratio: p.brief.aspect });
      return { script: s, storyboard: sb };
    } catch { return null; }
  },

  async listModels() { const c = client(); await c.connect(); return c.call('list_video_models', {}); },

  async generate(p, { aspect, work, onProgress = () => {}, signal, model }) {
    const c = client(); await c.connect();
    const job = await c.call('generate_video', { prompt: p.scenes[0].visual, model, duration: 5, aspect_ratio: aspect, resolution: '1080p', sound: false });
    const id = job.id || job.job_id || job.generation_id;
    onProgress(15, 'נשלח ל-Korpi');
    const r = await poll(() => c.call('get_video_generation', { id }), x => !!(x.video_url || x.url) || /fail|error/i.test(x.status || ''),
      { everyMs: 10000, signal, onTick: () => onProgress(40, 'Korpi מייצר') });
    const url = r.video_url || r.url; if (!url) throw new Error('Korpi נכשל');
    const file = path.join(work, 'korpi.mp4');
    await download(url, file);
    return { file, clips: [file], credits: r.credits_spent ?? null, remoteId: id };
  },
};
