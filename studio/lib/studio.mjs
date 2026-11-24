// The orchestrator: idea -> plan (style, cast, dialogue) -> engine choice -> parallel generation -> finishing -> comparison -> MP4.
// Every step is saved to out/<job>/job.json, so a job cut off by a restart can be resumed without paying twice.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { plan as makePlan } from './planner.mjs';
import { decide, approvalCovers, autoPick } from './budget.mjs';
import { readLedger, updateEngine, recordGeneration } from './ledger.mjs';
import { probe, techScore, thumbnail } from './media.mjs';
import { renderLocal, assembleClips, finishEngineVideo } from './compose.mjs';
import { getCharacter } from './characters.mjs';
import local from '../engines/local.mjs';
import vaideo from '../engines/vaideo.mjs';
import aituber from '../engines/aituber.mjs';
import korpi from '../engines/korpi.mjs';
import seedance from '../engines/seedance.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const OUT = process.env.STUDIO_OUT || path.join(ROOT, 'out');
export const ENGINES = { aituber, vaideo, seedance, korpi, local };
const jobs = new Map();
const running = new Set();

let statusCache = { at: 0, data: null };
/** Live status of every engine. Balances are shown only when the service itself returned them (`verified`). */
export async function engineStatuses({ fresh = false } = {}) {
  if (!fresh && statusCache.data && Date.now() - statusCache.at < 60000) return statusCache.data;
  const data = {};
  await Promise.all(Object.values(ENGINES).map(async e => {
    let s; try { s = await e.status(); } catch (err) { s = { connected: false, note: err.message }; }
    data[e.id] = s;
    updateEngine(e.id, { connected: s.connected, verified: !!s.verified, credits: s.verified ? s.credits : null, plan: s.plan ?? null, note: s.note ?? null, checkedAt: new Date().toISOString() });
  }));
  statusCache = { at: Date.now(), data };
  return data;
}

export async function overview(opts) {
  const st = await engineStatuses(opts);
  const ledger = readLedger();
  return Object.values(ENGINES).map(e => ({
    id: e.id, name: e.name, kind: e.kind, official: e.official, site: e.site, strengths: e.strengths, capabilities: e.capabilities,
    hebrew: e.hebrew, maxSec: e.maxSec, currency: e.currency, unit: e.unit,
    freeGrant: Number.isFinite(e.freeGrant) ? e.freeGrant : null,
    status: { ...st[e.id], raw: undefined }, ledger: ledger.engines[e.id] || {},
  }));
}

function resolveCast(ids) {
  return (ids || []).map(id => getCharacter(id)).filter(Boolean);
}

/** Plan + per-engine cost decisions, without spending anything. */
export async function quote(idea, opts = {}) {
  const cast = resolveCast(opts.cast);
  const p = { ...makePlan(idea, { ...opts, cast }), lipsync: !!opts.lipsync };
  const st = await engineStatuses();
  const ledger = readLedger();
  const rows = Object.values(ENGINES).map(e => {
    const est = e.estimate(p);
    return { engine: e, estimate: est, decision: decide(e, est, st[e.id], ledger.engines[e.id]) };
  });
  return {
    plan: p,
    auto: autoPick(rows, p.brief, p),
    engines: rows.map(r => ({ id: r.engine.id, name: r.engine.name, kind: r.engine.kind, estimate: r.estimate, decision: r.decision })),
  };
}

export function getJob(id) { return jobs.get(id) || readJobFile(id); }
function readJobFile(id) {
  if (!/^[\w-]+$/.test(String(id))) return null;
  try { return JSON.parse(fs.readFileSync(path.join(OUT, id, 'job.json'), 'utf8')); } catch { return null; }
}
function save(job) { fs.mkdirSync(job.dir, { recursive: true }); fs.writeFileSync(path.join(job.dir, 'job.json.tmp'), JSON.stringify(job, null, 2)); fs.renameSync(path.join(job.dir, 'job.json.tmp'), path.join(job.dir, 'job.json')); }

/**
 * Start a job. Returns { job } or { needsApproval } when a chosen engine would cost money and the request
 * carries no approval covering it. Nothing is sent to any service in that case.
 */
export async function startJob({ idea, lengthSec = 30, style = 'auto', aspect = '9:16', engines = 'auto', approval = {}, cast = [], lipsync = false, planOverride = null }) {
  const q = await quote(idea, { lengthSec, style, aspect, cast, lipsync });
  const p = planOverride ? { ...q.plan, ...planOverride, brief: { ...q.plan.brief, ...(planOverride.brief || {}) } } : q.plan;
  const chosen = engines === 'auto' ? q.auto : [...new Set(engines)].filter(id => ENGINES[id]);
  if (!chosen.length) throw new Error('לא נבחר מנוע');
  const rows = q.engines.filter(r => chosen.includes(r.id));
  const needs = rows.filter(r => r.decision.kind === 'paid' && !approvalCovers(approval, r.id, r.decision));
  if (needs.length) return { needsApproval: needs };
  const id = new Date().toISOString().slice(0, 10) + '-' + crypto.randomBytes(3).toString('hex');
  const job = {
    id, dir: path.join(OUT, id), createdAt: new Date().toISOString(), idea, aspect, plan: { ...p, jobId: id },
    engines: rows.map(r => ({ id: r.id, name: r.name, kind: r.kind, decision: r.decision, approved: r.decision.kind === 'paid', state: r.decision.kind === 'unavailable' ? 'skipped' : 'queued', progress: 0, step: r.decision.kind === 'unavailable' ? r.decision.reason : 'בתור', remote: {} })),
    state: 'running', winner: null,
  };
  jobs.set(id, job); save(job);
  run(job);
  return { job };
}

