// End-to-end checks for search, voice, the assistant (with a stand-in server), appearance, transitions and the
// screens that load on demand. Run against `npm run build:pwa && npx vite preview --port 4173`.
const { chromium } = require('playwright')
let fails = 0
const ok = (c, m, extra = '') => (console.log((c ? 'PASS ' : 'FAIL ') + m, extra), c || fails++)
const B = 'http://localhost:4173/'
const seed = (theme) => ({
  v: 1, onboarded: true, name: '', goals: [], dailyGoalMin: 10, assessment: {}, initialAssessment: {},
  settings: { rate: 1, autoContinue: true, skip: 15, ...(theme ? { theme } : {}) },
  progress: {}, log: {}, habits: [], journal: [], actions: {}, saved: [], achievements: { 'first-step': 1 }, files: [],
})

;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript((s) => {
    try {
      sessionStorage.setItem('hasifria:opened', '1')
      if (!localStorage.getItem('ascend:v1')) localStorage.setItem('ascend:v1', JSON.stringify(s))
    } catch {}
  }, seed())
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()))

  // ---------- smart search ----------
  await p.goto(B + '#/explore')
  await p.waitForSelector('.search--lib input')
  await p.fill('.search--lib input', 'הרגלים')
  await p.waitForTimeout(400)
  const hits = await p.locator('.hit').count()
  ok(hits > 0, 'search: chapters that mention the topic are listed', `(${hits})`)
  ok((await p.locator('.hit__snip mark').count()) > 0, 'search: the matching word is highlighted in the snippet')
  const firstTile = await p.locator('.tiles .tile').first().getAttribute('aria-label').catch(() => '')
  ok(await p.locator('.lib__count').innerText().then((t) => t.includes('המתאימים ביותר')), 'search: books ranked by relevance', firstTile || '')
  await p.fill('.search--lib input', 'ובכסף')
  await p.waitForTimeout(300)
  ok((await p.locator('.tiles .tile').count()) > 0, 'search: a Hebrew prefix still finds money books')
  await p.fill('.search--lib input', 'עושר')
  await p.waitForTimeout(300)
  ok((await p.locator('.tiles .tile').count()) > 0, 'search: a related concept finds books')
  await p.fill('.search--lib input', 'קסקסקס')
  await p.waitForTimeout(300)
  ok(await p.locator('.lib__empty').isVisible(), 'search: a helpful empty state')
  ok((await p.locator('.askcta').count()) === 0, 'search: no "ask the library" link while no assistant is connected')
  await p.fill('.search--lib input', 'הרגלים')
  await p.waitForTimeout(300)
  const title = await p.locator('.hit__title').first().innerText()
  await p.locator('.hit__main').first().click()
  await p.waitForSelector('.reader__chtitle', { timeout: 5000 })
  ok((await p.locator('.reader__chtitle').innerText()).includes(title.slice(0, 8)), 'search: a chapter hit opens the reader at that chapter', title)

  // ---------- voice search button ----------
  await p.goto(B + '#/explore')
  await p.waitForSelector('.search--lib input')
  const hasRec = await p.evaluate(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition))
  ok((await p.locator('.search__mic').count()) === (hasRec ? 1 : 0), 'voice search: the microphone appears only where speech recognition exists', `(supported: ${hasRec})`)

  // ---------- assistant without a server: honest state, and leaving it does not crash ----------
  await p.goto(B + '#/book/atomic-habits')
  await p.waitForTimeout(800)
  ok((await p.locator('text=שאל את הספר').count()) === 0, 'book: no "ask the book" button while no assistant is connected')
  await p.goto(B + '#/ask/atomic-habits')
  await p.waitForSelector('.ask__off', { timeout: 5000 })
  ok(true, 'assistant: says plainly that it is not connected (no made-up answers)')
  await p.goto(B + '#/')
  await p.waitForTimeout(500)

  // ---------- assistant with a stand-in server (the real route is unit-tested separately) ----------
  const p2 = await ctx.newPage()
  p2.on('pageerror', (e) => errs.push(e.message))
  let asked
  await p2.route('**/api/assistant', async (route) => {
    const req = route.request()
    if (req.method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ chat: true, tts: false }) })
    asked = JSON.parse(req.postData())
    return route.fulfill({ contentType: 'text/plain; charset=utf-8', body: 'התחל בהרגל של שתי דקות.' })
  })
  await p2.goto(B + '#/book/atomic-habits')
  await p2.waitForSelector('.tool >> text=שאל את הספר', { timeout: 5000 })
  ok(true, 'book: "ask the book" appears once an assistant is connected')
  await p2.click('.tool >> text=שאל את הספר')
  await p2.waitForSelector('.ask__intro', { timeout: 5000 })
  await p2.fill('.ask__bar input', 'איך מתחילים?')
  await p2.click('.ask__send')
  await p2.waitForSelector('.bubble--assistant >> text=שתי דקות', { timeout: 5000 })
  ok(asked && asked.bookId === 'atomic-habits' && asked.messages.at(-1).content === 'איך מתחילים?', 'assistant: sends only the book id and the conversation', JSON.stringify(asked))
  ok((await p2.locator('.bubble__tools >> text=הקרא').count()) === 1, 'assistant: every answer can be read aloud')
  await p2.click('.bubble__tools >> text=שמור במחברת')
  ok(await p2.evaluate(() => window.__ascend.store.get().notes.some((n) => n.text.includes('שתי דקות'))), 'assistant: an answer can be saved to the notebook')
  await p2.goto(B + '#/ask')
  await p2.waitForSelector('text=שאל את הספרייה', { timeout: 5000 })
  ok(true, 'assistant: the whole-library guide opens without a book')
  await p2.goto(B + '#/explore')
  await p2.fill('.search--lib input', 'כסף')
  await p2.waitForSelector('.askcta', { timeout: 3000 })
  ok(true, 'search: "ask the library" is offered next to results when an assistant is connected')
  await p2.close()

  // ---------- appearance ----------
  await p.goto(B + '#/settings')
  await p.waitForSelector('text=מראה ותחושה', { timeout: 5000 })
  ok((await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'appearance: night by default')
  await p.click('.seg__btn >> text=יום')
  await p.waitForTimeout(500)
  ok((await p.evaluate(() => document.documentElement.dataset.theme)) === 'light', 'appearance: switches to day')
  await p.reload()
  await p.waitForTimeout(300)
  ok((await p.evaluate(() => [document.documentElement.dataset.theme, document.querySelector('meta[name=theme-color]').content].join())) === 'light,#f5f2eb', 'appearance: day is applied before the first paint after reload')
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor)
  ok(bg === 'rgb(245, 242, 235)', 'appearance: the page itself turns light', bg)
  await p.goto(B + '#/read/atomic-habits')
  await p.waitForSelector('.reader', { timeout: 5000 })
  ok(await p.locator('.reader--ivory').count(), 'appearance: the reader follows day with ivory paper')
  await p.goto(B + '#/settings')
  await p.waitForSelector('text=מראה ותחושה')
  await p.click('.seg__btn >> text=לילה')
  await p.waitForTimeout(400)
  ok((await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'appearance: back to night')

  // ---------- transitions & on-demand screens ----------
  await p.goto(B + '#/')
  await p.waitForTimeout(2600) // the other screens are fetched quietly after two seconds
  const loaded = await p.evaluate(() => performance.getEntriesByType('resource').filter((r) => /Reader|Settings|Ask|Quiz/.test(r.name)).length)
  ok(loaded >= 4, 'performance: screens opened later are prefetched after the first paint (offline-ready)', `(${loaded})`)
  ok(await p.evaluate(() => typeof document.startViewTransition === 'function'), 'motion: this browser supports view transitions')
  await p.evaluate(() => window.location.assign('#/book/atomic-habits'))
  await p.waitForTimeout(500)
  await p.click('.back-btn')
  await p.waitForTimeout(600)
  ok((await p.evaluate(() => location.hash)) !== '#/book/atomic-habits', 'motion: back navigation with a transition lands on the previous screen')
  ok(!(await p.evaluate(() => document.documentElement.dataset.nav)), 'motion: the transition cleans up after itself')
  await p.locator('.tab').nth(1).click()
  await p.waitForTimeout(500)
  ok(await p.evaluate(() => location.hash.length > 0), 'motion: a tab switch navigates')

  // ---------- reduced motion ----------
  const p3 = await ctx.newPage()
  await p3.emulateMedia({ reducedMotion: 'reduce' })
  await p3.goto(B + '#/')
  await p3.waitForTimeout(500)
  await p3.locator('.tab').nth(2).click()
  await p3.waitForTimeout(200)
  ok(!(await p3.evaluate(() => document.documentElement.dataset.nav)), 'motion: no transitions under reduced motion')
  await p3.close()

  ok(errs.length === 0, 'no page or console errors', JSON.stringify(errs))
  await b.close()
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
  process.exit(fails ? 1 : 0)
})()
