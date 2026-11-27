// Opens every book, its reader, book map and quiz, and checks each screen renders without errors.
const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  await p.addInitScript(() => { try { sessionStorage.setItem('hasifria:opened', '1') } catch {} })
  await p.addInitScript(() => { if (!localStorage.getItem('ascend:v1')) localStorage.setItem('ascend:v1', JSON.stringify({ v: 1, onboarded: true, goals: [], settings: { rate: 1, autoContinue: true, skip: 15 }, progress: {}, notes: [], log: {}, habits: [], journal: [], actions: {}, saved: [], achievements: {}, files: [], readDone: {} })) })
  const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.goto('http://localhost:4173/#/'); await p.waitForTimeout(600)
  const ids = await p.evaluate(() => window.__ascend.books.map((x) => x.id))
  let bad = 0
  for (const id of ids) {
    await p.goto(`http://localhost:4173/#/book/${id}`); await p.waitForTimeout(250)
    const title = await p.locator('.bhero__title').count(), rows = await p.locator('.lrow').count(), map = await p.locator('.bmap__ch').count()
    await p.goto(`http://localhost:4173/#/read/${id}`); await p.waitForSelector('.reader__chtitle', { timeout: 4000 }).catch(() => {}) // the reader loads on demand
    const ch = await p.locator('.reader__chtitle').count(), paras = await p.locator('.rpara').count()
    await p.goto(`http://localhost:4173/#/quiz/${id}`); await p.waitForSelector('.screen', { timeout: 4000 }).catch(() => {})
    const quiz = await p.locator('.screen').count()
    const ok = title && rows >= 5 && (map >= 5 || id === 'as-a-man-thinketh') && ch && paras >= 3 && quiz
    if (!ok) { bad++; console.log('FAIL', id, { title, rows, map, ch, paras, quiz }) }
  }
  console.log(`${ids.length - bad}/${ids.length} books render fully; page errors: ${errs.length}`, errs.slice(0, 3))
  await b.close()
})()
