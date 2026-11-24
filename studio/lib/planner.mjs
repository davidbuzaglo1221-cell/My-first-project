// Idea -> brief -> script -> scenes. Deterministic and offline, so it always works and costs nothing.
// When Claude runs the studio from chat it can pass its own hand-written plan instead (cli --plan),
// and Korpi's free write_script / plan_storyboard can enrich it when a Korpi token is connected.

export const STYLES = {
  cinematic: { he: 'קולנועי', prompt: 'cinematic film look, dramatic directional light, shallow depth of field, anamorphic, 35mm grain, dark moody palette with one warm accent', vaideo: 'cinematic', music: 'cinematic' },
  editorial: { he: 'עריכתי ספיה', prompt: 'editorial photography, muted sepia and black-and-white, natural window light, quiet confidence, real textures', vaideo: 'vintage', music: 'smooth' },
  animation: { he: 'אנימציה תלת־ממד', prompt: 'stylized 3D animation, soft global illumination, expressive characters, rich color, feature-film quality', vaideo: 'fantasy', music: 'energetic' },
  anime: { he: 'אנימה / מצויר', prompt: '2D anime illustration, clean line art, cel shading, dynamic camera', vaideo: 'anime', music: 'energetic' },
  documentary: { he: 'דוקומנטרי', prompt: 'documentary realism, handheld camera, natural light, authentic locations', vaideo: 'documentary', music: 'cinematic' },
  minimal: { he: 'מינימליסטי', prompt: 'minimal abstract motion design, bold shapes, lots of negative space, premium product-film look', vaideo: 'minimal', music: 'smooth' },
};

export const ASPECTS = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080] };

// Order matters: the most specific intent wins ("3 tips for a beard" is teaching, not selling).
const GOALS = [
  { id: 'laughs', he: 'להצחיק', re: /(מצחיק|צחוק|הומור|בדיחה|קורע|פדיחה|POV|פוב|מתיחה|כשלקוח|כשאתה|כשאת)/i },
  { id: 'teach', he: 'ללמד', re: /(טיפ|מדריך|איך |שלבים|טעויות|דרכים|מה זה|ללמוד|סוד )/ },
  { id: 'story', he: 'לספר סיפור', re: /(סיפור|פעם אחת|יום אחד|מסע|חלום|גיבור|דמות|עלילה|הרפתק)/ },
  { id: 'clients', he: 'להביא לקוחות', re: /(לקוח|תור|הזמנ|מבצע|הנחה|מחיר|שירות|לקבוע|מספרה|עסק|מוצר|למכור|מכיר|קידום|פרסומת)/ },
  { id: 'views', he: 'צפיות', re: /./ },
];

const TONES = [
  { id: 'energetic', re: /(מהיר|אנרגי|טירוף|וואו|חזק|כוח|אימון|כושר|ספורט|מוטיבציה)/ },
  { id: 'calm', re: /(רגוע|שקט|נעים|יוקרה|יוקרתי|אלגנט|עדין|מדיטציה)/ },
  { id: 'funny', re: /(מצחיק|צחוק|הומור|בדיחה)/ },
];

const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

/** Turn a short, maybe voice-typed idea into a structured brief. */
export function analyze(idea, { lengthSec = 30, style = 'cinematic', aspect = '9:16' } = {}) {
  const text = clean(idea);
  if (text.length < 3) throw new Error('הרעיון קצר מדי');
  const goal = GOALS.find(g => g.re.test(text));
  const tone = (TONES.find(t => t.re.test(text)) || { id: goal.id === 'laughs' ? 'funny' : 'energetic' }).id;
  const len = Math.max(6, Math.min(180, Math.round(lengthSec)));
  const st = STYLES[style] ? style : 'cinematic';
  const hebrew = /[֐-׿]/.test(text);
  // Shot length: fast cuts for short social videos, a little longer for long-form.
  const shotSec = len <= 20 ? 2.2 : len <= 45 ? 3 : len <= 90 ? 4 : 5;
  const scenes = Math.max(3, Math.min(24, Math.round(len / shotSec)));
  return { idea: text, goal: goal.id, goalHe: goal.he, tone, lengthSec: len, style: st, styleHe: STYLES[st].he, aspect: ASPECTS[aspect] ? aspect : '9:16', language: hebrew ? 'he' : 'en', scenes };
}

