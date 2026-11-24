// End-to-end: real browser against a real server. Idea -> plan -> free local render -> result -> MP4 download,
// then each aspect ratio is exported and measured. Run: npm run e2e
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-e2e-'));
process.env.STUDIO_DATA = path.join(tmp, 'data');
process.env.STUDIO_OUT = path.join(tmp, 'out');
const { server } = await import('../server.mjs');
const { plan } = await import('../lib/planner.mjs');
const { renderLocal, toAspect } = await import('../lib/compose.mjs');
const { probe } = await import('../lib/media.mjs');
const port = await new Promise(r => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const base = `http://127.0.0.1:${port}`;
const shots = process.env.SHOTS || tmp;

const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(base);
  await p.waitForSelector('#engines li.auto-row');
  assert.equal(await p.getAttribute('html', 'dir'), 'rtl');
  assert.ok(await p.isDisabled('#go'), 'create is disabled before an idea');
  await p.fill('#idea', 'שלושה טיפים לזקן מסודר לפני דייט');
  await p.click('#length button[data-v="15"]');
  await p.click('#aspect button[data-v="1:1"]');
  await p.click('#style button[data-v="editorial"]');
  await p.waitForFunction(() => document.querySelectorAll('#scenes li').length >= 3);
  assert.match(await p.textContent('#plan-meta'), /ללמד/);
  assert.match(await p.textContent('#cost'), /חינם/);
  // Manual mode: the only connected engine is local; it must be the one selected.
  await p.click('#engines li.auto-row');
  assert.equal(await p.getAttribute('#engines li:last-child', 'aria-checked'), 'true');
  await p.click('#engines li.auto-row');
  await p.screenshot({ path: path.join(shots, 'e2e-create.png') });
  await p.click('#go');
  await p.waitForSelector('#view-results.active');
  await p.waitForSelector('.result video', { timeout: 300000 });
  const href = await p.getAttribute('.result a.dl', 'href');
  const res = await fetch(base + href);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'video/mp4');
  const file = path.join(tmp, 'dl.mp4'); fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  const pr = await probe(file);
  assert.equal(pr.width, 1080); assert.equal(pr.height, 1080); assert.ok(pr.hasAudio); assert.ok(pr.duration >= 10, `duration ${pr.duration}`);
  // Range requests (scrubbing) work.
  const part = await fetch(base + href.replace('?download=1', ''), { headers: { Range: 'bytes=0-99' } });
  assert.equal(part.status, 206);
  await p.screenshot({ path: path.join(shots, 'e2e-result.png') });
  await p.click('.tabs button[data-view="savings"]');
  await p.waitForSelector('#ledger tbody tr');
  assert.equal(await p.locator('#ledger tbody tr').count(), 5);
  await p.waitForSelector('#history li');
  await p.screenshot({ path: path.join(shots, 'e2e-savings.png') });
  assert.deepEqual(errs, []);
  console.log('ui flow ok', pr);

  // Every aspect ratio exports at the exact canvas.
  const pl = plan('בדיקת יחס מסך', { lengthSec: 6, style: 'minimal', aspect: '16:9' });
  const wide = path.join(tmp, 'wide.mp4');
  await renderLocal(pl, { aspect: '16:9', work: path.join(tmp, 'w169'), out: wide, withVoice: false });
  const pw = await probe(wide); assert.equal(`${pw.width}x${pw.height}`, '1920x1080');
  for (const [a, wh] of [['9:16', '1080x1920'], ['1:1', '1080x1080']]) {
    const o = path.join(tmp, `conv-${a.replace(':', 'x')}.mp4`);
    await toAspect(wide, o, a);
    const q = await probe(o); assert.equal(`${q.width}x${q.height}`, wh);
  }
  console.log('aspects ok: 16:9, 9:16, 1:1');
} finally { await b.close(); server.close(); }
