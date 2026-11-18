// Renders the video in N parallel parts (one browser each), then joins them.
// Usage: node render.js [parts=3]
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const FPS = 30, PARTS = +(process.argv[2] || 3);
async function part(k, from, to) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + __dirname + '/index.html');
  await p.evaluate(() => window.READY);
  const ff = spawn('ffmpeg', ['-y','-v','error','-f','image2pipe','-framerate',String(FPS),'-c:v','png','-i','-',
    '-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-tune','animation',`part_${k}.mp4`], { stdio: ['pipe','ignore','inherit'] });
  for (let i = from; i < to; i++) {
    await p.evaluate(t => seek(t), i / FPS);
    const buf = await p.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((i - from) % 150 === 0) console.log(`part ${k}: ${i - from}/${to - from}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close();
}
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + __dirname + '/index.html');
  const n = Math.ceil(await p.evaluate(() => TL.end) * FPS); await b.close();
  const step = Math.ceil(n / PARTS), jobs = [];
  for (let k = 0; k < PARTS; k++) jobs.push(part(k, k * step, Math.min(n, (k + 1) * step)));
  await Promise.all(jobs);
  fs.writeFileSync('parts.txt', [...Array(PARTS).keys()].map(k => `file 'part_${k}.mp4'`).join('\n'));
  execFileSync('ffmpeg', ['-y','-v','error','-f','concat','-safe','0','-i','parts.txt','-c','copy','video_only.mp4']);
  console.log('DONE', n, 'frames');
})();
