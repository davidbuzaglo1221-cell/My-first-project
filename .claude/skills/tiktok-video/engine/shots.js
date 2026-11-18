const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => console.log('LOG', m.text()));
  await p.goto('file://' + __dirname + '/index.html');
  await p.evaluate(() => window.READY);
  const ts = process.argv.slice(2).map(Number);
  for (const t of ts) {
    await p.evaluate(t => seek(t), t);
    await p.screenshot({ path: `prev_${t}.png` });
  }
  await b.close();
})();
