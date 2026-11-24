// Idea -> brief (goal, style, cast) -> script with dialogue -> scenes. Offline and deterministic: it always works and costs nothing.
// The best scripts come from Claude in chat (cli --plan) or from an engine's own script writer (AITuber/Vaideo idea mode,
// Korpi write_script). This planner guarantees structure: a hook in the first second, a turn, a twist, a payoff.
import { describe, NARRATOR_VOICE } from './characters.mjs';

export const STYLES = {
  realistic: { he: 'קולנוע ריאליסטי', prompt: 'realistic cinema, anamorphic lens, motivated practical light, shallow depth of field, film grain, grounded real locations', vaideo: 'cinematic', music: 'cinematic', palette: 'graphite' },
  cartoon3d: { he: 'קרטון תלת־ממד', prompt: 'stylized 3D cartoon, chunky rounded shapes, saturated colours, soft studio lighting, squash-and-stretch exaggerated poses', vaideo: 'fantasy', music: 'energetic', palette: 'violet' },
  pixar: { he: 'אנימציה בהשראת פיקסאר', prompt: 'feature-film 3D animation in a warm family-film style, subsurface-scattered skin, big expressive eyes, cinematic global illumination, emotional close-ups', vaideo: 'fantasy', music: 'cinematic', palette: 'violet' },
  tiktok: { he: 'קומדיה ויראלית', prompt: 'viral vertical comedy, punchy handheld phone-camera framing, snap zooms, reaction close-ups, bright natural light, meme timing', vaideo: 'photo', music: 'energetic', palette: 'magenta' },
  hyperreal: { he: 'דמויות היפר־ריאליסטיות', prompt: 'hyper-realistic characters, photoreal skin and materials, macro detail, 85mm portrait lens, cinematic rim light, 8k texture fidelity', vaideo: 'cinematic', music: 'cinematic', palette: 'graphite' },
  mixed: { he: 'מיקס יצירתי', prompt: 'mixed creative style: photoreal world with stylized 3D characters, bold colour accents, inventive transitions, playful scale', vaideo: 'fantasy', music: 'energetic', palette: 'violet' },
};
// Older style names still work.
const ALIASES = { cinematic: 'realistic', editorial: 'realistic', documentary: 'realistic', animation: 'pixar', anime: 'cartoon3d', minimal: 'mixed' };
export const normStyle = s => STYLES[s] ? s : STYLES[ALIASES[s]] ? ALIASES[s] : null;

export const ASPECTS = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080] };

// Order matters: the most specific intent wins ("3 tips for a beard" is teaching, not selling).
const GOALS = [
  { id: 'laughs', he: 'להצחיק', re: /(מצחיק|צחוק|הומור|בדיחה|קורע|פדיחה|POV|פוב|מתיחה|כשלקוח|כשאתה|כשאת|מדברים|מדבר|מדברת|ריב|רבים)/i },
  { id: 'teach', he: 'ללמד', re: /(טיפ|מדריך|איך |שלבים|טעויות|דרכים|מה זה|ללמוד|סוד )/ },
  { id: 'story', he: 'לספר סיפור', re: /(סיפור|פעם אחת|יום אחד|מסע|חלום|גיבור|עלילה|הרפתק|דרמה|דרמטי)/ },
  { id: 'clients', he: 'להביא לקוחות', re: /(לקוח|תור|הזמנ|מבצע|הנחה|מחיר|שירות|לקבוע|מספרה|עסק|מוצר|למכור|מכיר|קידום|פרסומת)/ },
  { id: 'views', he: 'צפיות', re: /./ },
];