// Short spoken lines, built from the idea itself. Never generic filler.
function beatsFor(brief) {
  const subject = brief.idea.replace(/^(סרטון|רילס|וידאו|סרט)\s+(על|של|ש|ל)?\s*/, '').replace(/[.?!]+$/, '');
  const hook = {
    clients: `רגע לפני שאתה מחליט — תראה את זה.`,
    laughs: `אף אחד לא הכין אותי לזה.`,
    teach: `רוב האנשים עושים את זה לא נכון.`,
    story: `הכל התחיל ברגע אחד.`,
    views: `את זה לא ראית עדיין.`,
  }[brief.goal];
  const middle = {
    clients: ['זה מתחיל בפרט אחד קטן.', 'ואז רואים את ההבדל.', 'כל פרט מדויק.', 'ככה זה נראה כשעושים את זה נכון.', 'בלי קיצורי דרך.', 'רק תוצאה.'],
    laughs: ['זה התחיל רגיל לגמרי.', 'ואז זה קרה.', 'אף אחד לא זז.', 'שקט מוחלט.', 'ואז כולם הבינו.', 'עד היום מדברים על זה.'],
    teach: ['שלב ראשון: פשוט יותר ממה שחשבת.', 'שלב שני: כאן כולם טועים.', 'שלב שלישי: הפרט שעושה את ההבדל.', 'תעשה את זה פעם אחת נכון.', 'וזה נשאר איתך.', 'עכשיו אתה יודע.'],
    story: ['אף אחד לא האמין.', 'הדרך הייתה ארוכה.', 'היו רגעים שכמעט ויתר.', 'ואז הכל השתנה.', 'רגע אחד, החלטה אחת.', 'וזה רק ההתחלה.'],
    views: ['תסתכל טוב.', 'כל שנייה כאן מתוכננת.', 'הפרט הזה — שם הסוד.', 'עכשיו תסתכל שוב.', 'זה ההבדל.', 'ועוד לא סיימנו.'],
  }[brief.goal];
  const cta = { clients: 'הקישור בפרופיל. תקבע.', laughs: 'תייג מישהו שזה הוא.', teach: 'שמור את זה. תצטרך.', story: 'המשך בחלק הבא.', views: 'עקוב לעוד.' }[brief.goal];
  return { subject, hook, middle, cta };
}

/** Script + scenes. Each scene: spoken line, on-screen caption, a visual prompt (English, for generative models), duration. */
export function buildPlan(brief) {
  const { subject, hook, middle, cta } = beatsFor(brief);
  const n = brief.scenes;
  // David's words are the brief, never the copy: the idea goes into the visual prompts, not on screen.
  const lines = [hook];
  for (let i = 0; lines.length < n - 1; i++) lines.push(middle[i % middle.length]);
  lines.push(cta);
  const st = STYLES[brief.style];
  const shotSec = +(brief.lengthSec / n).toFixed(2);
  const camera = ['slow push-in', 'whip pan', 'macro close-up', 'low angle hero shot', 'overhead top-down', 'tracking shot', 'rack focus', 'dolly out reveal'];
  const scenes = lines.map((line, i) => ({
    index: i,
    role: i === 0 ? 'hook' : i === n - 1 ? 'cta' : 'beat',
    narration: line,
    caption: captionFrom(line),
    visual: `${subject}. ${i === 0 ? 'Striking opening frame, instant intrigue' : i === n - 1 ? 'Confident closing frame with space for text' : 'Scene ' + (i + 1) + ' of the story'}, ${camera[i % camera.length]}, ${st.prompt}, vertical-safe composition`,
    durationSec: shotSec,
  }));
  return {
    brief,
    title: subject.slice(0, 48),
    script: scenes.map(s => s.narration).join(' '),
    scenes,
    music: st.music,
    // A single prompt for engines that write their own script (Vaideo, AITuber).
    enginePrompt: `${brief.idea}. ${brief.language === 'he' ? 'שפה: עברית. ' : ''}מטרה: ${brief.goalHe}. סגנון: ${brief.styleHe}. פתיחה חזקה בשנייה הראשונה, משפטים קצרים, קצב מהיר, סיום עם קריאה לפעולה: "${cta}"`,
  };
}

// On-screen text is a short punch, not the full sentence.
export function captionFrom(line) {
  const words = clean(line).replace(/[—–-]/g, ' ').split(' ').filter(Boolean);
  if (words.length <= 4) return words.join(' ').replace(/[.]+$/, '');
  return words.slice(0, 4).join(' ').replace(/[.,:]+$/, '');
}

export function plan(idea, opts) { return buildPlan(analyze(idea, opts)); }
