// Render the film to MP4, frame by frame, with Playwright + ffmpeg.
// usage: node render_video.js PAGE.html OUT.mp4 AUDIO.wav [--fmt v|h] [--fps 60] [--workers 4]
//        [--libs DIR] [--fonts DIR] [--from S] [--to S]
// --libs/--fonts serve React/htm and the fonts from local copies when the CDNs are unreachable.
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [PAGE, OUT, AUDIO] = args;
const FMT = opt('fmt', 'v'), FPS = +opt('fps', 60), WORKERS = +opt('workers', 4);
const LIBS = opt('libs'), FONTS = opt('fonts');
const W = FMT === 'v' ? 1080 : 1920, H = FMT === 'v' ? 1920 : 1080;

function fontCss() {
  const f = (fam, file, w) => `@font-face{font-family:'${fam}';font-weight:${w};font-display:block;src:url('file://${path.join(FONTS, file)}') format('woff2')}`;
  const out = [];
  const dirs = fs.readdirSync(FONTS);
  for (const d of dirs) {
    const files = path.join(FONTS, d, 'package', 'files');
    if (!fs.existsSync(files)) continue;
    for (const file of fs.readdirSync(files)) {
      const m = file.match(/^(assistant|secular-one|ibm-plex-mono)-(hebrew|latin)-(\d+)-normal\.woff2$/);
      if (!m) continue;
      const fam = {assistant: 'Assistant', 'secular-one': 'Secular One', 'ibm-plex-mono': 'IBM Plex Mono'}[m[1]];
      out.push(f(fam, path.join(d, 'package', 'files', file), m[3]));
    }
  }
  return out.join('\n');
}

async function preparePage(browser) {
  const page = await browser.newPage({viewport: {width: W, height: H}, deviceScaleFactor: 1});
  page.on('pageerror', e => console.error('pageerror', e.message));
  if (LIBS || FONTS) {
    const css = FONTS ? fontCss() : '';
    await page.route(/cdnjs|unpkg|fonts\.g/, r => {
      const u = r.request().url();
      if (/fonts\.googleapis/.test(u)) return r.fulfill({body: css, contentType: 'text/css'});
      if (/fonts\.gstatic/.test(u)) return r.fulfill({body: ''});
      const f = u.includes('react-dom') ? 'react-dom-18.3.1/package/umd/react-dom.production.min.js'
        : u.includes('react') ? 'react-18.3.1/package/umd/react.production.min.js'
        : u.includes('htm') ? 'htm-3.1.1/package/dist/htm.umd.js' : null;
      return f ? r.fulfill({path: path.join(LIBS, f), contentType: 'application/javascript'}) : r.fulfill({body: ''});
    });
  }
  await page.addInitScript(fmt => { window.FJ_RENDER = {fmt}; }, FMT);
  await page.goto('file://' + path.resolve(PAGE));
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page;
}

(async () => {
  const browser = await chromium.launch({args: ['--disable-gpu-vsync', '--force-color-profile=srgb']});
  const probe = await preparePage(browser);
  const total = await probe.evaluate(() => window.__total);
  await probe.close();
  const t0 = +opt('from', 0), t1 = Math.min(+opt('to', total), total);
  const N = Math.round((t1 - t0) * FPS);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fjv-'));
  const per = Math.ceil(N / WORKERS);
  const started = Date.now();
  let done = 0;
  const segs = [];
  await Promise.all(Array.from({length: WORKERS}, async (_, w) => {
    const a = w * per, b = Math.min(N, a + per);
    if (a >= b) return;
    const seg = path.join(tmp, `seg${w}.mp4`);
    segs[w] = seg;
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-g', String(FPS * 2), seg]);
    const page = await preparePage(browser);
    for (let i = a; i < b; i++) {
      await page.evaluate(t => window.__frame(t), t0 + i / FPS);
      const buf = await page.screenshot({type: 'jpeg', quality: 96});
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      done++;
      if (done % 120 === 0) {
        const el = (Date.now() - started) / 1000;
        console.log(`${done}/${N} frames, ${el.toFixed(0)}s elapsed, ~${(el / done * (N - done)).toFixed(0)}s left`);
      }
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    await page.close();
  }));
  await browser.close();
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, segs.filter(Boolean).map(s => `file '${s}'`).join('\n'));
  const fade = Math.max(0, t1 - t0 - 1.2);
  await new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
      '-ss', String(t0), '-t', String(t1 - t0), '-i', AUDIO,
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
      '-af', `loudnorm=I=-14:TP=-1.0:LRA=9,afade=t=out:st=${fade}:d=1.2`, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
      '-movflags', '+faststart', '-shortest', OUT], {stdio: 'inherit'});
    ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c)));
  });
  fs.rmSync(tmp, {recursive: true, force: true});
  console.log('wrote', OUT, ((Date.now() - started) / 1000).toFixed(0) + 's');
})();
