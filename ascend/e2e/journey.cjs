// Browser walkthrough of the main journey at iPhone width.
// Needs: a running server (npm run build && npm run preview), and the `playwright` package resolvable from here.
// Set ASCEND_BASE to change the URL. Set CHROMIUM_PATH if Chromium is not in the default location.
const { chromium } = require("playwright");
require("node:fs").mkdirSync("e2e-out", { recursive: true });
const BASE = process.env.ASCEND_BASE || "http://localhost:4173/";
const errors = [];
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { if (!cond) { errors.push(msg); console.log("✗", msg); } else console.log("✓", msg); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "he-IL" });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  await page.goto(BASE);
  await page.waitForSelector("text=מערכת אישית לשיפור עצמי");
  check(true, "onboarding shows on first load");
  const dir = await page.getAttribute("html", "dir");
  check(dir === "rtl", "html dir is rtl");

  // Step 0
  await page.fill("input.input", "");
  await page.click("text=המשך");
  check(await page.isVisible("text=נא להזין שם"), "name validation shows error");
  await page.fill("input.input", "דנה");
  await page.click("text=המשך");
  // Step 1 goals
  await page.click("text=המשך");
  check(await page.isVisible("text=בחר לפחות מטרה אחת"), "goal validation shows error");
  await page.click("button.chip:has-text('מכירות')");
  await page.click("button.chip:has-text('שינה')");
  await page.click("text=המשך");
  // Step 2
  await page.click("button.chip:has-text('10 דק׳')");
  await page.click("text=בואו נתחיל");
  await page.waitForSelector("text=תוכנית היום");
  check(true, "onboarding saves profile and reaches home");
  check(await page.isVisible("text=דנה"), "home greets the user by name");

  // Plan toggle + persistence
  const firstTask = page.locator("button.task").first();
  await firstTask.click();
  check((await firstTask.getAttribute("aria-pressed")) === "true", "task can be marked complete");
  await page.reload();
  await page.waitForSelector("text=תוכנית היום");
  check((await page.locator("button.task").first().getAttribute("aria-pressed")) === "true", "task completion persists after reload");

  await page.screenshot({ path: "./e2e-out/01-home.png", fullPage: true });

  // Tabs
  const tabs = ["אימון", "מאמן", "מעקב", "פרופיל", "בית"];
  for (const t of tabs) {
    await page.click(`nav.tabbar >> text=${t}`);
    await page.waitForTimeout(150);
  }
  check(true, "all five tabs are clickable without errors");
  await page.click("nav.tabbar >> text=אימון");
  await page.waitForSelector("text=ללמוד, לתרגל, לבדוק");
  await page.screenshot({ path: "./e2e-out/02-training.png", fullPage: true });

  // Lesson
  await page.goto(BASE + "#/train/track/B");
  await page.click("text=שינה: שעת ההשכמה");
  await page.waitForSelector("text=בדיקה קצרה");
  check(true, "lesson opens and shows quiz");
  const quizBtnsBefore = await page.locator("button.toggle").count();
  const q1 = page.locator("fieldset").first().locator("button.toggle");
  await q1.nth(1).click();
  check(await page.isVisible("text=לא בדיוק"), "wrong answer shows explanation");
  const doneBtn = page.locator("button.btn.block").last();
  check(await doneBtn.isDisabled(), "finish button stays disabled until all quiz items answered");
  await page.locator("fieldset").nth(1).locator("button.toggle").nth(0).click();
  await page.locator("fieldset").nth(1).locator("button.toggle").nth(1).click();
  await page.locator("fieldset").first().locator("button.toggle").nth(1).click();
  await page.locator("button.btn.block").last().click();
  check(await page.isVisible("text=ביטול סימון כהושלם"), "lesson can be completed after answering");
  check(quizBtnsBefore > 0, "lesson has interactive quiz controls");
  await page.screenshot({ path: "./e2e-out/03-lesson.png", fullPage: true });

  // Sales simulator
  await page.goto(BASE + "#/train/sales");
  await page.waitForSelector("text=סימולטור מכירות");
  await page.click("text=התחל (בינוני)");
  await page.waitForSelector("text=הלקוח");
  for (let i = 0; i < 6; i++) {
    const done = await page.isVisible("text=משוב על הסבב").catch(() => false);
    if (done) break;
    await page.fill("textarea.textarea", "מה המצב היום ומה כבר ניסית? אם הבנתי נכון הבעיה היא יציבות בהכנסה, ואני רוצה להבין את התקציב והזמן שלך. מה נוח לך לשבוע הבא?");
    await page.click("button.btn.primary:has-text('שליחה')");
    await page.waitForTimeout(120);
  }
  check(await page.isVisible("text=משוב על הסבב"), "sales simulation finishes and shows a report");
  await page.screenshot({ path: "./e2e-out/04-sales-report.png", fullPage: true });

  // Relationship
  await page.goto(BASE + "#/train/relations/ambiguous-replies");
  await page.waitForSelector("text=בחר תגובה אחת");
  await page.click("text=שמתי לב שהתשובות");
  check(await page.isVisible("text=תגובה חזקה"), "relationship simulator gives feedback");

  // Offer builder
  await page.goto(BASE + "#/train/offer");
  await page.waitForSelector("text=בונה ההצעות");
  await page.locator("textarea.textarea").nth(0).fill("ליווי אישי");
  await page.locator("textarea.textarea").nth(1).fill("צלמים עצמאיים");
  await page.locator("textarea.textarea").nth(2).fill("אין לקוחות קבועים");
  await page.locator("textarea.textarea").nth(3).fill("1,000 ₪");
  await page.locator("textarea.textarea").nth(4).fill("שלושה לקוחות בחודש");
  await page.click("text=בניית טיוטה");
  check(await page.isVisible("text=תוכנית רכישת לקוחות"), "offer builder generates a draft");

  // Check-in
  await page.goto(BASE + "#/checkin");
  await page.waitForSelector("text=צ'ק-אין יומי");
  await page.fill("input.num-input >> nth=0", "6.5");
  await page.click("button[aria-label='אנרגיה 4 מתוך 5']");
  await page.click("button:has-text('שמירה')");
  await page.waitForSelector("text=תוכנית היום");
  check(await page.isVisible("text=6.5"), "check-in saves and shows on home");

  // Review
  await page.goto(BASE + "#/review");
  await page.waitForSelector("text=רפלקציה יומית");
  await page.locator("textarea.textarea").nth(0).fill("הצלחתי לשמור על שגרה");
  await page.click("button:has-text('שמירה')");
  await page.waitForSelector("text=תוכנית היום");
  check(true, "daily review saves");

  // Coach (no API configured -> basic mode)
  await page.goto(BASE + "#/coach");
  await page.waitForSelector("text=המאמן");
  await page.click("button.chip:has-text('לשפר את שגרת השינה')");
  await page.waitForSelector("text=מצב בסיסי", { timeout: 5000 });
  check(true, "coach responds in basic mode when no AI is configured");
  await page.screenshot({ path: "./e2e-out/05-coach.png", fullPage: true });

  // Tracking
  await page.goto(BASE + "#/track");
  await page.waitForSelector("text=מעקב והתקדמות");
  check(await page.isVisible("text=שעות שינה"), "tracking shows charts after data exists");
  await page.fill("input.input[maxlength='60']", "לכתוב שלוש שורות");
  await page.click("button:has-text('הוספת הרגל')");
  check(await page.isVisible("text=ההרגל נוסף"), "habit can be added");
  await page.screenshot({ path: "./e2e-out/06-tracking.png", fullPage: true });

  // Profile + export
  await page.goto(BASE + "#/profile");
  await page.waitForSelector("text=פרופיל והגדרות");
  check(await page.isVisible("text=ייצוא גיבוי מלא"), "profile exposes data export");
  await page.screenshot({ path: "./e2e-out/07-profile.png", fullPage: true });

  // Unknown route
  await page.goto(BASE + "#/nope");
  check(await page.isVisible("text=העמוד לא נמצא"), "unknown route shows a helpful not-found screen");

  // Mobile overflow check on home
  await page.goto(BASE);
  await page.waitForSelector("text=תוכנית היום");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 1, `no horizontal overflow at 390px (overflow=${overflow})`);

  await browser.close();
  console.log(errors.length ? `\nERRORS (${errors.length}):\n` + errors.join("\n") : "\nNo console or page errors.");
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