/** Resume a job that was cut off (server restart) or that failed. Remote work already submitted is picked up, not re-created. */
export function resumeJob(id) {
  const job = getJob(id);
  if (!job) throw new Error('היצירה לא נמצאה');
  if (running.has(id)) throw new Error('היצירה כבר רצה');
  const todo = job.engines.filter(e => ['queued', 'running', 'failed', 'interrupted'].includes(e.state));
  if (!todo.length) throw new Error('אין מה להמשיך');
  // A paid engine with nothing submitted yet still runs under the approval given for this job, for the same amount.
  todo.forEach(e => { e.state = 'queued'; e.step = e.remote && Object.keys(e.remote).length ? 'ממשיך מאיפה שעצר' : 'בתור'; e.error = null; });
  job.state = 'running'; job.resumedAt = new Date().toISOString();
  jobs.set(id, job); save(job);
  run(job);
  return job;
}

async function run(job) {
  running.add(job.id);
  try {
    await Promise.allSettled(job.engines.filter(e => e.state === 'queued').map(e => runEngine(job, e)));
    const done = job.engines.filter(e => e.state === 'done');
    // Compare: technical quality, then cost, then how close the length is to what was asked.
    done.forEach(e => { e.result.rank = e.result.score - (e.result.money || 0) * 5 - Math.abs(e.result.probe.duration - job.plan.brief.lengthSec) * 0.3; });
    job.winner = [...done].sort((a, b) => b.result.rank - a.result.rank)[0]?.id || null;
    job.state = done.length ? 'done' : 'failed';
    job.finishedAt = new Date().toISOString();
    save(job);
  } finally { running.delete(job.id); }
}

async function runEngine(job, e) {
  const engine = ENGINES[e.id];
  const work = path.join(job.dir, 'work', e.id);
  fs.mkdirSync(work, { recursive: true });
  const out = path.join(job.dir, `${e.id}.mp4`);
  const t0 = Date.now();
  const tick = (pct, step) => { e.progress = Math.max(e.progress || 0, Math.min(99, pct)); e.step = step; save(job); };
  e.state = 'running'; tick(2, e.step === 'ממשיך מאיפה שעצר' ? e.step : 'מתחיל');
  try {
    if (engine.id === 'local') {
      await renderLocal(job.plan, { aspect: job.aspect, work, out, onProgress: tick });
    } else {
      const r = await engine.generate(job.plan, {
        aspect: job.aspect, work, onProgress: tick, saved: e.remote || {},
        remember: st => { e.remote = { ...(e.remote || {}), ...st }; save(job); },
      });
      e.cost = { credits: r.credits ?? e.decision.credits ?? null, money: e.decision.kind === 'paid' ? (r.money ?? e.decision.money) : 0 };
      tick(85, 'עריכה וגימור');
      if (r.clips?.length) await assembleClips(r.clips, job.plan, { aspect: job.aspect, work: path.join(work, 'edit'), out, withVoice: !r.keepClipAudio, keepClipAudio: !!r.keepClipAudio, onProgress: tick });
      else await finishEngineVideo(r.file, { aspect: job.aspect, out, work: path.join(work, 'finish') });
      // Proof that the service returned a real file, not just a success message.
      e.rawProbe = await probe(r.file || r.clips[0]);
    }
    // Nothing is shown as ready until the final file exists and plays.
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

/** On server start: jobs left "running" by a crash or restart become "interrupted" and can be resumed. */
export function markInterrupted() {
  let n = 0;
  for (const j of listJobs()) {
    if (j.state === 'running' && !running.has(j.id)) {
      j.state = 'interrupted';
      j.engines.forEach(e => { if (e.state === 'running' || e.state === 'queued') { e.state = 'interrupted'; e.step = 'נקטע — אפשר להמשיך'; } });
      save(j); n++;
    }
  }
  return n;
}

export function listJobs() {
  try {
    return fs.readdirSync(OUT).filter(d => fs.existsSync(path.join(OUT, d, 'job.json'))).map(readJobFile).filter(Boolean)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch { return []; }
}

export function deleteJob(id) {
  const j = getJob(id);
  if (!j) throw new Error('היצירה לא נמצאה');
  if (running.has(id)) throw new Error('אי אפשר למחוק יצירה שרצה');
  fs.rmSync(path.join(OUT, id), { recursive: true, force: true });
  jobs.delete(id);
}
