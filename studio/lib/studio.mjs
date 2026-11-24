// The orchestrator: idea -> plan -> engine choice -> parallel generation -> finishing -> comparison -> MP4.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { plan as makePlan } from './planner.mjs';
import { decide, approvalCovers, autoPick } from './budget.mjs';
import { readLedger, updateEngine, recordGeneration } from './ledger.mjs';
import { probe, techScore, thumbnail } from './media.mjs';
import { renderLocal, assembleClips, finishEngineVideo } from './compose.mjs';
import local from '../engines/local.mjs';
import vaideo from '../engines/vaideo.mjs';
import aituber from '../engines/aituber.mjs';
import korpi from '../engines/korpi.mjs';
import seedance from '../engines/seedance.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const OUT = process.env.STUDIO_OUT || path.join(ROOT, 'out');
export const ENGINES = { vaideo, aituber, seedance, korpi, local };
const jobs = new Map();

/** Live status of every engine + what the ledger knows. Cached briefly to avoid hammering account endpoints. */
let statusCache = { at: 0, data: null };
export async function engineStatuses({ fresh = false } = {}) {
  if (!fresh && statusCache.data && Date.now() - statusCache.at < 60000) return statusCache.data;
  const ledger = readLedger();
  const data = {};
  await Promise.all(Object.values(ENGINES).map(async e => {
    let s; try { s = await e.status(); } catch (err) { s = { connected: false, note: err.message }; }
    data[e.id] = s;
    updateEngine(e.id, { connected: s.connected, credits: s.credits ?? null, plan: s.plan ?? null, note: s.note ?? null, freeGrant: Number.isFinite(e.freeGrant) ? e.freeGrant : 'ללא הגבלה' });
  }));
  statusCache = { at: Date.now(), data, ledger };
  return data;
}

/** Everything the UI needs to show the savings table. */
export async function overview(opts) {
  const st = await engineStatuses(opts);
  const ledger = readLedger();
  return Object.values(ENGINES).map(e => ({
    id: e.id, name: e.name, kind: e.kind, official: e.official, site: e.site, strengths: e.strengths,
    hebrew: e.hebrew, maxSec: e.maxSec, currency: e.currency, unit: e.unit,
    freeGrant: Number.isFinite(e.freeGrant) ? e.freeGrant : null,
    status: st[e.id], ledger: ledger.engines[e.id] || {},
  }));
}

/** Plan + per-engine cost decisions, without spending anything. */
export async function quote(idea, opts = {}) {
  const p = makePlan(idea, opts);
  const st = await engineStatuses();
  const ledger = readLedger();
  const rows = Object.values(ENGINES).map(e => {
    const est = e.estimate({ ...p, useAiImages: false });
    return { engine: e, estimate: est, decision: decide(e, est, st[e.id], ledger.engines[e.id]) };
  });
  return {
    plan: p,
    auto: autoPick(rows, p.brief),
    engines: rows.map(r => ({ id: r.engine.id, name: r.engine.name, kind: r.engine.kind, estimate: r.estimate, decision: r.decision })),
  };
}

export function getJob(id) { return jobs.get(id) || readJobFile(id); }
function readJobFile(id) { try { return JSON.parse(fs.readFileSync(path.join(OUT, id, 'job.json'), 'utf8')); } catch { return null; } }
function save(job) { fs.mkdirSync(job.dir, { recursive: true }); fs.writeFileSync(path.join(job.dir, 'job.json'), JSON.stringify(job, null, 2)); }

/**
 * Start a job. Returns { job } or { needsApproval: [...] } when any chosen engine would cost money
 * and the request has no approval covering it. Nothing is sent to any service in that case.
 */