// Characters the planner can recognise in an idea. Each gets a draft look; the library can override it.
const LEXICON = [
  ['עגבני', 'עגבנייה', 'fruit', 'a round glossy red tomato character with a tiny green leaf crown, big expressive eyes, small arms and legs', 'bright red, leaf green'],
  ['מלפפון', 'מלפפון', 'fruit', 'a tall bumpy green cucumber character, long and lanky, droopy confident eyes', 'deep green'],
  ['בננ', 'בננה', 'fruit', 'a curved yellow banana character with a brown stem tuft, wide grin', 'banana yellow'],
  ['תפוח', 'תפוח', 'fruit', 'a shiny red apple character with a single leaf on the stem, round cheeks', 'apple red'],
  ['תפוז', 'תפוז', 'fruit', 'a dimpled orange character with a green stem, bouncy and round', 'orange'],
  ['אבטיח', 'אבטיח', 'fruit', 'a huge striped watermelon character, heavy and slow, tiny legs', 'striped green, pink inside'],
  ['לימון', 'לימון', 'fruit', 'a sour-faced yellow lemon character with a pointy tip, squinting eyes', 'lemon yellow'],
  ['גזר', 'גזר', 'fruit', 'a slim orange carrot character with a leafy green hairdo', 'carrot orange'],
  ['חציל', 'חציל', 'fruit', 'a glossy purple eggplant character with a green cap, dramatic eyebrows', 'aubergine purple'],
  ['פלפל', 'פלפל', 'fruit', 'a stocky red bell pepper character with a curly stem, hot-headed', 'pepper red'],
  ['אבוקדו', 'אבוקדו', 'fruit', 'a halved avocado character with a big brown pit belly, chill eyes', 'avocado green'],
  ['תות', 'תות', 'fruit', 'a small strawberry character with seeds and a leafy hat, sweet big eyes', 'strawberry red'],
  ['בצל', 'בצל', 'fruit', 'a papery golden onion character with teary eyes', 'golden brown'],
  ['ברוקולי', 'ברוקולי', 'fruit', 'a broccoli character with a fluffy green afro', 'broccoli green'],
  ['חתול', 'חתול', 'animal', 'an orange tabby cat with human expressions, judgemental half-closed eyes', 'orange tabby'],
  ['כלב', 'כלב', 'animal', 'a golden retriever dog with human expressions, overexcited', 'golden'],
  ['תרנגול', 'תרנגולת', 'animal', 'a white hen with a red comb, dramatic and gossipy', 'white, red comb'],
  ['פרה', 'פרה', 'animal', 'a black-and-white cow with long eyelashes, calm and wise', 'black and white'],
  ['קוף', 'קוף', 'animal', 'a cheeky brown monkey with a mischievous grin', 'brown'],
  ['דוב', 'דוב', 'animal', 'a big brown bear, gentle giant, sleepy eyes', 'brown'],
  ['ינשוף', 'ינשוף', 'animal', 'a round owl with huge round glasses-like eyes, know-it-all', 'brown, cream'],
  ['צפרדע', 'צפרדע', 'animal', 'a bright green frog with huge eyes, nervous energy', 'lime green'],
  ['פינגווין', 'פינגווין', 'animal', 'a small penguin in a tuxedo look, very formal', 'black, white'],
  ['ארנב', 'ארנב', 'animal', 'a fluffy grey rabbit with long ears, hyperactive', 'grey'],
];

const VOICE_CYCLE = ['bright-m', 'warm-f', 'cartoon', 'deep-m', 'bright-f', 'giant'];

export function inferCast(text) {
  const found = [];
  for (const [stem, name, kind, look, colors] of LEXICON) {
    if (text.includes(stem) && !found.some(f => f.name === name)) found.push({ id: `auto-${found.length}`, name, kind, look, colors, face: '', personality: '', voice: VOICE_CYCLE[found.length % VOICE_CYCLE.length], auto: true });
    if (found.length === 3) break;
  }
  return found;
}

export function autoStyle(text, cast = []) {
  if (/(היפר|פוטוריאל|ריאליסטי מאוד|כמו אמיתי)/.test(text)) return 'hyperreal';
  if (/(פיקסאר|דיסני|סרט מצויר|משפחתי)/.test(text)) return 'pixar';
  if (/(תלת|3D|קרטון|מצויר)/i.test(text)) return 'cartoon3d';
  if (/(טיקטוק|POV|פוב|מצחיק|מתיחה|ויראלי)/i.test(text)) return 'tiktok';
  if (cast.some(c => c.kind === 'fruit' || c.kind === 'animal')) return 'pixar';
  if (/(דרמה|קולנוע|סרט|מתח|אמיתי)/.test(text)) return 'realistic';
  return 'mixed';
}

const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

/** Short, maybe voice-typed idea -> structured brief. `cast` = saved characters chosen by David (optional). */
export function analyze(idea, { lengthSec = 30, style = 'auto', aspect = '9:16', cast = null } = {}) {
  const text = clean(idea);
  if (text.length < 3) throw new Error('הרעיון קצר מדי');
  const goal = GOALS.find(g => g.re.test(text));
  const castList = (cast && cast.length ? cast : inferCast(text)).slice(0, 4);
  const st = style === 'auto' || !normStyle(style) ? autoStyle(text, castList) : normStyle(style);
  const len = Math.max(6, Math.min(180, Math.round(lengthSec)));
  const hebrew = /[֐-׿]/.test(text);
  const shotSec = len <= 20 ? 2.2 : len <= 45 ? 3 : len <= 90 ? 4 : 5;
  const scenes = Math.max(4, Math.min(24, Math.round(len / shotSec)));
  return {
    idea: text, goal: goal.id, goalHe: goal.he, lengthSec: len, style: st, styleHe: STYLES[st].he, styleAuto: style === 'auto' || !normStyle(style),
    aspect: ASPECTS[aspect] ? aspect : '9:16', language: hebrew ? 'he' : 'en', scenes, cast: castList,
  };
}

