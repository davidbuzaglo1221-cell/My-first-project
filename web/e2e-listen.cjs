// End-to-end run of the listening player: every control, both engines, the cloud-to-device
// fallback, continue-listening and the next-lesson hand-off. Needs a running app:
//   npm run build && npx next start -p 3100   then   node e2e-listen.cjs
// /api/tts is mocked so no key is needed. With CLIPS_DIR set (a folder of real synthesized
// clips + manifest.json from .claude/skills/speech-quality-testing/scripts/synth_local.py),
// the mock answers with real speech audio matched by sentence; otherwise with a tone.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:3100';
const SHOTS = process.env.SHOTS_DIR || path.resolve(__dirname, '../replica/clone-screens');
const ok = (...a) => console.log('✓', ...a);

// Real clips by spoken text, when available.
const clips = new Map();
if (process.env.CLIPS_DIR && process.env.CORPUS) {
  const corpus = JSON.parse(fs.readFileSync(process.env.CORPUS, 'utf8'));
  const byId = new Map(corpus.map((r) => [r.id, r]));
  for (const m of JSON.parse(fs.readFileSync(path.join(process.env.CLIPS_DIR, 'manifest.json'), 'utf8'))) {
    if (m.variant !== 'app') continue;
    const r = byId.get(m.id);
    if (r) clips.set(r.parts.map((p) => p.text).join('|'), path.isAbsolute(m.file) ? m.file : path.resolve(process.env.CLIPS_DIR, '..', m.file));
  }
}

// 0.6 s 440 Hz tone, for runs without real clips.
function tone() {
  const sr = 8000, n = sr * 0.6, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sr) * 8000), 44 + i * 2);
  return buf;
}
const TONE = tone();

// A stand-in speechSynthesis with one Hebrew voice, for the device engine (headless Chromium has none).
const FAKE_SYNTH = `
  (() => {
    const voices = [{ voiceURI: 'carmit', name: 'Carmit', lang: 'he-IL', localService: true, default: true }, { voiceURI: 'samantha', name: 'Samantha', lang: 'en-US', localService: true, default: false }];
    const spoken = (window.__spoken = []);
    let timer = null, current = null;
    const synth = {
      getVoices: () => voices, speaking: false, paused: false, pending: false,
      addEventListener() {}, removeEventListener() {},
      speak(u) { if (!u.text.trim()) return; synth.cancel(); current = u; spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice && u.voice.name });
        setTimeout(() => u.onstart && u.onstart({}), 10);
        timer = setTimeout(() => { current = null; u.onend && u.onend({}); }, Math.max(250, u.text.length * 12 / u.rate)); },
      cancel() { if (timer) clearTimeout(timer); if (current && current.onerror) current.onerror({ error: 'interrupted' }); current = null; },
      pause() {}, resume() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth });
    window.SpeechSynthesisUtterance = function (text) { this.text = text; this.lang = ''; this.rate = 1; this.volume = 1; this.voice = null; };
  })();`;

// Keep a handle on the player's <audio>, which lives outside the DOM.
const GRAB_AUDIO = `
  (() => { const A = window.Audio; window.__audios = []; window.Audio = function (...a) { const el = new A(...a); window.__audios.push(el); return el; }; window.Audio.prototype = A.prototype; })();`;

async function setup(browser, { cloud = true, device = false, failPost = false, theme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL', hasTouch: true, isMobile: true, colorScheme: theme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(GRAB_AUDIO);
  if (device) await page.addInitScript(FAKE_SYNTH);
  const posts = [];
  await page.route('**/api/tts', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({ json: cloud ? { provider: 'google', voices: [{ id: 'google:Kore', label: 'קורה', gender: 'female' }, { id: 'google:Charon', label: 'כארון', gender: 'male' }] } : { provider: null, voices: [] } });
    }
    const body = req.postDataJSON();
    posts.push(body);
    if (failPost) return route.fulfill({ status: 502, json: { error: 'engine_failed' } });
    const file = clips.get(body.parts.map((p) => p.text).join('|'));
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: file ? fs.readFileSync(file) : TONE });
  });
  return { ctx, page, posts, errors };
}

