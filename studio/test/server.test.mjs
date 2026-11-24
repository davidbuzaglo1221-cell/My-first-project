import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-srv-'));
process.env.STUDIO_DATA = path.join(tmp, 'data');
process.env.STUDIO_OUT = path.join(tmp, 'out');

const { ENGINES } = await import('../lib/studio.mjs');
const { server } = await import('../server.mjs');

// Simulate: Vaideo connected on a paid plan (no free grant left), Seedance connected (always paid).
let generateCalls = 0;
ENGINES.vaideo.status = async () => ({ connected: true, credits: 40, plan: 'pack', freePlan: false });
ENGINES.vaideo.generate = async () => { generateCalls++; throw new Error('must not be called'); };
ENGINES.seedance.status = async () => ({ connected: true });
ENGINES.seedance.generate = async () => { generateCalls++; throw new Error('must not be called'); };
for (const id of ['aituber', 'korpi']) ENGINES[id].status = async () => ({ connected: false, note: 'חסר מפתח' });

const port = await new Promise(r => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const call = async (p, body) => {
  const res = await fetch(`http://127.0.0.1:${port}${p}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  return { status: res.status, body: await res.json() };
};

test('paid engines are refused with 402 and nothing is sent', async () => {
  const r = await call('/api/jobs', { idea: 'טיפים לזקן', lengthSec: 20, engines: ['vaideo', 'seedance'] });
  assert.equal(r.status, 402);
  assert.deepEqual(r.body.needsApproval.map(n => n.id).sort(), ['seedance', 'vaideo']);
  assert.equal(generateCalls, 0);
  const jobs = await call('/api/jobs');
  assert.equal(jobs.body.length, 0, 'no job was created');
});

test('an approval below the estimate is still refused', async () => {
  const r = await call('/api/jobs', { idea: 'טיפים לזקן', lengthSec: 20, engines: ['seedance'], approval: { seedance: { maxMoney: 0.01 } } });
  assert.equal(r.status, 402);
  assert.equal(generateCalls, 0);
});

test('auto mode never picks a paid engine', async () => {
  const q = await call('/api/quote', { idea: 'טיפים לזקן', lengthSec: 20 });
  assert.deepEqual(q.body.auto, ['local']);
});

test('input validation and path traversal', async () => {
  assert.equal((await call('/api/jobs', { idea: 'x' })).status, 400);
  const res = await fetch(`http://127.0.0.1:${port}/files/..%2f..%2fetc%2fpasswd`);
  assert.equal(res.status, 404);
  const ui = await fetch(`http://127.0.0.1:${port}/`);
  assert.match(await ui.text(), /dir="rtl"/);
});

test.after(() => server.close());
