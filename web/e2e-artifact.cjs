// End-to-end run of the in-chat build (dist-artifact/app.html) inside a stand-in for the Claude
// viewer: the page is wrapped the way the Artifact tool wraps it, and window.claude serves db
// (kept here in Node, so a "second phone" can read it), user, sample (canned answers) and downloads.
// Run: npm run build:artifact && node e2e-artifact.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'replica', 'clone-screens');
const page0 = fs.readFileSync(path.join(__dirname, 'dist-artifact', 'app.html'), 'utf8');
const skeleton = `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page0}</body></html>`;

const store = new Map(); // path -> body
const calls = { sample: [], downloads: [] };
const writes = new Map();

const MEAL = { is_food: true, dish_name_he: 'עוף עם אורז', items: [
  { name_he: 'חזה עוף בגריל', grams: 150, kcal: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4, confidence: 'high' },
  { name_he: 'אורז לבן', grams: 180, kcal: 234, protein_g: 4.3, carbs_g: 51, fat_g: 0.5, confidence: 'medium' } ], notes_he: '' };
const LABEL = { barcode: '7290000000017', name_he: 'יוגורט חלבון', brand: 'מותג', per100: { kcal: 70, protein: 10, carbs: 6, fat: 0.5, fiber: null }, serving_grams: 200, found_table: true, notes_he: '' };

const COACH = {
  report: { headline: 'שבוע ראשון: בסיס טוב, אבל המכירות עוד לא התחילו.', wins: ['3 משימות ראשיות מתוך 3'], gaps: ['אפס פניות ללקוחות חדשים'], pattern: 'אתה מבצע את מה שנוח ודוחה את מה שחושף אותך.', priorities: ['5 פניות אישיות עד יום שלישי', 'רישום כל תספורת', 'שינה של 7 שעות ומעלה ב-5 לילות'], difficulty: 'same' },
  answer: { answer: 'לפי המספרים שלך, עוד לא. החיסכון מחזיק כשבעה חודשים בלי הכנסה.', actions: ['למלא את ההוצאות האמיתיות', 'להגיע ל-80 תספורות בחודש לפני שחותמים'] },
  personal: { domain: 'courage', title: 'שלוש פניות היום', objective: 'פונה לשלושה זרים ומציע תספורת.', why: 'אתה נמנע מחשיפה.', steps: ['רשימה', 'פנייה', 'מעקב'], kind: 'count', target: 3, difficulty: 2, prompt: 'מה ענו?' },
  turn: { reply: 'אוקיי, ומה זה אומר בפועל?', done: false },
  review: { score: 72, summary: 'שאלת טוב, אבל ויתרת על המחיר מהר מדי.', strengths: ['שאלת על החתונה'], fixes: ['להחזיק את המחיר ולשתוק'], betterLine: 'זה המחיר, ובשבילו אתה יוצא מוכן לחתונה.' },
};

