const { chromium } = require('playwright')
;(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined
  const b = await chromium.launch({ proxy, args: ['--autoplay-policy=no-user-gesture-required', '--ignore-certificate-errors'] })
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true })
  await p.addInitScript(() => { try { sessionStorage.setItem("hasifria:opened", "1") } catch {} }) // the opening is tested on its own
  const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  const B = 'https://davidbuzaglo1221-cell.github.io/My-first-project/'
  await p.goto(B, { waitUntil: 'networkidle', timeout: 60000 })
  await p.screenshot({ path: (process.argv[2] || require('os').tmpdir()) + '/live1.png' })
  await p.click('text=כניסה אל המסע שלי'); await p.waitForTimeout(800)
  await p.goto(B + '#/book/good-to-great'); await p.waitForTimeout(1200)
  await p.click('.bhero__actions .btn--primary'); await p.waitForTimeout(6000)
  const st = await p.evaluate(() => { const s = window.__ascend.player.get(); return { id: s.track?.id, st: s.status, pos: +s.position.toFixed(1), d: s.duration } })
  console.log('play', JSON.stringify(st))
  await p.evaluate(() => window.__ascend.pause())
  await p.goto(B + '#/'); await p.waitForTimeout(1000); await p.screenshot({ path: (process.argv[2] || require('os').tmpdir()) + '/live2.png' })
  console.log('errors', errs); await b.close()
})()
