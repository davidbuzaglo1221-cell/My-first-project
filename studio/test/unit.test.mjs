import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-test-'));
process.env.STUDIO_DATA = path.join(tmp, 'data');
process.env.STUDIO_OUT = path.join(tmp, 'out');
process.env.VAIDEO_API_KEY = 'vd_test_key';
process.env.STUDIO_POLL_MS = '50';

const { decide, approvalCovers, autoPick } = await import('../lib/budget.mjs');
const { analyze, buildPlan, captionFrom, plan } = await import('../lib/planner.mjs');
const { parseMcpBody } = await import('../lib/mcp.mjs');
const { captionsAss, trimToTarget } = await import('../lib/compose.mjs');
const { techScore } = await import('../lib/media.mjs');

const eng = (id, extra = {}) => ({ id, freeGrant: 5, unit: 'קרדיט', currency: '€', ...extra });

test('budget: free while the free grant and balance cover the estimate', () => {
  const d = decide(eng('vaideo'), { credits: 1, money: 0.29 }, { connected: true, credits: 5 }, { spentCredits: 0 });
  assert.equal(d.kind, 'free');
  assert.equal(d.money, 0);
});

test('budget: paid once the free grant is used up', () => {
  const d = decide(eng('vaideo'), { credits: 1, money: 0.29 }, { connected: true, credits: 40 }, { spentCredits: 5 });
  assert.equal(d.kind, 'paid');
  assert.equal(d.money, 0.29);
});

test('budget: credits bought on a paid plan count as money', () => {
  const d = decide(eng('aituber', { freeGrant: 100 }), { credits: 35, money: 0.55 }, { connected: true, credits: 2500, freePlan: false }, {});
  assert.equal(d.kind, 'paid');
});

test('budget: unknown price is paid and needs an explicit unknown-price approval', () => {
  const d = decide(eng('korpi', { freeGrant: 0 }), { credits: null, money: null }, { connected: true }, {});
  assert.equal(d.kind, 'paid');
  assert.equal(approvalCovers({}, 'korpi', d), false);
  assert.equal(approvalCovers({ korpi: { maxMoney: 5 } }, 'korpi', d), false);
  assert.equal(approvalCovers({ korpi: { unknownPrice: true } }, 'korpi', d), true);
});

test('budget: an approval must cover at least the estimated amount', () => {
  const d = { kind: 'paid', money: 0.7 };
  assert.equal(approvalCovers({ seedance: { maxMoney: 0.5 } }, 'seedance', d), false);
  assert.equal(approvalCovers({ seedance: { maxMoney: 0.7 } }, 'seedance', d), true);
  assert.equal(approvalCovers({ vaideo: { maxMoney: 9 } }, 'seedance', d), false);
});

test('budget: disconnected engines are unavailable, local is always free', () => {
  assert.equal(decide(eng('seedance'), { money: 1 }, { connected: false, note: 'x' }).kind, 'unavailable');
  assert.equal(decide({ id: 'local' }, {}, {}).kind, 'free');
});

test('auto mode: best free external engines first, local only as fallback', () => {
  const brief = analyze('טיפים לזקן', { lengthSec: 30 });
  const rows = [
    { engine: { id: 'seedance' }, decision: { kind: 'paid' } },
    { engine: { id: 'vaideo' }, decision: { kind: 'free' } },
    { engine: { id: 'aituber' }, decision: { kind: 'free' } },
    { engine: { id: 'local' }, decision: { kind: 'free' } },
  ];
  assert.deepEqual(autoPick(rows, brief), ['vaideo', 'aituber']);
  assert.deepEqual(autoPick(rows.filter(r => r.engine.id === 'local' || r.engine.id === 'seedance'), brief), ['local']);
});

test('planner: goal detection, scene count and timing add up', () => {
  const b = analyze('שלושה טיפים לזקן מסודר', { lengthSec: 30, aspect: '1:1' });
  assert.equal(b.goal, 'teach');
  assert.equal(b.aspect, '1:1');
  assert.equal(b.language, 'he');
  const p = buildPlan(b);
  assert.equal(p.scenes.length, b.scenes);
  const total = p.scenes.reduce((a, s) => a + s.durationSec, 0);
  assert.ok(Math.abs(total - 30) < 1, `total ${total}`);
  assert.equal(p.scenes[0].role, 'hook');
  assert.equal(p.scenes.at(-1).role, 'cta');
});

test("planner: David's own words never go on screen", () => {
  const idea = 'סרטון על תספורת פייד מושלמת למספרה שיביא לקוחות';
  const p = plan(idea, { lengthSec: 20 });
  for (const s of p.scenes) {
    assert.ok(!idea.includes(s.caption) || s.caption.length < 6, `caption echoes the idea: ${s.caption}`);
    assert.ok(!s.narration.includes('פייד מושלמת'), 'narration echoes the idea');
  }
  assert.ok(p.scenes.some(s => s.visual.includes('פייד')), 'the idea still drives the visuals');
});

