// End-to-end: a real browser against a real server.
// Characters (with reference images) -> idea with a two-character dialogue -> free local render -> gallery -> MP4 download,
// plus the Engines and Costs screens, and every aspect ratio measured. Run: npm run e2e
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));

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
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: process.env.SHOTS ? 2 : 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('dialog', d => d.accept());
  await p.goto(base);
  await p.waitForSelector('#engines li.auto-row');
  assert.equal(await p.getAttribute('html', 'dir'), 'rtl');
  assert.ok(await p.isDisabled('#go'), 'create is disabled before an idea');

  // 1. Character library: two characters with reference images.
  await p.click('.tabs button[data-view="characters"]');
  for (const [name, look, voice, img] of [['עגבנייה', 'עגבנייה עגולה ומבריקה עם כתר עלים', 'bright-f', 'tomato.png'], ['מלפפון', 'מלפפון גבוה, עייף ובטוח בעצמו', 'giant', 'cucumber.png']]) {
    await p.click('#new-char');
    await p.fill('#cf-name', name); await p.selectOption('#cf-kind', 'fruit'); await p.fill('#cf-look', look); await p.selectOption('#cf-voice', voice);
    await p.setInputFiles('#cf-image', path.join(HERE, 'fixtures', img));
    await p.waitForSelector('#cf-preview:not([hidden])');
    await p.click('#cf-save');
    await p.waitForFunction(n => [...document.querySelectorAll('#chars .title')].some(t => t.textContent === n), name);
  }
  assert.equal(await p.locator('#chars li').count(), 2);
  assert.equal(await p.locator('#chars .tag.free').count(), 2, 'both have a reference image');
  await p.screenshot({ path: path.join(shots, 'e2e-characters.png') });

  // 2. Create: pick both, idea, auto style, 15 s, 9:16.
  await p.click('.tabs button[data-view="create"]');
  await p.click('.cast-item:has-text("עגבנייה")'); await p.click('.cast-item:has-text("מלפפון")');
  await p.fill('#idea', 'ריב גדול במקרר: מי ייכנס ראשון לסלט');
  await p.click('#length button[data-v="15"]');
  await p.waitForFunction(() => document.querySelectorAll('#scenes li').length >= 4);
  const who = await p.$$eval('#scenes .who', n => [...new Set(n.map(x => x.textContent))]);
  assert.ok(who.includes('עגבנייה') && who.includes('מלפפון'), `dialogue speakers: ${who}`);
  assert.match(await p.textContent('#cost'), /חינם/);
  await p.click('#plan summary');
  await p.screenshot({ path: path.join(shots, 'e2e-create.png') });
  await p.click('#go');

  // 3. Gallery: progress, then a verified, playable MP4.
  await p.waitForSelector('#view-gallery.active');
  await p.waitForSelector('.result video', { timeout: 300000 });
  const href = await p.getAttribute('.result a.primary', 'href');
  const res = await fetch(base + href);
  assert.equal(res.status, 200); assert.equal(res.headers.get('content-type'), 'video/mp4');
  const file = path.join(tmp, 'dl.mp4'); fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  const pr = await probe(file);
  assert.equal(`${pr.width}x${pr.height}`, '1080x1920'); assert.ok(pr.hasAudio); assert.ok(pr.duration >= 10 && pr.duration <= 19, `duration ${pr.duration}`);
  assert.equal((await fetch(base + href.replace('?download=1', ''), { headers: { Range: 'bytes=0-99' } })).status, 206);
  await p.waitForSelector('.gallery .card img');
  await p.screenshot({ path: path.join(shots, 'e2e-gallery.png') });

  // 4. Engines + costs screens render from live data; no unverified balance is shown as a number.
  await p.click('.tabs button[data-view="engines"]');
  await p.waitForSelector('.eng-card');
  assert.ok(await p.locator('.eng-card').count() >= 6);
  await p.screenshot({ path: path.join(shots, 'e2e-engines.png') });
  await p.click('.tabs button[data-view="costs"]');
  await p.waitForSelector('#ledger tbody tr');
  const balances = await p.$$eval('#ledger tbody tr td:nth-child(3)', t => t.map(x => x.childNodes[0].textContent));
  assert.ok(balances.every(v => v === '∞' || v === 'לא אומת' || v === 'השירות לא החזיר יתרה' || /^\d+$/.test(v)), balances.join('|'));
  await p.waitForSelector('#history li');
  await p.screenshot({ path: path.join(shots, 'e2e-costs.png') });
  assert.deepEqual(errs, []);
  console.log('ui flow ok', pr);

  // 5. Every aspect ratio exports at the exact canvas.
  const pl = plan('בדיקת יחס מסך', { lengthSec: 6, style: 'mixed', aspect: '16:9' });
  const wide = path.join(tmp, 'wide.mp4');
  await renderLocal(pl, { aspect: '16:9', work: path.join(tmp, 'w169'), out: wide, withVoice: false });
  assert.equal(`${(await probe(wide)).width}x${(await probe(wide)).height}`, '1920x1080');
  for (const [a, wh] of [['9:16', '1080x1920'], ['1:1', '1080x1080']]) {
    const o = path.join(tmp, `conv-${a.replace(':', 'x')}.mp4`);
    await toAspect(wide, o, a);
    const q = await probe(o); assert.equal(`${q.width}x${q.height}`, wh);
  }
  console.log('aspects ok: 16:9, 9:16, 1:1');
  if (process.env.KEEP) fs.copyFileSync(file, process.env.KEEP);
} finally { await b.close(); server.close(); }
