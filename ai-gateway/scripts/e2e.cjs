// End-to-end check of the dashboard in a real browser, against a running gateway.
//   GATEWAY_URL   default http://127.0.0.1:3210
//   GATEWAY_TOKEN the access code (APP_ACCESS_TOKEN of that gateway)
//   SHOTS         optional folder for screenshots
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const base = process.env.GATEWAY_URL || "http://127.0.0.1:3210";
const token = process.env.GATEWAY_TOKEN;
if (!token) throw new Error("GATEWAY_TOKEN is required");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const step = (s) => console.log("✓", s);

  await page.goto(base + "/");
  await page.fill("#code", "wrong-code-wrong-code");
  await page.click("#enter");
  await page.waitForFunction(() => document.querySelector("#loginErr").textContent.length > 0);
  assert.match(await page.textContent("#loginErr"), /קוד שגוי/);
  step("a wrong code is refused");

  await page.fill("#code", token);
  await page.click("#enter");
  await page.waitForSelector("#providers .row");
  const rows = await page.$$eval("#providers .row", (r) => r.map((x) => ({ id: x.dataset.provider, state: x.querySelector(".state").textContent })));
  assert.equal(rows.length, 9);
  const freellm = rows.find((r) => r.id === "freellmapi");
  assert.match(freellm.state, /עובד/);
  assert.match(rows.find((r) => r.id === "claude").state, /חסר מפתח/);
  step(`providers list: ${rows.filter((r) => /עובד/.test(r.state)).length} working, claude shown as not connected`);

  const html = await page.content();
  assert.ok(!/freellmapi-[0-9a-f]{8,}/i.test(html), "the unified FreeLLMAPI key must not reach the browser");
  assert.ok(!html.includes(token), "the access code must not be rendered");
  step("no key in the page");
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/providers.png`, fullPage: true });

  await page.click('.seg button[data-tab="tasks"]');
  const tasks = await page.$$eval("#tasks .row", (r) => r.length);
  assert.equal(tasks, 5);
  const firstChips = await page.$$eval("#tasks .row .chip.first", (c) => c.map((x) => x.textContent));
  assert.ok(firstChips.every((t) => t.startsWith("claude")), "Claude stays first");
  step("five tasks, Claude first in each");

  await page.click('button.test[data-task="hebrew"]');
  await page.waitForFunction(() => {
    const r = document.querySelector('[data-task="hebrew"] .result');
    return r && !r.classList.contains("hidden") && !/שולח/.test(r.textContent);
  }, null, { timeout: 90_000 });
  const res = await page.textContent('[data-task="hebrew"] .result');
  assert.match(res, /ענה:/, res);
  assert.match(res, /פריז/, res);
  step("live test of the Hebrew task: " + res.split("\n")[0]);

  await page.click('button.test[data-task="vision"]');
  await page.waitForFunction(() => {
    const r = document.querySelector('[data-task="vision"] .result');
    return r && !r.classList.contains("hidden") && !/שולח/.test(r.textContent);
  }, null, { timeout: 90_000 });
  const vis = await page.textContent('[data-task="vision"] .result');
  assert.match(vis, /ענה:/, vis);
  step("live test of the vision task: " + vis.split("\n").slice(0, 2).join(" | "));
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/tasks.png`, fullPage: true });

  await page.click('.seg button[data-tab="usage"]');
  await page.waitForSelector("#usage .row");
  const usage = await page.textContent("#usage");
  assert.match(usage, /בקשות/);
  assert.notEqual(await page.textContent("#sRequests"), "0");
  step("usage and errors view shows the requests just made");
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/usage.png`, fullPage: true });

  await page.reload();
  await page.waitForSelector("#providers .row");
  step("the code is remembered after reload");
  await page.click("#logout");
  assert.ok(await page.isVisible("#login"));
  step("logout returns to the code screen");

  assert.deepEqual(errors, []);
  step("no page errors");
  await browser.close();
})().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