export async function startJob({ idea, lengthSec = 30, style = 'cinematic', aspect = '9:16', engines = 'auto', approval = {}, planOverride = null }) {
  const q = await quote(idea, { lengthSec, style, aspect });
  const p = planOverride ? { ...q.plan, ...planOverride, brief: { ...q.plan.brief, ...(planOverride.brief || {}) } } : q.plan;
  const chosen = engines === 'auto' ? q.auto : [...new Set(engines)].filter(id => ENGINES[id]);
  if (!chosen.length) throw new Error('לא נבחר מנוע');
  const rows = q.engines.filter(r => chosen.includes(r.id));
  const blocked = rows.filter(r => r.decision.kind === 'unavailable');
  const needs = rows.filter(r => r.decision.kind === 'paid' && !approvalCovers(approval, r.id, r.decision));
  if (needs.length) return { needsApproval: needs, blocked };
  const id = new Date().toISOString().slice(0, 10) + '-' + crypto.randomBytes(3).toString('hex');
  const job = {
    id, dir: path.join(OUT, id), createdAt: new Date().toISOString(), idea, aspect, plan: { ...p, jobId: id },
    engines: rows.map(r => ({ id: r.id, name: r.name, kind: r.kind, decision: r.decision, state: r.decision.kind === 'unavailable' ? 'skipped' : 'queued', progress: 0, step: r.decision.kind === 'unavailable' ? r.decision.reason : 'בתור' })),
    state: 'running', winner: null,
  };
  jobs.set(id, job); save(job);
  run(job).catch(err => { job.state = 'failed'; job.error = err.message; save(job); });
  return { job };
}

async function run(job) {
  await Promise.allSettled(job.engines.filter(e => e.state === 'queued').map(e => runEngine(job, e)));
  const done = job.engines.filter(e => e.state === 'done');
  // Compare: technical quality first, then cost, then how close the length is to what was asked.
  done.forEach(e => { e.result.rank = e.result.score - (e.result.money || 0) * 5 - Math.abs(e.result.probe.duration - job.plan.brief.lengthSec) * 0.3; });
  done.sort((a, b) => b.result.rank - a.result.rank);
  job.winner = done[0]?.id || null;
  job.state = done.length ? 'done' : 'failed';
  job.finishedAt = new Date().toISOString();
  save(job);
}

async function runEngine(job, e) {
  const engine = ENGINES[e.id];
  const work = path.join(job.dir, 'work', e.id);
  fs.mkdirSync(work, { recursive: true });
  const out = path.join(job.dir, `${e.id}.mp4`);
  const t0 = Date.now();
  const tick = (pct, step) => { e.progress = Math.max(e.progress, Math.min(99, pct)); e.step = step; save(job); };
  e.state = 'running'; tick(2, 'מתחיל');
  try {
    if (engine.id === 'local') {
      await renderLocal(job.plan, { aspect: job.aspect, work, out, onProgress: tick });
    } else {
      const r = await engine.generate(job.plan, { aspect: job.aspect, work, onProgress: tick });
      e.cost = { credits: r.credits ?? e.decision.credits ?? null, money: e.decision.kind === 'paid' ? (r.money ?? e.decision.money) : 0 };
      tick(85, 'עריכה וגימור');
      if (r.clips?.length) await assembleClips(r.clips, job.plan, { aspect: job.aspect, work: path.join(work, 'edit'), out, onProgress: tick });
      else await finishEngineVideo(r.file, { aspect: job.aspect, out, work: path.join(work, 'finish') });
      // Proof that the raw file came back, not just a success message.
      e.rawProbe = await probe(r.file || r.clips[0]);
    }
    const pr = await probe(out);
    const thumb = await thumbnail(out, path.join(job.dir, `${e.id}.jpg`), Math.min(1.2, pr.duration / 2));
    e.result = { file: path.relative(OUT, out), thumb: path.relative(OUT, thumb), probe: pr, score: techScore(pr), seconds: Math.round((Date.now() - t0) / 1000), money: e.cost?.money || 0, credits: e.cost?.credits ?? 0 };
    e.state = 'done'; e.progress = 100; e.step = 'מוכן';
    recordGeneration({ engine: e.id, job: job.id, ok: true, credits: e.cost?.credits || 0, money: e.cost?.money || 0, quality: e.result.score, durationSec: pr.duration, resolution: `${pr.width}x${pr.height}` });
  } catch (err) {
    e.state = 'failed'; e.step = err.message; e.error = err.message;
    recordGeneration({ engine: e.id, job: job.id, ok: false, error: err.message });
  }
  save(job);
}

export function listJobs() {
  try {
    return fs.readdirSync(OUT).filter(d => fs.existsSync(path.join(OUT, d, 'job.json'))).map(readJobFile).filter(Boolean)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch { return []; }
}
