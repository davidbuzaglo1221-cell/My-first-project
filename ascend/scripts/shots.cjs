const { chromium } = require('playwright')
const OUT = process.argv[2]
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.addInitScript(() => localStorage.setItem('ascend:v1', JSON.stringify({ onboarded: true, goals: [], dailyGoalMin: 10, name: '' })))
  for (const [n, h] of [['home', '#/'], ['book', '#/book/good-to-great'], ['read', '#/read/good-to-great'], ['explore', '#/explore'], ['growth', '#/growth']]) {
    await p.goto('http://localhost:4173/' + h); await p.waitForTimeout(1200)
    await p.screenshot({ path: `${OUT}/${n}.png`, fullPage: n !== 'read' })
  }
  console.log('errors', errs); await b.close()
})()
