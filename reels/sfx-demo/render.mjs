// Renders index.html frame by frame (window.renderAt(t, frame)) to an MP4 through ffmpeg.
// usage: node render.mjs out/silent.mp4 [seconds] [fps] [--stills 0.1,2.5,...]
import { createRequire } from 'module';
import { spawn } from 'child_process';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const out = process.argv[2] || 'out/silent.mp4';
const secs = parseFloat(process.argv[3] || '17.6');
const fps = parseInt(process.argv[4] || '30');
const stillsArg = process.argv.indexOf('--stills');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.resolve('index.html'));
await page.evaluate(() => window.ready);
await page.waitForTimeout(500);
if (stillsArg > 0) {
  for (const t of process.argv[stillsArg + 1].split(',').map(Number)) {
    await page.evaluate(([t, f]) => window.renderAt(t, f), [t, Math.round(t * fps)]);
    await page.screenshot({ path: `work/still-${t.toFixed(2)}.jpg`, type: 'jpeg', quality: 85 });
  }
  await browser.close(); process.exit(0);
}
const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
const n = Math.round(secs * fps);
for (let f = 0; f < n; f++) {
  await page.evaluate(([t, f]) => window.renderAt(t, f), [f / fps, f]);
  const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 60 === 0) process.stderr.write(`frame ${f}/${n}\n`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('wrote', out, n, 'frames');
