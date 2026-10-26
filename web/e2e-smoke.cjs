// End-to-end smoke run of every flow (390 px, light + dark, 1440 px). Needs a running app:
//   npm run build && npx next start -p 3100   then   node e2e-smoke.cjs
// The photo API and Open Food Facts are mocked, so no key or network is needed.
const { chromium } = require('playwright');
const out = process.env.SHOTS_DIR || require('path').resolve(__dirname, '../replica/clone-screens');
const BASE = process.env.BASE_URL || 'http://localhost:3100';
const log = (...a) => console.log('✓', ...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL', hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror ${page.url()}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console ${page.url()}: ${m.text()}`); });
  const overflow = async (name) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o > 0) errors.push(`overflow ${name}: ${o}px`); };
  const shot = async (name, full = false) => { await page.waitForTimeout(350); await overflow(name); await page.screenshot({ path: `${out}/${name}.png`, fullPage: full }); };
  const keypad = async (digits) => { for (const k of digits) await page.locator('[role=group][aria-label^="מקלדת"] button', { hasText: new RegExp(`^${k === '.' ? '\\.' : k}$`) }).first().click(); };

  // Home, empty
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await shot('S04-home-empty'); log('home');

  // Workout 1 from template A: log the squat sets with the keypad
  await page.goto(BASE + '/workouts'); await page.getByRole('button', { name: 'התחלה' }).first().click();
  await page.waitForURL('**/workout'); await page.getByText('סקוואט עם מוט').first().waitFor();
  for (const n of [1, 2, 3]) {
    await page.getByRole('button', { name: new RegExp(`^משקל, סט ${n}:`) }).first().click();
    await keypad('100'); await page.getByRole('button', { name: 'הבא', exact: true }).click(); await keypad('5');
    await page.locator('[role=group][aria-label^="מקלדת"]').getByRole('button', { name: 'סגירה' }).click();
    await page.getByRole('checkbox', { name: `סימון סט ${n} כהושלם` }).first().click();
  }
  await page.getByRole('timer').first().waitFor();
  await shot('S06-logger'); log('logger with rest timer');
  await page.locator('header').getByRole('button', { name: 'סיום' }).click();
  await page.getByRole('button', { name: 'סיום ושמירה' }).click();
  await page.waitForURL('**/summary**'); await page.getByText('כל הכבוד').first().waitFor();
  await shot('S12-summary'); log('summary');

  // Workout 2: one-tap set from last time, then a heavier set = record
  await page.goto(BASE + '/workouts'); await page.getByRole('button', { name: 'התחלה' }).first().click();
  await page.waitForURL('**/workout');
  const prevCell = page.getByRole('button', { name: /^משקל, סט 1: ריק, בפעם הקודמת 100/ }).first();
  await prevCell.waitFor(); log('previous performance shown as placeholder');
  await page.getByRole('checkbox', { name: 'סימון סט 1 כהושלם' }).first().click();
  await page.getByRole('button', { name: /^משקל, סט 2:/ }).first().click(); await keypad('105');
  await page.locator('[role=group][aria-label^="מקלדת"]').getByRole('button', { name: 'סגירה' }).click();
  await page.getByRole('checkbox', { name: 'סימון סט 2 כהושלם' }).first().click();
  await page.getByText(/שיא אישי חדש/).first().waitFor(); log('PR toast');
  await shot('S06-logger-pr');
  await page.locator('header').getByRole('button', { name: 'סיום' }).click();
  await page.getByRole('button', { name: 'סיום ושמירה' }).click();
  await page.waitForURL('**/summary**'); await page.getByText('שיא אישי חדש').first().waitFor();
  await shot('S12-summary-record'); log('summary with record');

  await page.goto(BASE + '/history'); await shot('S20-history'); log('history');
  await page.locator('a[href^="/history/view"]').first().click(); await page.getByText('מחיקת האימון').first().waitFor();
  await shot('S21-workout-detail', true);
  await page.getByRole('link', { name: 'סקוואט עם מוט' }).click(); await page.getByText('1RM משוער לאורך זמן').first().waitFor();
  await shot('S10-exercise'); log('exercise detail');
  await page.goto(BASE + '/exercises'); await page.getByLabel('חיפוש תרגיל').fill('בנץ'); await page.getByText('לחיצת חזה במוט').first().waitFor();
  await shot('S09-exercises'); log('exercise search by alias');

  // Nutrition goals
  await page.goto(BASE + '/nutrition/goals'); await page.getByText('יעד יומי').first().waitFor();
  await page.getByLabel('משקל').fill('82'); await page.getByRole('radio', { name: /ירידה בשומן/ }).click();
  await shot('S26-goals', true);
  await page.getByRole('button', { name: 'שמירת היעדים' }).click(); await page.waitForURL('**/nutrition'); log('goals saved');

  // Search + amount sheet
  await page.goto(BASE + '/nutrition/add?meal=breakfast'); await page.getByLabel('חיפוש מזון').fill('קוטג');
  await page.getByRole('button', { name: /קוטג' 5%/ }).first().click();
  await page.getByRole('dialog').waitFor(); await shot('S27-amount-sheet');
  await page.getByRole('button', { name: 'הוספה לארוחת בוקר' }).click(); await page.getByText(/נוסף לארוחת בוקר/).first().waitFor(); log('food from search');
  await page.getByLabel('חיפוש מזון').fill('פיתה'); await page.getByRole('button', { name: /^פיתה/ }).first().click();
  await page.getByRole('button', { name: 'הוספה לארוחת בוקר' }).click(); await page.waitForTimeout(300);

  // Quick add
  await page.goto(BASE + '/nutrition/add?meal=snack&tab=quick'); await page.getByLabel('מה זה?').fill('חטיף חלבון'); await page.getByLabel('קלוריות').fill('200'); await page.getByLabel('חלבון').fill('20');
  await page.getByRole('button', { name: 'הוספה לנשנושים' }).click(); await page.waitForURL('**/nutrition**'); log('quick add');

  // Photo flow with a mocked recognition response
  await page.route('**/api/food-photo', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: {
    is_food: true, dish_name_he: 'חזה עוף עם אורז וסלט', notes_he: 'השמן בסלט לא ברור מהתמונה. אם היה רוטב, כדאי להוסיף.',
    items: [
      { name_he: 'חזה עוף בגריל', grams: 160, kcal: 264, protein_g: 49.6, carbs_g: 0, fat_g: 5.8, confidence: 'high' },
      { name_he: 'אורז לבן', grams: 180, kcal: 234, protein_g: 4.9, carbs_g: 50.4, fat_g: 0.5, confidence: 'medium' },
      { name_he: 'סלט ירקות', grams: 150, kcal: 45, protein_g: 1.4, carbs_g: 6, fat_g: 2, confidence: 'low' } ] } }) }));
  const meal = await browser.newPage(); await meal.setViewportSize({ width: 800, height: 600 });
  await meal.setContent('<body style="margin:0;background:#f4efe6;display:grid;place-items:center;height:100vh"><div style="width:520px;height:520px;border-radius:50%;background:radial-gradient(circle at 35% 40%,#e9d7b0 0 18%,transparent 19%),radial-gradient(circle at 65% 40%,#f6f2e8 0 20%,transparent 21%),radial-gradient(circle at 50% 70%,#7fb35a 0 16%,transparent 17%),#fff;box-shadow:0 10px 40px #0002"></div></body>');
  const jpg = await meal.screenshot({ type: 'jpeg', quality: 85 }); await meal.close();
  await page.goto(BASE + '/nutrition/photo?meal=lunch');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'meal.jpg', mimeType: 'image/jpeg', buffer: jpg });
  await page.getByText('חזה עוף עם אורז וסלט').first().waitFor();
  await page.getByRole('group', { name: 'כמות אורז לבן בגרם' }).getByRole('button', { name: /פחות/ }).click();
  await shot('S28-photo-review', true); log('photo review (mocked AI)');
  await page.getByRole('button', { name: /הוספה לארוחת צהריים/ }).click(); await page.waitForURL('**/nutrition**');
  await page.getByText('חזה עוף בגריל').first().waitFor(); log('photo items saved with thumbnail');

  // Barcode with mocked Open Food Facts
  await page.route('https://world.openfoodfacts.org/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 1, product: {
    product_name_he: 'יוגורט חלבון וניל', brands: 'מותג לדוגמה', serving_quantity: 200, nutriments: { 'energy-kcal_100g': 70, proteins_100g: 10, carbohydrates_100g: 6, fat_100g: 0.5 } } }) }));
  await page.goto(BASE + '/nutrition/barcode?meal=snack'); await page.getByLabel('מספר הברקוד').fill('7290000000001');
  await page.getByRole('button', { name: 'חיפוש' }).click(); await page.getByRole('dialog').getByText('יוגורט חלבון וניל').first().waitFor();
  await shot('S29-barcode-found');
  await page.getByRole('button', { name: 'הוספה לנשנושים' }).click(); await page.waitForURL('**/nutrition**'); log('barcode product logged');

  await page.goto(BASE + '/nutrition'); await page.getByText('חזה עוף בגריל').first().waitFor();
  await shot('S27-nutrition-today'); await shot('S27-nutrition-today-full', true); log('nutrition today');
  await page.getByRole('button', { name: /סלט ירקות/ }).click(); await page.getByRole('dialog').waitFor();
  await shot('S27-entry-edit'); await page.keyboard.press('Escape');

  await page.goto(BASE + '/'); await page.getByText('האימון האחרון').first().waitFor(); await shot('S04-home'); await shot('S04-home-full', true); log('home dashboard');
  await page.goto(BASE + '/progress'); await page.getByText('אימונים בשבוע').first().waitFor(); await shot('S18-progress', true); log('progress');
  await page.goto(BASE + '/profile'); await shot('S30-profile', true);
  await page.getByRole('radio', { name: 'כהה' }).click(); await page.waitForTimeout(600); await page.goto(BASE + '/nutrition'); await page.getByText('חזה עוף בגריל').first().waitFor();
  await shot('S27-nutrition-dark'); await page.goto(BASE + '/'); await shot('S04-home-dark'); log('dark theme');
  await page.goto(BASE + '/profile'); await page.getByRole('radio', { name: 'בהיר' }).click(); await page.waitForTimeout(600);

  // Desktop width
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(BASE + '/'); await page.waitForTimeout(500);
  await overflow('desktop home'); await page.screenshot({ path: `${out}/S04-home-1440.png` }); log('1440 width');

  // Reload keeps the open workout (local-first)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/workouts'); await page.getByRole('button', { name: 'אימון חופשי, בלי תבנית' }).click(); await page.waitForURL('**/workout');
  await page.reload(); await page.getByText('אימון חופשי').first().waitFor(); log('open workout survives reload');

  console.log('\nerrors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
