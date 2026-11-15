// Audio test: a fake speechSynthesis that behaves like iOS Safari (drops speak() issued within 150ms of cancel(),
// fires onstart/onend), plus a Claude voice that rejects Hebrew. Checks that every line of an episode is spoken.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const page0 = fs.readFileSync(path.join(__dirname, 'dist', 'app.html'), 'utf8');
const html = `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page0}</body></html>`;
async function run(label, opts) {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript((o) => {
    localStorage.setItem('growth.state', JSON.stringify({ profile: { name: 'אורי', say: 'אוּרִי', focus: [] } }));
    window.__said = []; let lastCancel = 0, queue = [], busy = false;
    class U { constructor(t) { this.text = t; } }
    const next = () => { if (busy || !queue.length) return; const u = queue.shift(); busy = true;
      setTimeout(() => { u.onstart && u.onstart(); window.__said.push(u.text); setTimeout(() => { busy = false; u.onend && u.onend(); next(); }, 25); }, 10); };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: U, configurable: true });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speaking: false, pending: false, paused: false,
      getVoices: () => o.voices ? [{ name: 'Carmit', lang: 'he-IL', localService: true }] : [],
      speak(u) { if (o.dead) return; if (Date.now() - lastCancel < 150) return; /* iOS drops it */ queue.push(u); next(); },
      cancel() { lastCancel = Date.now(); queue = []; }, resume() {}, addEventListener() {} } });
    const tts = o.claudeTts ? { speak: async () => { throw { code: 'invalid_argument' }; }, stop() {} } : null;
    window.claude = { use: async (n) => (n === 'tts' ? tts : null) };
  }, opts);
  await p.route('https://app.test/', r => r.fulfill({ contentType: 'text/html', body: html })); await p.goto('https://app.test/');
  await p.waitForTimeout(2600);
  await p.click('.burger'); await p.waitForTimeout(300); await p.click('#drawer [data-arg=saving]'); await p.waitForTimeout(300);
  await p.click('.eps .ep >> nth=0');
  await p.waitForSelector('.modal', { timeout: 30000 }).catch(() => {});
  const r = await p.evaluate(() => ({ said: window.__said.filter((t) => t.trim()).length, lines: TOPICS.find(t => t.id === 'saving').episodes[0].lines.length, help: !!document.querySelector('.modal ol'), quiz: !!document.querySelector('.modal [data-i]'), diag: Voice.diag(), name: window.__said.find(t => t.includes('אוּרִי')) || null }));
  // name test from the profile button speaks the niqqud spelling
  await p.evaluate(() => { document.querySelector('.modal')?.remove(); });
  console.log(label, JSON.stringify(r), errs.length ? errs : '');
  await b.close();
}
(async () => {
  await run('iPhone-like:', { voices: true, claudeTts: false });
  await run('Claude voice rejects Hebrew:', { voices: false, claudeTts: true });
  await run('Device silent (expect help):', { voices: true, claudeTts: false, dead: true });
})();