const counter = (page) => page.locator('section[aria-label="נגן ההאזנה"] [role=progressbar]');
const pos = async (page) => Number((await counter(page).getAttribute('aria-valuenow')) || 0);
const playBtn = (page) => page.locator('section[aria-label="נגן ההאזנה"]').getByRole('button', { name: /^(השהיה|השמעה|השמעה מההתחלה)$/ });
const bar = (page) => page.locator('section[aria-label="נגן ההאזנה"]');
const waitPlaying = (page) => page.waitForFunction(() => document.querySelector('section[aria-label="נגן ההאזנה"] [aria-pressed="true"]'), null, { timeout: 15000 });

(async () => {
  const browser = await chromium.launch();
  const allErrors = [];

  // ---- cloud engine: every control ------------------------------------------------------
  {
    const { page, posts, errors, ctx } = await setup(browser);
    await page.goto(BASE + '/learn/read?id=rest', { waitUntil: 'networkidle' });
    const start = page.getByRole('button', { name: 'האזנה לשיעור' });
    await start.waitFor(); await page.getByText('כדקה האזנה').waitFor();
    await page.screenshot({ path: `${SHOTS}/L01-lesson-listen.png` }); ok('start button with listening time');

    await start.click(); await waitPlaying(page);
    if ((await pos(page)) !== 1) throw new Error('should start at sentence 1');
    const title = await page.evaluate(() => navigator.mediaSession.metadata && navigator.mediaSession.metadata.title);
    if (title !== 'כמה לנוח בין סטים') throw new Error('media session title: ' + title);
    ok('play: starts at sentence 1, lock-screen title set');

    await page.waitForFunction(() => Number(document.querySelector('section[aria-label="נגן ההאזנה"] [role=progressbar]').getAttribute('aria-valuenow')) >= 2, null, { timeout: 30000 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/L02-player-playing.png` }); ok('continuous: moves to the next sentence by itself');
    const highlighted = await page.locator('[aria-current="true"][data-sentence]').innerText();
    if (!highlighted.trim()) throw new Error('no highlighted sentence'); ok('current sentence highlighted:', highlighted.slice(0, 30) + '…');

    await playBtn(page).click(); // pause
    await page.waitForFunction(() => !document.querySelector('section[aria-label="נגן ההאזנה"] [aria-pressed="true"]'));
    const at = await pos(page); const t0 = await page.evaluate(() => window.__audios[0].currentTime);
    await page.waitForTimeout(1200);
    if ((await pos(page)) !== at || (await page.evaluate(() => window.__audios[0].paused)) !== true) throw new Error('pause did not hold');
    ok('pause holds position');
    await playBtn(page).click(); await waitPlaying(page);
    const t1 = await page.evaluate(() => window.__audios[0].currentTime);
    if (t1 + 0.05 < t0) throw new Error(`resume restarted the clip (${t0} → ${t1})`);
    ok('resume continues mid-sentence');

    const before = await pos(page);
    await bar(page).getByRole('button', { name: 'המשפט הבא' }).click(); await waitPlaying(page);
    if ((await pos(page)) !== before + 1) throw new Error('next');
    ok('next sentence');
    const postsBefore = posts.length;
    const p1 = await pos(page);
    await page.waitForTimeout(300);
    await bar(page).getByRole('button', { name: 'חזרה על המשפט' }).click(); await waitPlaying(page);
    const ct = await page.evaluate(() => window.__audios[0].currentTime);
    if ((await pos(page)) !== p1 || ct > 0.5) throw new Error('repeat');
    const sameText = posts.slice(postsBefore).filter((p) => JSON.stringify(p.parts) === JSON.stringify(posts[postsBefore - 1] && posts[postsBefore - 1].parts)).length;
    ok('repeat sentence from its start' + (sameText ? '' : ' (served from cache, no new request)'));
    const cur = await pos(page);
    await bar(page).getByRole('button', { name: 'המשפט הקודם' }).click(); await waitPlaying(page);
    if ((await pos(page)) !== Math.max(cur - 1, 1)) throw new Error('previous sentence: ' + cur + ' → ' + (await pos(page)));
    ok('previous sentence (tapped right after a sentence starts)');
    if (clips.size) {
      // With real speech the sentence is long enough to test "restart this one" after 2 s.
      await page.waitForTimeout(2300);
      const mid = await pos(page);
      const clipLeft = await page.evaluate(() => window.__audios[0].duration - window.__audios[0].currentTime);
      if (clipLeft > 0.3) {
        await bar(page).getByRole('button', { name: 'המשפט הקודם' }).click(); await waitPlaying(page);
        if ((await pos(page)) !== mid) throw new Error('previous after 2 s should restart the sentence');
        ok('previous after 2 s restarts the current sentence');
      }
    }

    await bar(page).getByRole('button', { name: /^מהירות/ }).click();
    await bar(page).getByRole('button', { name: /^מהירות 1\.15×/ }).waitFor();
    const rate = await page.evaluate(() => window.__audios[0].playbackRate);
    if (Math.abs(rate - 1.15) > 0.001) throw new Error('rate ' + rate);
    ok('speed chip cycles and applies instantly (playbackRate ' + rate + ')');

    await bar(page).getByRole('button', { name: 'קול ומהירות' }).click();
    const dialog = page.getByRole('dialog', { name: 'קול ומהירות' }); await dialog.waitFor();
    await page.waitForTimeout(400); await page.screenshot({ path: `${SHOTS}/L03-voice-sheet.png` });
    await dialog.getByRole('radio', { name: '1.3×' }).click();
    if (Math.abs((await page.evaluate(() => window.__audios[0].playbackRate)) - 1.3) > 0.001) throw new Error('sheet speed');
    await dialog.getByRole('radio', { name: /כארון/ }).click();
    await page.waitForFunction(() => true);
    await page.waitForTimeout(600);
    if (posts[posts.length - 1].voice !== 'google:Charon' && !posts.some((p) => p.voice === 'google:Charon')) throw new Error('voice not applied');
    if ((await dialog.getByRole('radio', { name: /כארון/ }).getAttribute('aria-checked')) !== 'true') throw new Error('voice not checked');
    await page.keyboard.press('Escape');
    ok('voice sheet: speed and voice change (requests now use google:Charon)');

    const target = page.locator('[data-sentence="1"]');
    await target.click(); await waitPlaying(page);
    if ((await pos(page)) !== 2) throw new Error('tap sentence → ' + (await pos(page)));
    ok('tapping a sentence jumps there');

    // Continue listening after leaving
    await bar(page).getByRole('button', { name: 'סגירת הנגן' }).click();
    await bar(page).waitFor({ state: 'detached' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'המשך האזנה' }).waitFor(); await page.getByText(/ממשפט 2 מתוך/).waitFor();
    await page.screenshot({ path: `${SHOTS}/L04-continue.png` });
    await page.getByRole('button', { name: 'המשך האזנה' }).click(); await waitPlaying(page);
    if ((await pos(page)) !== 2) throw new Error('continue from 2');
    ok('close + reload → "continue listening" from sentence 2, speed kept: ' + (await bar(page).getByRole('button', { name: /^מהירות/ }).innerText()));

    // To the end, then on to the next lesson
    const total = Number(await counter(page).getAttribute('aria-valuemax'));
    await page.evaluate((t) => document.querySelector(`[data-sentence="${t - 1}"]`).click(), total);
    await page.getByRole('button', { name: /להאזין לשיעור הבא/ }).waitFor({ timeout: 30000 });
    await page.screenshot({ path: `${SHOTS}/L05-ended.png` }); ok('end of lesson offers the next one');
    await page.getByRole('button', { name: /להאזין לשיעור הבא/ }).click();
    await page.waitForURL('**id=warmup**'); await waitPlaying(page);
    ok('next lesson starts playing on arrival');
    allErrors.push(...errors); await ctx.close();
  }

  // ---- dark mode look -------------------------------------------------------------------
  {
    const { page, ctx, errors } = await setup(browser, { theme: 'dark' });
    await page.goto(BASE + '/learn/read?id=protein', { waitUntil: 'networkidle' });
    // Dark is opt-in in the app (profile setting → data-theme="dark").
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.getByRole('button', { name: 'האזנה לשיעור' }).click(); await waitPlaying(page);
    await page.waitForTimeout(300); await page.screenshot({ path: `${SHOTS}/L06-player-dark.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) throw new Error('horizontal overflow ' + overflow);
    ok('dark mode, no horizontal overflow at 390 px');
    allErrors.push(...errors); await ctx.close();
  }

  // ---- device engine (no cloud key) -----------------------------------------------------
  {
    const { page, ctx, errors, posts } = await setup(browser, { cloud: false, device: true });
    await page.goto(BASE + '/learn/read?id=double-progression', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'האזנה לשיעור' }).click(); await waitPlaying(page);
    await page.waitForFunction(() => Number(document.querySelector('section[aria-label="נגן ההאזנה"] [role=progressbar]').getAttribute('aria-valuenow')) >= 3, null, { timeout: 20000 });
    const spoken = await page.evaluate(() => window.__spoken);
    const nums = spoken.map((s) => s.text).join(' ');
    if (/\d/.test(nums)) throw new Error('device voice got digits: ' + nums);
    if (spoken[0].voice !== 'Carmit' || spoken[0].lang !== 'he-IL') throw new Error('voice ' + JSON.stringify(spoken[0]));
    if (posts.length) throw new Error('device engine called the cloud');
    ok('device voice: Hebrew voice, normalized text ("' + spoken.find((s) => /שמונה/.test(s.text)).text.slice(0, 40) + '…")');
    await bar(page).getByRole('button', { name: /^מהירות/ }).click();
    await page.waitForFunction(() => window.__spoken.some((s) => s.rate === 1.15));
    ok('device voice: speed applies');
    await playBtn(page).click();
    const n = await page.evaluate(() => window.__spoken.length); await page.waitForTimeout(1000);
    if ((await page.evaluate(() => window.__spoken.length)) !== n) throw new Error('device pause');
    await playBtn(page).click(); await waitPlaying(page);
    ok('device voice: pause and resume');
    allErrors.push(...errors); await ctx.close();
  }

  // ---- no voice at all ------------------------------------------------------------------
  {
    const { page, ctx, errors } = await setup(browser, { cloud: false, device: false });
    await page.goto(BASE + '/learn/read?id=rest', { waitUntil: 'networkidle' });
    await page.getByText('ההקראה לא זמינה בדפדפן הזה').waitFor();
    if (await page.getByRole('button', { name: 'האזנה לשיעור' }).count()) throw new Error('dead button shown');
    ok('no voice: explains instead of showing a dead button');
    allErrors.push(...errors); await ctx.close();
  }

  // ---- cloud fails → device takes over --------------------------------------------------
  {
    const { page, ctx, errors } = await setup(browser, { cloud: true, device: true, failPost: true });
    await page.goto(BASE + '/learn/read?id=rest', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'האזנה לשיעור' }).click();
    await page.getByText('הקול המקוון לא זמין כרגע').waitFor(); await waitPlaying(page);
    ok('cloud failure: switches to the device voice and keeps going');
    allErrors.push(...errors); await ctx.close();
  }

  console.log('\nerrors:', allErrors.length ? allErrors : 'none');
  await browser.close();
  if (allErrors.length) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
