const { chromium } = require('playwright')
const OUT = process.argv[2]
const pages = (process.argv[3] || 'home:#/').split(',').map((x) => x.split(':'))
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await p.addInitScript(() => { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('ascend:v1', JSON.stringify({ v: 1, onboarded: true, goals: [], dailyGoalMin: 10, name: '', settings: { rate: 1, autoContinue: true, skip: 15 }, progress: { 'atomic-habits-1': { pos: 0, dur: 50, done: true, last: Date.now() }, 'atomic-habits-2': { pos: 20, dur: 50, done: false, last: Date.now() }, 'good-to-great-1': { pos: 0, dur: 40, done: true, last: Date.now() - 1000 } }, readDone: { 'good-to-great-2': 1 }, notes: [{ id: 'n1', kind: 'love', bookId: 'good-to-great', lessonId: 'good-to-great-1', para: 0, quote: 'רוב החברות, ורוב האנשים, לא נעשים גדולים בדיוק כי הם טובים מספיק.', text: '', at: Date.now() }, { id: 'n2', kind: 'note', bookId: 'atomic-habits', text: 'לחבר הרגל חדש להרגל קיים: אחרי הקפה, עמוד אחד.', at: Date.now() }], log: {}, habits: [], journal: [], actions: {}, saved: [], achievements: {}, files: [], assessment: {}, initialAssessment: {} })) } })
  for (const [n, h] of pages) {
    await p.goto('http://localhost:4173/' + h); await p.waitForTimeout(1300)
    await p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true })
  }
  console.log('errors', errs); await b.close()
})()
