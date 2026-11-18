const { chromium } = require('playwright');
const { spawn } = require('child_process');
const FPS = 30;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + __dirname + '/index.html');
  await p.evaluate(() => window.READY);
  const end = await p.evaluate(() => TL.end);
  const n = Math.ceil(end * FPS);
  const ff = spawn('ffmpeg', ['-y','-v','error','-f','image2pipe','-framerate',String(FPS),'-c:v','png','-i','-',
    '-c:v','libx264','-preset','slow','-crf','15','-pix_fmt','yuv420p','-tune','animation','video_only.mp4'], { stdio: ['pipe','ignore','inherit'] });
  for (let i = 0; i < n; i++) {
    await p.evaluate(t => seek(t), i / FPS);
    const buf = await p.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log('frame', i, '/', n);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await b.close();
})();
