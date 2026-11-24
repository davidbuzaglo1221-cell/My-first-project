import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-resume-'));
process.env.STUDIO_DATA = path.join(tmp, 'data');
process.env.STUDIO_OUT = path.join(tmp, 'out');
const S = await import('../lib/studio.mjs');

const mp4 = path.join(tmp, 'fake.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=purple:s=540x960:d=3', '-f', 'lavfi', '-i', 'sine=d=3', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', mp4]);

// A fake free engine: the first run submits remote work and then "crashes"; the resume must poll the same id.
let creates = 0, crash = true;
S.ENGINES.vaideo.status = async () => ({ connected: true, verified: true, credits: 5 });
S.ENGINES.vaideo.generate = async (p, { work, saved, remember }) => {
  let id = saved.id;
  if (!id) { creates++; id = 'remote-1'; remember({ id }); }
  if (crash) { crash = false; throw new Error('connection lost'); }
  const f = path.join(work, 'v.mp4'); fs.copyFileSync(mp4, f);
  return { file: f, credits: 1 };
};
for (const id of ['aituber', 'seedance', 'korpi']) S.ENGINES[id].status = async () => ({ connected: false, note: 'x' });

const waitDone = async id => { for (let i = 0; i < 300; i++) { const j = S.getJob(id); if (j.state !== 'running') return j; await new Promise(r => setTimeout(r, 100)); } throw new Error('timeout'); };

test('a failed job resumes from the saved remote id and never creates twice', async () => {
  const { job } = await S.startJob({ idea: 'טיפים לזקן', lengthSec: 10, engines: ['vaideo'] });
  let j = await waitDone(job.id);
  assert.equal(j.state, 'failed');
  assert.equal(j.engines[0].remote.id, 'remote-1', 'remote id was saved before the failure');
  S.resumeJob(job.id);
  j = await waitDone(job.id);
  assert.equal(j.state, 'done', JSON.stringify(j.engines[0]));
  assert.equal(creates, 1, 'remote work was created once');
  assert.ok(fs.existsSync(path.join(S.OUT, j.engines[0].result.file)), 'a real file exists');
  assert.ok(j.engines[0].result.probe.duration > 2);
});

test('jobs left running by a restart become interrupted and resumable', async () => {
  const { job } = await S.startJob({ idea: 'טיפים לזקן', lengthSec: 10, engines: ['vaideo'] });
  await waitDone(job.id);
  // Simulate a crash mid-run: rewrite the saved file as still running.
  const f = path.join(S.OUT, job.id, 'job.json');
  const raw = JSON.parse(fs.readFileSync(f)); raw.state = 'running'; raw.engines[0].state = 'running'; fs.writeFileSync(f, JSON.stringify(raw));
  const fresh = await import('../lib/studio.mjs?again');
  assert.equal(fresh.markInterrupted(), 1);
  assert.equal(fresh.getJob(job.id).state, 'interrupted');
  assert.equal(fresh.getJob(job.id).engines[0].state, 'interrupted');
});

test('a job is never shown done without a playable file', async () => {
  S.ENGINES.vaideo.generate = async (p, { work }) => { const f = path.join(work, 'bad.mp4'); fs.writeFileSync(f, 'not a video'); return { file: f, credits: 1 }; };
  const { job } = await S.startJob({ idea: 'טיפים לזקן', lengthSec: 10, engines: ['vaideo'] });
  const j = await waitDone(job.id);
  assert.equal(j.state, 'failed');
  assert.equal(j.engines[0].result, undefined);
});
