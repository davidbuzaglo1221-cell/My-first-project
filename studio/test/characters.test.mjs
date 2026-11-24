import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-chars-'));
process.env.STUDIO_DATA = path.join(tmp, 'data');
process.env.STUDIO_OUT = path.join(tmp, 'out');
const C = await import('../lib/characters.mjs');
const { analyze, buildPlan, plan, autoStyle, inferCast, STYLES } = await import('../lib/planner.mjs');
const { captionsAss } = await import('../lib/compose.mjs');

const PNG = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4d30000000049454e44ae426082', 'hex').toString('base64');

test('characters: create, update, image, engine ref, delete', () => {
  const c = C.createCharacter({ name: 'עגבנייה', kind: 'fruit', look: 'round red tomato', voice: 'cartoon' });
  assert.equal(C.listCharacters().length, 1);
  assert.equal(C.updateCharacter(c.id, { personality: 'דרמטית' }).personality, 'דרמטית');
  const withImg = C.setCharacterImage(c.id, PNG);
  assert.ok(fs.existsSync(C.imagePath(withImg)));
  C.setEngineRef(c.id, 'aituber', { id: 'x', handle: 'Tomato' });
  assert.equal(C.getCharacter(c.id).engines.aituber.handle, 'Tomato');
  // A new face resets engine refs so engines re-learn it.
  assert.deepEqual(C.setCharacterImage(c.id, PNG).engines, {});
  C.deleteCharacter(c.id);
  assert.equal(C.listCharacters().length, 0);
  assert.equal(fs.readdirSync(C.IMG_DIR()).length, 0, 'image removed with the character');
});

test('characters: validation and fake images rejected', () => {
  assert.throws(() => C.createCharacter({ name: '' }), /שם/);
  const c = C.createCharacter({ name: 'x', voice: 'nope', kind: 'nope' });
  assert.equal(c.voice, 'bright-m'); assert.equal(c.kind, 'cartoon3d');
  assert.throws(() => C.setCharacterImage(c.id, 'data:image/png;base64,' + Buffer.from('not a png').toString('base64')), /תקינה/);
  assert.throws(() => C.setCharacterImage(c.id, 'data:text/html;base64,AAAA'), /PNG/);
});

test('planner: talking fruit -> cast inferred, Pixar style, dialogue between two voices', () => {
  const b = analyze('עגבנייה ומלפפון רבים מי ייכנס ראשון לסלט', { lengthSec: 20 });
  assert.deepEqual(b.cast.map(c => c.name), ['עגבנייה', 'מלפפון']);
  assert.equal(b.style, 'pixar'); assert.ok(b.styleAuto);
  const p = buildPlan(b);
  const speakers = new Set(p.scenes.map(s => s.speaker));
  assert.ok(speakers.has('auto-0') && speakers.has('auto-1'), 'both characters speak');
  assert.notEqual(p.scenes.find(s => s.speaker === 'auto-0').voice, p.scenes.find(s => s.speaker === 'auto-1').voice, 'each has its own voice');
  // Every visual prompt carries both character descriptions: same look in every scene.
  assert.ok(p.scenes.every(s => s.visual.includes('tomato') && s.visual.includes('cucumber')));
  assert.equal(p.scenes[0].role, 'hook'); assert.equal(p.scenes.at(-1).role, 'cta');
  assert.ok(p.scenes.some(s => s.role === 'twist'), 'there is a twist');
});

test('planner: auto style picks per idea, explicit style wins, old names still work', () => {
  assert.equal(autoStyle('POV כשהלקוח מבקש עוד קצת מלמעלה'), 'tiktok');
  assert.equal(autoStyle('דמות היפר ריאליסטית של ספר'), 'hyperreal');
  assert.equal(autoStyle('סיפור דרמה על אבא ובן'), 'realistic');
  assert.equal(autoStyle('דמות תלת מצחיקה'), 'cartoon3d');
  assert.equal(analyze('חתול מדבר', { style: 'realistic' }).style, 'realistic');
  assert.equal(analyze('חתול מדבר', { style: 'cinematic' }).style, 'realistic');
  assert.equal(Object.keys(STYLES).length, 6);
  assert.deepEqual(inferCast('סתם רעיון בלי דמויות'), []);
});

test('planner: saved characters override inference and keep their voice', () => {
  const a = C.createCharacter({ name: 'מוטי', kind: 'animal', look: 'grumpy cat', voice: 'giant' });
  const p = plan('עגבנייה מדברת', { lengthSec: 15, cast: [a] });
  assert.deepEqual(p.cast.map(c => c.name), ['מוטי']);
  assert.ok(p.scenes.filter(s => s.speaker === a.id).every(s => s.voice === 'giant'));
});

test('captions: speaker name shown above the line in dialogue', () => {
  const ass = captionsAss([{ role: 'hook', caption: 'רגע', durationSec: 1, speaker: 'x', speakerName: 'עגבנייה' }, { role: 'beat', caption: 'מה', durationSec: 1, speaker: 'x', speakerName: 'עגבנייה' }], '9:16');
  const lines = ass.split('\n').filter(l => l.startsWith('Dialogue'));
  assert.ok(!lines[0].includes('עגבנייה'), 'no name on the hook');
  assert.ok(lines[1].includes('עגבנייה\\N'), 'name above the line');
});