// ---------- Script templates ----------
// Roles: hook (first second), setup, turn, escalate, twist, payoff, cta. {A} {B} {C} = character names.
const DUO = {
  laughs: [
    ['hook', 'A', 'רגע. אף אחד לא אמר לי שזה היום.'],
    ['setup', 'B', 'כי ידענו בדיוק מה תגיד.'],
    ['turn', 'A', 'אני? אני הכי רגוע פה.'],
    ['escalate', 'B', 'אתה רועד.'],
    ['escalate', 'A', 'זה מהקור. רק מהקור.'],
    ['twist', 'N', 'שלוש שניות אחר כך —'],
    ['payoff', 'B', 'טוב. גם אני רועד.'],
    ['cta', 'N', 'תייג מישהו שזה בדיוק הוא.'],
  ],
  story: [
    ['hook', 'A', 'אם אתה רואה את זה — זה כבר קרה.'],
    ['setup', 'B', 'אמרתי לך לא לגעת בזה.'],
    ['turn', 'A', 'נגעתי רק קצת.'],
    ['escalate', 'B', 'קצת? תסתכל סביבך.'],
    ['twist', 'N', 'ואז הם הבינו מי באמת אחראי.'],
    ['payoff', 'A', 'אז... אתה איתי?'],
    ['payoff', 'B', 'תמיד. לצערי.'],
    ['cta', 'N', 'חלק שני? תכתבו בתגובות.'],
  ],
  teach: [
    ['hook', 'A', 'עוצר הכל. אתה עושה את זה לא נכון.'],
    ['setup', 'B', 'כולם עושים את זה ככה.'],
    ['turn', 'A', 'בדיוק. ולכן כולם נתקעים.'],
    ['escalate', 'A', 'הסוד הוא בפרט הקטן.'],
    ['twist', 'B', 'רגע... זה הכל?'],
    ['payoff', 'A', 'זה הכל. עכשיו תנסה.'],
    ['cta', 'N', 'שמור את זה. תצטרך.'],
  ],
};
DUO.views = DUO.laughs; DUO.clients = [
  ['hook', 'A', 'תראה את זה לפני שאתה מחליט.'],
  ['setup', 'B', 'ראיתי כבר הכל.'],
  ['turn', 'A', 'את זה לא.'],
  ['escalate', 'B', 'טוב... זה באמת נראה אחרת.'],
  ['twist', 'N', 'ההבדל הוא בפרטים.'],
  ['payoff', 'B', 'איפה קובעים?'],
  ['cta', 'N', 'הקישור בפרופיל.'],
];

const SOLO = {
  laughs: [['hook', 'A', 'אף אחד לא הכין אותי לזה.'], ['setup', 'A', 'זה התחיל רגיל לגמרי.'], ['turn', 'A', 'ואז זה קרה.'], ['escalate', 'A', 'שקט מוחלט.'], ['twist', 'N', 'וזה עוד לא החלק הכי גרוע.'], ['payoff', 'A', 'עד היום מדברים על זה.'], ['cta', 'N', 'תייג מישהו שזה הוא.']],
  story: [['hook', 'A', 'הכל התחיל ברגע אחד.'], ['setup', 'A', 'אף אחד לא האמין.'], ['turn', 'A', 'היו רגעים שכמעט ויתרתי.'], ['twist', 'N', 'ואז הכל השתנה.'], ['payoff', 'A', 'וזה רק ההתחלה.'], ['cta', 'N', 'המשך בחלק הבא.']],
  teach: [['hook', 'A', 'רוב האנשים עושים את זה לא נכון.'], ['setup', 'A', 'שלב ראשון: פשוט יותר ממה שחשבת.'], ['turn', 'A', 'שלב שני: כאן כולם טועים.'], ['escalate', 'A', 'שלב שלישי: הפרט שעושה את ההבדל.'], ['payoff', 'A', 'עכשיו אתה יודע.'], ['cta', 'N', 'שמור את זה. תצטרך.']],
  clients: [['hook', 'A', 'רגע לפני שאתה מחליט — תראה את זה.'], ['setup', 'A', 'זה מתחיל בפרט אחד קטן.'], ['turn', 'A', 'ואז רואים את ההבדל.'], ['escalate', 'A', 'כל פרט מדויק.'], ['payoff', 'A', 'ככה זה נראה כשעושים את זה נכון.'], ['cta', 'N', 'הקישור בפרופיל. תקבע.']],
};
SOLO.views = [['hook', 'A', 'את זה לא ראית עדיין.'], ['setup', 'A', 'תסתכל טוב.'], ['turn', 'A', 'כל שנייה כאן מתוכננת.'], ['twist', 'N', 'עכשיו תסתכל שוב.'], ['payoff', 'A', 'זה ההבדל.'], ['cta', 'N', 'עקוב לעוד.']];