const fakeClaude = () => {
  const call = (op, ...args) => window.__db(op, ...args);
  const query = (p, filters = [], order = null, n = 1000) => ({
    where: (f, op, v) => query(p, [...filters, [f, op, v]], order, n),
    orderBy: (f, dir = 'asc') => query(p, filters, [f, dir], n),
    limit: (k) => query(p, filters, order, k),
    get: async () => {
      const rows = await call('query', p, filters, order, n);
      return { docs: rows.map(([id, d]) => ({ id, exists: true, data: () => d, metadata: {} })), size: rows.length, empty: !rows.length, docChanges: () => [] };
    },
    onSnapshot(next) { this.get().then((s) => next({ ...s, docChanges: () => s.docs.map((doc) => ({ type: 'added', doc })) })); return () => {}; },
  });
  const db = {
    collection: (p) => Object.assign(query(p), {
      doc: (id) => ({
        get: async () => { const d = await call('get', `${p}/${id}`); return { id, exists: !!d, data: () => d ?? undefined }; },
        set: (d) => call('set', `${p}/${id}`, d),
        delete: () => call('delete', `${p}/${id}`),
      }),
    }),
  };
  const blobsOk = (opts) => Array.isArray(opts?.images) && opts.images.every((b) => b instanceof Blob && b.size > 100);
  const sample = Object.assign(async () => ({ text: '' }), {
    json: async (prompt, opts) => {
      const coach = [['"headline"', 'report'], ['"betterLine"', 'review'], ['"reply"', 'turn'], ['"actions"', 'answer'], ['"domain"', 'personal']].find(([k]) => prompt.includes(k));
      if (coach) { await window.__note('sample', { kind: coach[1] }); await new Promise((r) => setTimeout(r, 200)); return window.__COACH[coach[1]]; }
      const kind = prompt.includes('nutrition table') ? 'label' : 'meal';
      await window.__note('sample', { kind, images: blobsOk(opts), tier: opts?.modelTier });
      await new Promise((r) => setTimeout(r, 300));
      return kind === 'label' ? window.__LABEL : window.__MEAL;
    },
    limits: async () => ({ maxPromptBytes: 262144, images: { maxCount: 5, maxInputBytes: 20e6, mediaTypes: ['image/jpeg'] } }),
  });
  const caps = {
    db, sample,
    user: { id: async () => 'u_test', isOwner: () => true },
    downloads: { save: async ({ filename, data }) => window.__note('downloads', { filename, size: (data.size ?? data.length) }) },
  };
  window.claude = { use: async (name) => (name in caps ? caps[name] : null) };
  // A phone with a Hebrew voice: each paragraph "speaks" for 150 ms, and what was said is kept.
  window.__spoken = [];
  const voice = { name: 'Carmit (Enhanced)', lang: 'he-IL', localService: true, default: false, voiceURI: 'carmit' };
  let timer = null;
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => [voice], onvoiceschanged: null,
    speak: (u) => { window.__spoken.push(u.text); timer = setTimeout(() => u.onend && u.onend(), 150); },
    cancel: () => clearTimeout(timer), pause() {}, resume() {},
  } });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
};

