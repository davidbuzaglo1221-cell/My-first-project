const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + __dirname + '/index.html');
  const r = await p.evaluate(() => ({cuts: Object.entries(SHOTS).flatMap(([k,v])=>Object.values(v)), twist: S.twist.start, outro: S.outro.start, end: TL.end}));
  require('fs').writeFileSync('cuts.json', JSON.stringify(r)); await b.close();
})();