test('planner: rejects empty ideas, clamps length', () => {
  assert.throws(() => analyze('  '));
  assert.equal(analyze('רעיון', { lengthSec: 999 }).lengthSec, 180);
  assert.equal(captionFrom('אחת שתיים שלוש ארבע חמש שש.'), 'אחת שתיים שלוש ארבע');
});

test('mcp: parses JSON and SSE bodies', () => {
  assert.deepEqual(parseMcpBody('{"jsonrpc":"2.0","id":1,"result":{"a":1}}', 1).result, { a: 1 });
  const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}\n\n';
  assert.deepEqual(parseMcpBody(sse, 2, 'text/event-stream').result, { ok: true });
});

test('captions: ASS has RTL-safe events with the right timings and canvas', () => {
  const ass = captionsAss([{ role: 'hook', caption: 'פתיחה', durationSec: 2 }, { role: 'beat', caption: 'שורה {x}', durationSec: 1.5 }], '9:16');
  assert.match(ass, /PlayResX: 1080\nPlayResY: 1920/);
  assert.match(ass, /Dialogue: 0,0:00:00.04,0:00:01.94,Hook/);
  assert.match(ass, /Dialogue: 0,0:00:02.04,0:00:03.44,Beat/);
  assert.ok(!ass.includes('{x}'), 'braces are stripped so captions cannot inject ASS tags');
});

test('techScore: 1080p30 with audio scores high, 480p silent scores low', () => {
  const hi = techScore({ width: 1080, height: 1920, fps: 30, duration: 10, sizeBytes: 8e6, hasAudio: true });
  const lo = techScore({ width: 480, height: 854, fps: 24, duration: 10, sizeBytes: 5e5, hasAudio: false });
  assert.ok(hi >= 90 && lo < 50, `${hi} ${lo}`);
});

test('vaideo adapter: full flow against a fake API returns a real, playable MP4', async () => {
  const mp4 = path.join(tmp, 'fake.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=360x640:d=2', '-f', 'lavfi', '-i', 'sine=d=2', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', mp4]);
  const calls = [];
  let polls = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opt = {}) => {
    calls.push({ url: String(url), method: opt.method || 'GET', auth: opt.headers?.Authorization });
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
    if (String(url).endsWith('/videos') && opt.method === 'POST') return json({ id: 'v1', status: 'queued' }, 201);
    if (String(url).endsWith('/videos/v1')) return json(++polls < 2 ? { id: 'v1', status: 'processing', progress: 40 } : { id: 'v1', status: 'completed', video_url: 'https://files.test/v1.mp4', credits: 1 });
    if (String(url) === 'https://files.test/v1.mp4') return new Response(fs.readFileSync(mp4), { status: 200 });
    return json({ error: 'unexpected' }, 500);
  };
  try {
    const { default: vaideo } = await import('../engines/vaideo.mjs');
    const { probe } = await import('../lib/media.mjs');
    const p = { ...plan('טיפים לזקן', { lengthSec: 20 }), jobId: 't1' };
    const work = path.join(tmp, 'w'); fs.mkdirSync(work, { recursive: true });
    const r = await vaideo.generate(p, { aspect: '9:16', work, onProgress: () => {} });
    const pr = await probe(r.file);
    assert.ok(pr.duration > 1.5 && pr.width === 360, JSON.stringify(pr));
    assert.equal(r.credits, 1);
    const create = calls.find(c => c.method === 'POST');
    assert.equal(create.auth, 'Bearer vd_test_key');
  } finally { globalThis.fetch = real; }
});

test('length: narration that runs long drops middle beats, keeps hook and call to action', () => {
  const scenes = Array.from({ length: 7 }, (_, i) => ({ role: i === 0 ? 'hook' : i === 6 ? 'cta' : 'beat', durationSec: 2.1, narration: 'x' + i }));
  const vo = { files: scenes.map((_, i) => 'f' + i), durations: scenes.map(() => 2.6) };
  const t = trimToTarget(scenes, vo, 15);
  const total = t.scenes.reduce((a, s, i) => a + Math.max(s.durationSec * 0.6, t.vo.durations[i] + 0.25, 1), 0);
  assert.ok(total <= 15 * 1.12, `total ${total}`);
  assert.equal(t.scenes[0].role, 'hook'); assert.equal(t.scenes.at(-1).role, 'cta');
  assert.equal(t.vo.files.length, t.scenes.length);
});
