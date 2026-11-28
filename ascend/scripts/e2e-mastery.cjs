// End-to-end checks for self-mastery: the day, sleep, screen time and the scroll pause, the private urge vault,
// the discipline ladder and the speech lab (with Chromium's fake microphone).
const { chromium } = require('playwright')
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m)
;(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] })
  const p = await ctx.newPage()
  const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.addInitScript(() => { try { sessionStorage.setItem('hasifria:opened', '1'); if (!localStorage.getItem('ascend:v1')) localStorage.setItem('ascend:v1', JSON.stringify({ onboarded: true })) } catch {} })
  const S = () => p.evaluate(() => window.__ascend.store.get())
  const U = 'http://localhost:4173/#'

  // hub and tab
  await p.goto(U + '/mastery'); await p.waitForTimeout(700)
  ok((await p.locator('.mastery .glist__row').count()) >= 6, 'hub lists the six areas')
  ok(await p.locator('.tab--more.is-on').isVisible(), 'the "עוד" tab is active')

  // the day: focus, slots, spoken tasks parsed and confirmed, cap of three
  await p.goto(U + '/mastery/day'); await p.waitForTimeout(600)
  await p.fill('.mday > .block .mfield >> nth=0', 'לסיים את המצגת')
  await p.fill('.mslots input >> nth=0', 'לשלוח את ההצעה')
  await p.click('.mslots .cbox >> nth=0'); await p.waitForTimeout(200)
  let st = await S(); const dk = Object.keys(st.mastery.days)[0]
  ok(st.mastery.days[dk].focus === 'לסיים את המצגת' && st.mastery.days[dk].done.action === true, 'day: focus and action saved and marked')
  await p.fill('.mcapture textarea', 'היום אני רוצה להתאמן ב-7 בערב, לקרוא, לתרגל דיבור ולחפש דירה. אולי לבשל משהו חדש')
  await p.click('.mcapture .btn--primary'); await p.waitForTimeout(500)
  ok((await p.locator('.mdraft li').count()) === 5, 'day: sentence split into five items for confirmation')
  ok((await S()).mastery.tasks === undefined, 'day: nothing saved before confirmation')
  await p.click('.sheet .btn--primary'); await p.waitForTimeout(500)
  st = await S()
  ok(st.mastery.tasks.length === 5 && st.mastery.tasks.filter((t) => t.kind === 'idea').length === 1 && st.mastery.tasks[0].time === '19:00', 'day: tasks saved with time, idea kept apart')
  ok((await p.locator('.mday section.block >> nth=1 >> .glist:not(.glist--quiet) > li').count()) === 3, 'day: only three tasks in today\'s list')
  ok(await p.locator('text=שלוש זה מה שבאמת נכנס ביום').isVisible(), 'day: the rest is offered for tomorrow')
  await p.locator('.mday section.block >> nth=1 >> .glist:not(.glist--quiet) .cbox').first().click(); await p.waitForTimeout(200)
  ok((await S()).mastery.tasks.some((t) => t.done), 'day: a task marked done')

  // sleep: targets, a logged night, stats from real logs only
  await p.goto(U + '/mastery/sleep'); await p.waitForTimeout(600)
  ok(await p.locator('text=אחרי כמה לילות מתועדים').isVisible(), 'sleep: no stats before any night is logged')
  await p.locator('.msleep .block >> nth=1').locator('input[type=time] >> nth=1').fill('07:20')
  await p.click('.msleep .block >> nth=1 >> .chip >> nth=3')
  await p.click('text=שמירת הלילה'); await p.waitForTimeout(400)
  st = await S(); const night = Object.values(st.mastery.sleep.logs)[0]
  ok(night.wake === '07:20' && night.quality === 4, 'sleep: night saved with real wake time and quality')
  ok(await p.locator('.msleep .mfacts').isVisible(), 'sleep: stats appear after a logged night')
  await p.locator('.msleep .glist >> nth=0 >> .glist__row >> nth=0').click(); await p.waitForTimeout(200)
  ok(Object.values((await S()).mastery.routines.done)[0].m.length === 1, 'sleep: routine step checked')

  // screen time: a limit, real usage typed from iOS, the pause flow
  await p.goto(U + '/mastery/screen'); await p.waitForTimeout(600)
  await p.selectOption('.mlimit select >> nth=0', '60'); await p.waitForTimeout(200)
  await p.fill('.mlimit__more input >> nth=0', '45'); await p.waitForTimeout(200)
  st = await S()
  ok(st.mastery.limits[0].app === 'instagram' && st.mastery.limits[0].daily === 60, 'screen: daily limit saved')
  ok(await p.locator('text=היום 45 דק׳, נשארו 15').isVisible(), 'screen: remaining time from real usage')
  await p.goto(U + '/pause/instagram'); await p.waitForTimeout(600)
  await p.click('.mwhy .chip >> nth=1'); await p.waitForTimeout(200)
  ok(await p.locator('.mpause__alt').isVisible(), 'pause: a relevant alternative appears')
  await p.click('text=סוגר, לא צריך'); await p.waitForTimeout(400)
  ok((await S()).mastery.pauses[0].choice === 'closed' && (await S()).mastery.pauses[0].why === 'bored', 'pause: choice and reason recorded')

  // urges: encrypted vault, protocol, lock, reopen
  await p.goto(U + '/mastery/urge'); await p.waitForTimeout(600)
  await p.click('.mwhy .chip >> nth=0')
  await p.fill('.ucode >> nth=0', '2468'); await p.fill('.ucode >> nth=1', '2468')
  await p.click('text=יצירת מקום פרטי'); await p.waitForTimeout(1500)
  ok(await p.locator('.urge__now').isVisible(), 'urge: private space created')
  await p.click('.urge__now'); await p.click('text=נשמתי')
  await p.locator('.urange').fill('8'); await p.click('text=הלאה')
  await p.click('.mwhy .chip >> nth=0'); await p.click('text=הלאה')
  await p.click('text=להתחיל'); await p.waitForTimeout(1200); await p.click('text=להמשיך הלאה')
  await p.click('.mwhy .chip >> nth=1'); await p.click('text=עשיתי')
  await p.locator('.urange').fill('3'); await p.click('text=הדחף עבר'); await p.waitForTimeout(1500)
  const raw = await p.evaluate(() => localStorage.getItem('hamasa:vault'))
  ok(raw && !raw.includes('עייף') && !raw.includes('שכיבות') && JSON.parse(raw).data.length > 40, 'urge: entry stored encrypted, no plaintext on the device')
  ok(!/intensity|עייף|שכיבות/.test(JSON.stringify(await S())), 'urge: nothing about urges in the regular app data')
  await p.click('text=נעילה'); await p.waitForTimeout(300)
  await p.fill('.ucode >> nth=0', '1111'); await p.click('text=פתיחה'); await p.waitForTimeout(1500)
  ok(await p.locator('text=הקוד לא נכון').isVisible(), 'urge: wrong code does not open')
  await p.fill('.ucode >> nth=0', '2468'); await p.click('text=פתיחה'); await p.waitForTimeout(1500)
  ok(await p.locator('.urge .mfacts strong >> nth=0').innerText() === '1', 'urge: reopened with the code, one entry this week')

  // discipline: a non-timed challenge
  await p.goto(U + '/mastery/discipline'); await p.waitForTimeout(600)
  await p.click('text=הצלחתי'); await p.waitForTimeout(300)
  ok((await S()).mastery.ladder.log.length === 1, 'discipline: challenge result recorded')

  // speech: consent, fake microphone recording, measured on the device
  await p.goto(U + '/mastery/speech'); await p.waitForTimeout(600)
  await p.click('text=מאשר, בוא נתחיל'); await p.waitForTimeout(300)
  await p.click('.srec__btn'); await p.waitForTimeout(4500); await p.click('.srec__btn'); await p.waitForTimeout(4000)
  st = await S()
  ok(st.speech?.length === 1 && st.speech[0].m.seconds > 3, 'speech: recording analysed and saved as numbers only')
  ok(await p.locator('.sres .mfacts').isVisible(), 'speech: results shown')

  ok(errs.length === 0, 'no page errors ' + errs.join(' | '))
  await b.close()
})()
