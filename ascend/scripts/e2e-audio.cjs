const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  await p.addInitScript(() => { try { sessionStorage.setItem("hasifria:opened", "1") } catch {} }) // the opening is tested on its own
  const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.addInitScript(() => localStorage.setItem('ascend:v1', JSON.stringify({ onboarded: true, goals: [], dailyGoalMin: 10, name: '', settings: { rate: 1, autoContinue: true, skip: 15 } })))
  await p.goto('http://localhost:4173/#/book/psychology-of-money')
  await p.waitForTimeout(800)
  const st = () => p.evaluate(() => { const s = window.__ascend.player.get(); return { id: s.track?.id, st: s.status, pos: +s.position.toFixed(2), dur: s.duration, seg: s.segment, nsegs: s.segments.length } })
  // chapter 3: plays from its own offset inside the book file
  await p.evaluate(() => window.__ascend.load('psychology-of-money-3', { autoplay: true, from: 0 }))
  await p.waitForTimeout(3000)
  console.log('ch3', JSON.stringify(await st()), await p.evaluate(() => document.querySelector('audio')?.currentTime ?? [...document.querySelectorAll('*')].length))
  // seek near chapter end -> ends exactly at chapter end, then auto-continues to ch4
  const d = (await st()).dur
  await p.evaluate((t) => window.__ascend.seek(t, true), d - 1.5)
  await p.waitForTimeout(2500)
  console.log('after end', JSON.stringify(await st()))
  await p.waitForTimeout(2500)
  console.log('next', JSON.stringify(await st()))
  console.log('settings', JSON.stringify(await p.evaluate(() => window.__ascend.store.get().settings)), 'audioTime', await p.evaluate(() => 0)); console.log('errors', errs)
  await b.close()
})()