async function phone(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL', hasTouch: true, isMobile: true });
  await ctx.exposeFunction('__db', async (op, p, ...a) => {
    if (op === 'get') return store.get(p) ?? null;
    if (op === 'set') { writes.set(p, (writes.get(p) ?? 0) + 1); if (JSON.stringify(a[0]).length > 262144) throw { code: 'invalid_argument', message: 'too big' }; store.set(p, a[0]); return; }
    if (op === 'delete') { store.delete(p); return; }
    if (op === 'query') {
      const [filters, order, n] = a;
      let rows = [...store].filter(([k]) => k.startsWith(p + '/') && k.split('/').length === p.split('/').length + 1)
        .map(([k, d]) => [k.split('/').pop(), d])
        .filter(([, d]) => filters.every(([f, op, v]) => (op === '>' ? String(d[f]) > String(v) : d[f] === v)));
      if (order) rows.sort(([, x], [, y]) => (x[order[0]] > y[order[0]] ? 1 : x[order[0]] < y[order[0]] ? -1 : 0) * (order[1] === 'desc' ? -1 : 1));
      return rows.slice(0, n);
    }
  });
  await ctx.exposeFunction('__note', (k, v) => void calls[k].push(v));
  await ctx.addInitScript(`window.__MEAL=${JSON.stringify(MEAL)};window.__LABEL=${JSON.stringify(LABEL)};window.__COACH=${JSON.stringify(COACH)};(${fakeClaude})();`);
  await ctx.route('https://artifact.test/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: skeleton }));
  const page = await ctx.newPage();
  const errors = allErrors;
  page.on('crash', () => allErrors.push(name + ': CRASH at ' + new Date().toISOString()));
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  await page.goto('https://artifact.test/');
  return { ctx, page, errors };
}

const log = async (s) => { let m = ''; try { m = ' [heap ' + Math.round((await cur.evaluate(() => performance.memory.usedJSHeapSize)) / 1e6) + ' MB, dom ' + (await cur.evaluate(() => document.getElementsByTagName('*').length)) + ']'; } catch {} console.log('✓ ' + s + m); };
const jpeg = async (browser, hue) => { const p = await browser.newPage(); await p.setViewportSize({ width: 800, height: 600 }); await p.setContent(`<body style="margin:0;background:hsl(${hue} 50% 60%)"><div style="margin:100px auto;width:400px;height:400px;border-radius:50%;background:hsl(${hue} 40% 35%)"></div></body>`); const b = await p.screenshot({ type: 'jpeg' }); await p.close(); return { name: 'p.jpg', mimeType: 'image/jpeg', buffer: b }; };
let cur = null;
const allErrors = [];
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const a = await phone(browser, 'phone A');
  const { page } = a; cur = page;

  // The journey first, then the training set-up, the same answers as the web run
  const keypad = async (digits) => { for (const d of digits) await page.locator('[role=group][aria-label^="מקלדת"]').getByRole('button', { name: d, exact: true }).click(); };
  await page.getByText('בונים את עצמך').waitFor({ timeout: 20000 });
  await page.getByLabel('איך לקרוא לך').fill('דוד');
  for (const d of ['מכירות', 'אומץ', 'עסק']) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByLabel('מי אתה, במילים שלך').fill('בן 21, משתחרר בעוד חודש, ספר. רוצה לבנות עסק ולהיות ממושמע.');
  await shot(page, 'J01-start'); log('first visit starts the journey');
  await page.getByRole('button', { name: 'להתחיל את יום 1' }).click();
  await page.getByText('מה המטרה העיקרית?').waitFor({ timeout: 20000 });
  await shot(page, 'A01-welcome'); log('then the training set-up');
  await page.getByRole('radio', { name: /בניית שריר/ }).click(); await page.getByRole('button', { name: 'המשך' }).click();
  await page.getByRole('radio', { name: /בינוני/ }).click(); await page.getByRole('button', { name: 'המשך' }).click();
  await page.getByRole('radio', { name: '3', exact: true }).click(); await page.getByRole('button', { name: 'המשך' }).click();
  await page.getByRole('radio', { name: /חדר כושר/ }).click(); await page.getByRole('button', { name: 'המשך' }).click();
  await page.getByLabel('משקל').fill('80'); await page.getByRole('button', { name: 'לתוכנית' }).click();
  await page.getByText('התוכנית שלך').first().waitFor();
  await page.getByRole('button', { name: 'מתחילים' }).click();
  await page.getByText('המשימה של היום').first().waitFor(); await page.waitForTimeout(900); await shot(page, 'A01-home'); log('onboarding: journey, plan + targets');

  // A mission done for real: find one that is not a timer, do it, say what happened
  const tab = (pg, name) => pg.locator('nav[aria-label="ניווט ראשי"]').getByRole('link', { name, exact: true }).click();
  const back = (pg) => pg.locator('main header').getByRole('link').first().click();
  let done = false;
  for (let i = 0; i < 3 && !done; i++) {
    if (i === 0) await page.getByRole('button', { name: 'לקבל את המשימה' }).click();
    else await page.locator('section[aria-label="משימות צד"] a').nth(i - 1).click();
    await page.getByRole('heading', { level: 1 }).first().waitFor();
    if (await page.locator('section[aria-label="טיימר"]').count()) { if (i === 0) await shot(page, 'J03-mission-timer'); await back(page); continue; }
    for (let k = 0; k < 12 && (await page.getByRole('button', { name: /^(עוד אחד|\+1,000)$/ }).count()); k++) {
      const plus = page.getByRole('button', { name: /^(עוד אחד|\+1,000)$/ });
      await plus.click(); await page.waitForTimeout(60);
      if (await page.locator('section[aria-label="ספירה"]').getByText(/^(\d[\d,]*)$/).count() === 0) break;
      const btn = await page.getByRole('button', { name: /ביצעתי|כתוב מה קרה/ }).count(); if (btn) break;
    }
    await shot(page, 'J02-mission');
    await page.locator('section[aria-label="סיום"] textarea').first().fill('עשיתי את זה בבוקר, היה קשה בהתחלה.');
    const go = page.getByRole('button', { name: 'ביצעתי' });
    if (!(await go.isEnabled())) { await back(page); continue; }
    await go.click();
    await page.getByText('המשימה בוצעה').or(page.getByText('מבחן הדרגה עבר')).first().waitFor();
    await page.waitForTimeout(1100); await shot(page, 'J04-sealed');
    await page.waitForFunction(() => location.hash === '#home', null, { timeout: 8000 });
    done = true;
  }
  if (!done) throw new Error('no mission could be completed');
  log('mission completed with a reflection and the seal');

  // Check-in
  await page.getByRole('link', { name: /צ'ק-אין/ }).first().click();
  await page.getByRole('button', { name: 'שעות שינה בלילה: יותר' }).click();
  await page.getByRole('switch', { name: 'התאמנתי היום' }).click();
  await page.getByRole('radiogroup', { name: 'אנרגיה' }).getByRole('radio', { name: '4 מתוך 5' }).click();
  await page.getByLabel('הניצחון של היום').fill('קמתי בלי נודניק');
  await shot(page, 'J05-checkin');
  await page.getByRole('button', { name: 'שמירה' }).click();
  await page.getByText('הצ\'ק-אין של היום').waitFor(); await page.waitForTimeout(700); await shot(page, 'J06-home-after'); log('check-in saved');

  // The chair: money first, then two cuts
  await tab(page, 'עסק'); await page.getByText('המספרים של החיים').first().click();
  await page.getByLabel('חסכונות').fill('50000'); await page.getByRole('textbox', { name: 'שכירות' }).fill('4000');
  await page.getByLabel(/^חשבונות/).fill('800'); await page.getByRole('textbox', { name: 'אוכל' }).fill('1800'); await page.getByLabel(/^אחר/).fill('600');
  await page.getByLabel('יעד הכנסה חודשי').fill('12000');
  await page.getByRole('button', { name: 'שמירה' }).click(); await page.waitForFunction(() => location.hash === '#business');
  for (const [name, price] of [['רון', '80'], ['רון', '90']]) {
    await page.getByRole('button', { name: 'רישום תספורת' }).click();
    await page.getByRole('textbox', { name: 'לקוח' }).fill(name); await page.getByRole('textbox', { name: 'מחיר' }).fill(price); await page.waitForTimeout(500);
    await page.getByRole('switch', { name: 'קבע את התור הבא לפני שיצא' }).click();
    if (price === '90') await shot(page, 'J08-log-cut');
    await page.getByRole('button', { name: 'רישום', exact: true }).click(); await page.waitForFunction(() => location.hash === '#business');
  }
  await page.getByText('170 ₪').first().waitFor(); await page.getByText('2 ביקורים').waitFor();
  await page.waitForTimeout(600); await shot(page, 'J07-business'); log('business: savings, runway and two cuts (second one known as returning)');

  // The coach: a question, a personal mission, a sales round with a score, the weekly report
  await tab(page, 'מאמן');
  await page.getByRole('button', { name: 'האם אני מוכן לגור לבד לפי המספרים?' }).click();
  await page.getByRole('button', { name: 'לשאול' }).click();
  await page.getByText('החיסכון מחזיק כשבעה חודשים').waitFor(); await shot(page, 'J09-coach'); log('coach answered with the profile and numbers');
  await page.getByRole('button', { name: 'לכתוב לי משימה להיום' }).click();
  await page.getByRole('heading', { name: 'שלוש פניות היום' }).waitFor(); await shot(page, 'J03-mission-count'); log('coach wrote a mission for today');
  await back(page); await tab(page, 'מאמן'); await page.getByRole('link', { name: /זירת מכירות/ }).click();
  await shot(page, 'J10-sales-list');
  await page.getByRole('link', { name: /לקוח שמתמקח על המחיר/ }).click();
  for (const line of ['זה המחיר, אבל תגיד לי מה חשוב לך בתספורת?', 'אז בוא ננסה פעם אחת, ואם לא תהיה מרוצה, לא תחזור.']) {
    await page.getByLabel('התשובה שלך').fill(line); await page.getByRole('button', { name: 'שליחה' }).click();
    await page.getByText('אוקיי, ומה זה אומר בפועל?').first().waitFor(); await page.waitForTimeout(250);
  }
  await page.getByRole('button', { name: 'לסיים ולקבל ציון' }).click();
  await page.getByText('ויתרת על המחיר מהר מדי').waitFor(); await page.waitForTimeout(500); await shot(page, 'J11-sales-review'); log('sales practice scored');
  await page.getByRole('link', { name: 'זירת מכירות' }).first().click(); await page.getByRole('link', { name: 'המאמן' }).first().click();
  await page.getByRole('link', { name: /הדוח השבועי/ }).click();
  await page.getByRole('button', { name: 'לכתוב את הדוח' }).click();
  await page.getByText('המכירות עוד לא התחילו').waitFor(); await page.waitForTimeout(600); await shot(page, 'J12-review'); log('weekly report written');
  await tab(page, 'המסע'); await page.getByText('המפה').waitFor(); await page.waitForTimeout(700); await shot(page, 'J13-journey'); log('journey map and marks');

  // The academy: a lesson read and heard, marked as learned
  await page.getByRole('link', { name: /האקדמיה/ }).first().click();
  await page.getByText('0 מתוך 27 שיעורים').waitFor(); await page.waitForTimeout(600); await shot(page, 'J14-academy');
  await page.getByRole('link', { name: /משמעת היא מערכת/ }).first().click();
  await page.getByRole('heading', { name: 'משמעת היא מערכת, לא תכונה' }).waitFor();
  await page.locator('section[aria-label="האזנה לשיעור"]').getByText(/Carmit/).waitFor();
  await page.getByRole('button', { name: 'האזנה לשיעור' }).click();
  await page.waitForTimeout(500); await shot(page, 'J15-lesson');
  await page.waitForFunction(() => window.__spoken.length >= 3);
  await page.getByRole('button', { name: 'עצירה' }).click();
  const spoken = await page.evaluate(() => window.__spoken);
  if (!spoken[0].includes('משמעת היא מערכת') || !spoken[1].includes('רוב האנשים')) throw new Error('lesson was not read in order: ' + spoken.slice(0, 2));
  log(`lesson read aloud paragraph by paragraph (${spoken.length} so far)`);
  await page.getByRole('button', { name: 'סיימתי את השיעור' }).click();
  await page.getByText('השיעור הזה מאחוריך').waitFor();
  await page.locator('main header').getByRole('link').first().click();
  await page.getByText('1 מתוך 27 שיעורים').waitFor(); log('academy lesson read and marked');
  await page.locator('main header').getByRole('link').first().click();

  // A workout from the plan
  await tab(page, 'גוף'); await page.locator('main').getByRole('button', { name: 'התחלה' }).first().click();
  await page.getByText('סקוואט עם מוט').first().waitFor();
  await page.getByRole('button', { name: /^משקל, סט 1:/ }).first().click();
  await keypad('60'); await page.getByRole('button', { name: 'הבא', exact: true }).click(); await keypad('8');
  await page.locator('[role=group][aria-label^="מקלדת"]').getByRole('button', { name: 'סגירה' }).click();
  await page.getByRole('checkbox', { name: 'סימון סט 1 כהושלם' }).first().click();
  await page.getByRole('timer').first().waitFor();
  await shot(page, 'A02-logger');
  await page.locator('header').getByRole('button', { name: 'סיום' }).click();
  await page.getByRole('button', { name: 'סיום ושמירה' }).click();
  await page.getByText('אימון מספר').first().waitFor();
  await shot(page, 'A02-summary'); log('workout logged and finished');
  await page.getByRole('button', { name: 'סיום', exact: true }).click();
  await page.getByText('המשימה של היום').first().waitFor();

  // Meal from a photo (Claude answers through sample)
  await page.getByRole('link', { name: 'תזונה' }).first().click();
  await page.getByRole('link', { name: /צילום/ }).first().click();
  await page.locator('input[type=file][capture=environment]').setInputFiles(await jpeg(browser, 30));
  await page.getByText('חזה עוף בגריל').first().waitFor();
  if (!calls.sample.find((c) => c.kind === 'meal' && c.images)) throw new Error('meal photo did not reach Claude as an image');
  await shot(page, 'A03-photo-meal');
  await page.getByRole('button', { name: /^הוספה ל/ }).click();
  await page.waitForFunction(() => location.hash === '#nutrition');
  await page.getByText('חזה עוף בגריל').first().waitFor(); log('photo meal recognised by Claude and saved');

  // A product from a label photo
  await page.getByRole('link', { name: /ברקוד/ }).first().click();
  await page.locator('input[type=file][multiple]').setInputFiles(await jpeg(browser, 200));
  await page.getByRole('dialog').getByText('יוגורט חלבון').first().waitFor();
  await shot(page, 'A04-label');
  await page.getByRole('dialog').getByRole('button', { name: /^הוספה ל/ }).click();
  await page.getByText('יוגורט חלבון').first().waitFor(); log('product read from its label');
  // Next time the barcode alone finds it
  await page.getByRole('link', { name: /ברקוד/ }).first().click();
  await page.getByLabel('מספר הברקוד').fill(LABEL.barcode);
  await page.getByRole('button', { name: 'חיפוש' }).click();
  await page.getByRole('dialog').getByText('יוגורט חלבון').first().waitFor(); log('saved product found by its barcode');
  await page.keyboard.press('Escape');
  if (process.env.PROBE) { const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable'); for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 3000)); const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value])); console.log('probe', i, Math.round(m.JSHeapUsedSize / 1e6), 'MB heap', m.Nodes, 'nodes', Math.round(m.TaskDuration*10)/10, 's task', m.LayoutCount, 'layouts', m.RecalcStyleCount, 'styles'); } }

  // Progress photo
  // In-app navigation only, the way the viewer moves around.
  const sub = (pg, name) => pg.locator('nav[aria-label="גוף"]').getByRole('link', { name, exact: true }).click();
  await page.locator('header').getByRole('link', { name: 'תזונה' }).click();
  await sub(page, 'התקדמות'); await page.getByRole('link', { name: 'תמונות', exact: true }).click();
  await page.locator('input[type=file]').first().setInputFiles(await jpeg(browser, 120));
  await page.locator('ul[aria-label="תמונות"] img').first().waitFor();
  await new Promise((r) => setTimeout(r, 2500));
  const pp = [...store.keys()].find((k) => k.includes('/pp.'));
  if (!pp) { console.log([...store.keys()].map((k) => k.split('/').pop()), await page.evaluate(() => localStorage.getItem('sync-dirty'))); throw new Error('progress photo did not reach the cloud copy'); }
  log(`progress photo kept (${Math.round(JSON.stringify(store.get(pp)).length / 1024)} KB in its document)`);

  // Profile: synced, backup offered through downloads
  await tab(page, 'היום'); await page.getByRole('link', { name: 'פרופיל והגדרות' }).click();
  await page.getByText('הנתונים שמורים בחשבון Claude שלך').waitFor({ timeout: 15000 });
  await shot(page, 'A05-profile-synced');
  await page.getByRole('button', { name: 'שמירת גיבוי לקובץ' }).click();
  await page.waitForTimeout(500);
  if (!calls.downloads.length || calls.downloads[0].size < 1000) throw new Error('backup was not offered');
  log('backup offered as a file');

  // The cloud copy is grouped and private
  const keys = [...store.keys()];
  if (!keys.every((k) => k.startsWith('data/users/u_test/'))) throw new Error('data outside the private path');
  const big = keys.filter((k) => JSON.stringify(store.get(k)).length > 250000);
  if (big.length) throw new Error('oversized docs ' + big);
  log(`cloud copy: ${keys.length} documents under data/users/<id>/`);

  // A second phone: empty browser, same account -> everything is there
  const b = await phone(browser, 'phone B'); cur = b.page;
  await b.page.getByText('המשימה של היום').first().waitFor({ timeout: 20000 });
  await b.page.getByText('הצ\'ק-אין של היום').waitFor();
  await tab(b.page, 'עסק'); await b.page.getByText('170 ₪').first().waitFor();
  await tab(b.page, 'גוף'); await sub(b.page, 'תזונה');
  await b.page.getByText('חזה עוף בגריל').first().waitFor();
  await b.page.getByText('יוגורט חלבון').first().waitFor();
  await sub(b.page, 'אימונים'); await b.page.getByRole('link', { name: /היסטוריית אימונים/ }).first().click();
  await b.page.getByText('גוף מלא A').first().waitFor();
  await shot(b.page, 'A06-second-phone'); log('second phone opens with all the data');

  // Back gesture
  await tab(b.page, 'היום'); await b.page.waitForFunction(() => location.hash === '#home'); await tab(b.page, 'מאמן');
  await b.page.waitForFunction(() => location.hash === '#coach'); await b.page.goBack();
  await b.page.waitForFunction(() => location.hash === '#home'); log('back gesture returns to the previous screen');

  const errors = [...a.errors, ...b.errors].filter((e) => !/favicon/.test(e));
  console.log('\nerrors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) process.exit(1);
})().catch(async (e) => { await cur?.screenshot({ path: '/tmp/fail.png' }).catch(() => {}); console.error('page errors:', allErrors.slice(0, 5)); console.error('FAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