const CAMERA = ['snap zoom in', 'low angle hero shot', 'extreme close-up reaction', 'whip pan', 'over-the-shoulder two-shot', 'slow push-in', 'dutch angle', 'wide establishing shot'];
const ROLE_SHOT = { hook: 'striking opening frame, instant intrigue', setup: 'establishing the situation', turn: 'tension rises', escalate: 'exaggerated reaction', twist: 'surprise reveal', payoff: 'comic or emotional payoff', cta: 'confident closing frame with space for text' };

/** Script + scenes. Each scene: speaker, spoken line, on-screen caption, English visual prompt, duration. */
export function buildPlan(brief) {
  const cast = brief.cast || [];
  const tpl = cast.length >= 2 ? DUO[brief.goal] : SOLO[brief.goal];
  // Fit the template to the scene count: repeat escalation beats for long videos, keep hook / twist / payoff / cta.
  let beats = [...tpl];
  while (beats.length < brief.scenes) { const i = beats.findIndex(b => b[0] === 'twist'); beats.splice(Math.max(1, i), 0, beats.find(b => b[0] === 'escalate') || beats[2]); }
  while (beats.length > brief.scenes && beats.length > 4) { const i = beats.findIndex((b, k) => k > 0 && ['escalate', 'setup', 'turn'].includes(b[0])); if (i < 0) break; beats.splice(i, 1); }
  const who = { A: cast[0], B: cast[1] || cast[0], C: cast[2] || cast[0] };
  const st = STYLES[brief.style];
  const castDesc = cast.map(describe).join('; ');
  const shotSec = +(brief.lengthSec / beats.length).toFixed(2);
  const scenes = beats.map(([role, sp, line], i) => {
    const ch = sp === 'N' || !cast.length ? null : who[sp];
    return {
      index: i, role,
      speaker: ch ? ch.id : 'narrator', speakerName: ch ? ch.name : 'קריין', voice: ch ? ch.voice : NARRATOR_VOICE,
      narration: line,
      caption: captionFrom(line),
      visual: [
        `${st.prompt}`,
        castDesc && `characters (keep identical in every shot): ${castDesc}`,
        `story: ${brief.idea}`,
        `shot ${i + 1}: ${ROLE_SHOT[role]}, ${CAMERA[i % CAMERA.length]}${ch ? `, ${ch.name} speaking to camera with clear mouth movement` : ''}`,
        'vertical-safe composition, no on-screen text',
      ].filter(Boolean).join('. '),
      durationSec: shotSec,
    };
  });
  return {
    brief,
    title: brief.idea.slice(0, 48),
    cast,
    script: scenes.map(s => `${s.speakerName}: ${s.narration}`).join('\n'),
    scenes,
    music: st.music,
    // For engines that write their own script (Vaideo, AITuber idea mode).
    enginePrompt: `${brief.idea}. ${brief.language === 'he' ? 'שפה: עברית. ' : ''}מטרה: ${brief.goalHe}. סגנון: ${brief.styleHe}. ${cast.length ? `דמויות: ${cast.map(c => c.name).join(', ')}. ` : ''}פתיחה חזקה בשנייה הראשונה, משפטים קצרים, טוויסט לפני הסוף, קריאה לפעולה בסוף.`,
  };
}

// On-screen text is a short punch, not the full sentence.
export function captionFrom(line) {
  const words = clean(line).replace(/[—–-]/g, ' ').split(' ').filter(Boolean);
  if (words.length <= 8) return words.join(' ').replace(/[.]+$/, '');
  // Longer lines: the first clause, so the caption never stops mid-thought.
  const clause = clean(line).split(/[.,:?!]/)[0].split(' ').filter(Boolean);
  return (clause.length >= 3 && clause.length <= 7 ? clause : words.slice(0, 5)).join(' ');
}

export function plan(idea, opts) { return buildPlan(analyze(idea, opts)); }
