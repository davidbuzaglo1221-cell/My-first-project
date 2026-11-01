import type { CoachMessage, Profile } from "./types";

export type CoachTopic = "confidence" | "sleep" | "sales" | "relationship" | "business" | "discipline" | "week" | "general";

export const QUICK_STARTS: { topic: CoachTopic; label: string; prompt: string }[] = [
  { topic: "confidence", label: "לבנות ביטחון עצמי", prompt: "אני רוצה לבנות ביטחון עצמי, במיוחד במצבים חברתיים ומקצועיים." },
  { topic: "sleep", label: "לשפר את שגרת השינה", prompt: "אני רוצה לשפר את שגרת השינה שלי." },
  { topic: "sales", label: "לתרגל מכירות", prompt: "אני רוצה לשפר את יכולת המכירה שלי." },
  { topic: "relationship", label: "לשפר תקשורת זוגית", prompt: "אני רוצה לשפר את התקשורת בזוגיות שלי." },
  { topic: "business", label: "לפתח את העסק", prompt: "אני רוצה לפתח את העסק שלי ולמצוא לקוחות." },
  { topic: "discipline", label: "לבנות משמעת", prompt: "קשה לי לשמור על עקביות ביום יום. אני רוצה לבנות משמעת." },
  { topic: "week", label: "לסקור את השבוע", prompt: "אני רוצה לסקור את השבוע שלי." },
];

interface TopicGuide {
  clarify: string[];
  principle: string;
  caution?: string;
  actions: string[];
}

const GUIDES: Record<CoachTopic, TopicGuide> = {
  confidence: {
    clarify: ["באיזה מצב זה הכי קשה: לדבר בקבוצה, לבקש משהו, או לקבל ביקורת?", "מה בדיוק אתה מפרש כשזה קורה: מה אתה חושב שאנשים רואים?"],
    principle: "ביטחון עצמי נבנה בעיקר מניסיון חוזר ומדיד, לא ממחשבות חיוביות. הדרך היא לעשות את הדבר במנות קטנות ולראות מה קורה בפועל.",
    actions: ["בחר מצב אחד השבוע שבו אתה מבקש או אומר דבר אחד שאתה נמנע ממנו, ורשום מה קרה.", "לפני המצב, כתוב את הפרשנות שלך, ואחרי זה את העובדה. השווה."],
  },
  sleep: {
    clarify: ["באיזו שעה אתה נרדם בפועל, ובאיזו שעה אתה מתעורר?", "מה קורה בשעה האחרונה לפני השינה?"],
    principle: "שעת ההשכמה הקבועה היא העוגן המרכזי לשעון הגוף. שינויים קטנים וקבועים עדיפים על שינוי גדול שלא נשמר.",
    caution: "אם יש נחירות חזקות, הפסקות נשימה, או עייפות קיצונית לאורך זמן, כדאי לפנות לרופא.",
    actions: ["בחר שעת השכמה אחת לשבוע הקרוב, ושמור עליה ברוב הימים, כולל סוף שבוע בטווח של שעה.", "רשום בטופס היומי איך הרגשת בבוקר במשך 7 ימים, ואז בדוק מה השתנה."],
  },
  sales: {
    clarify: ["מה המוצר או השירות, ומה המחיר?", "מה הלקוח אמר שעוצר את המכירה, במילים שלו?"],
    principle: "מכירה טובה מתחילה בהבנת הבעיה של הלקוח. הצעה שנבנית על הצורך שלו קלה יותר לשמוע, ולא דורשת לחץ.",
    actions: ["לפני שאתה מציג הצעה בשיחה הבאה, שאל שתי שאלות על המצב הנוכחי ועל מה שחשוב להם.", "תרגל בסימולטור המכירות סבב אחד, וכתוב מה היה הרגע שבו איבדת את השיחה."],
  },
  relationship: {
    clarify: ["מה בדיוק קרה, כתיאור של מה ראית או שמעת, בלי מסקנה?", "מה אתה מניח לגבי מה שהשני חושב או מרגיש?"],
    principle: "אי אפשר לדעת מה אדם אחר חושב. אפשר לתאר תצפית אחת, לשאול, ולהקשיב לתשובה.",
    actions: ["נסח משפט שמתחיל ב'שמתי לב ש...' ומסתיים בשאלה פתוחה.", "אם יש צורך אישי שלא נענה, נסח אותו כבקשה ולא כטענה: 'אני צריך/ה ... כדי ש...'."],
  },
  business: {
    clarify: ["מי הלקוח שאתה רוצה לעזור לו, ומה הבעיה שהוא כבר מנסה לפתור?", "כמה לקוחות שילמו לך עד היום, ועל איזה דבר?"],
    principle: "לפני השקעה בשיווק, כדאי לבדוק אם יש אנשים שמכירים בבעיה ומוכנים לפעול. ניסוי קטן נותן תשובה מהר יותר מתכנון ארוך.",
    caution: "אם מדובר בהשקעה כספית גדולה או בהחלטה משפטית, כדאי להתייעץ עם איש מקצוע.",
    actions: ["שלח הודעה קצרה ל-10 אנשים מתאימים עם הבעיה ושאלה אחת, וספור תשובות.", "השתמש בכלי 'הצעה' באפליקציה כדי לנסח הצעה לבדיקה."],
  },
  discipline: {
    clarify: ["איזו פעולה אתה רוצה לעשות באופן קבוע, ובאיזה זמן ביום?", "מה קורה בדרך כלל ברגע שאתה מתחיל לדחות?"],
    principle: "משמעת היא בעיקר תכנון של הרגע הקשה. מתכננים מה עושים כשמתעורר רצון לדחות, לא מחכים להרגשה טובה.",
    actions: ["הגדר פעולה של 2 דקות שתעשה בכל יום כשהרצון לדחות עולה.", "רשום במשך 5 ימים מתי דחית, ומה הרגשת באותו רגע."],
  },
  week: {
    clarify: ["מה היה הדבר הכי משמעותי שעשית השבוע?", "איפה הפערים בין מה שתכננת למה שקרה?"],
    principle: "סקירה שבועית שמבוססת על נתונים עדיפה על תחושה כללית. מסתכלים על מה שקרה, מה למדנו, ומה משנים.",
    actions: ["ענה על שלוש השאלות: מה עבד, מה לא עבד, ומה משנים בשבוע הבא.", "בחר דבר אחד לשנות, לא יותר."],
  },
  general: {
    clarify: ["מה המצב הנוכחי במשפט אחד?", "מה היית רוצה שיהיה שונה בעוד חודש, ומה ייחשב הצלחה?"],
    principle: "מטרה כללית קשה לפעול לפיה. עוזר להפוך אותה לשאלה אחת ולצעד אחד.",
    actions: ["כתוב את המטרה במשפט אחד, ואת הצעד הקטן הראשון שלה.", "בדוק את הצעד הזה בתוך 24 שעות."],
  },
};

const TOPIC_WORDS: [CoachTopic, RegExp][] = [
  ["sleep", /(שינה|לישון|ישן|נרדם|התעורר)/],
  ["sales", /(מכיר|לקוח|הצעה|מחיר|סגור)/],
  ["relationship", /(זוגי|בן זוג|בת זוג|חבר|חברה|קשר|דייט)/],
  ["business", /(עסק|שיווק|פרילנס|לקוחות|הכנסה)/],
  ["discipline", /(משמעת|דחיינ|לדחות|עקביות|להתמיד)/],
  ["confidence", /(ביטחון|מתבייש|פחד|חרד|לא מספיק)/],
  ["week", /(שבוע|סיכום|סקירה)/],
];

// Short words need whole-word matching: plain substring would match "דם" inside "להירדם".
const CAUTION_WORDS = /(דיכאון|חרדה קשה|מחשבות על פגיעה|כאב חזק|השקעה גדולה|משכנתא|(^|[\s,.!?])(דם|חוב)($|[\s,.!?]))/;

export function detectTopic(text: string, fallback: CoachTopic = "general"): CoachTopic {
  for (const [topic, re] of TOPIC_WORDS) if (re.test(text)) return topic;
  return fallback;
}

/**
 * Basic coach (no AI). Follows the coaching method in fixed steps:
 * clarify, separate facts from assumptions, explain the principle, suggest two actions, then ask for a commitment.
 * It is honest that it is a rule-based guide, not a live model.
 */
export function basicCoachReply(message: string, topic: CoachTopic, profile: Profile | null, history: CoachMessage[]): string {
  const detected = topic === "general" ? detectTopic(message) : topic;
  const guide = GUIDES[detected];
  const words = message.trim().split(/\s+/).filter(Boolean).length;
  const askedBefore = history.filter((m) => m.role === "coach").length;
  const name = profile?.name ? `${profile.name}, ` : "";

  if (CAUTION_WORDS.test(message)) {
    return `${name}מה שתיארת חשוב, ואני לא יכול להחליף בירור מקצועי. מומלץ לפנות לאיש מקצוע מתאים (רופא, פסיכולוג/ית, או יועץ/ת פיננסי/ת מורשה/ית). אפשר להמשיך כאן לדבר על הצעדים הקטנים שאתה יכול לעשות בינתיים.`;
  }

  if (words < 8 || askedBefore === 0) {
    const q = guide.clarify[Math.min(askedBefore, guide.clarify.length - 1)];
    return `${name}כדי לעזור בצורה מדויקת, שאלה אחת: ${q}\n\n(אפשר לענות בקצרה.)`;
  }

  const factsLine = `מה ששמעתי: ${message.trim().slice(0, 140)}${message.trim().length > 140 ? "..." : ""}`;
  return [
    `${name}תודה, זה מספיק כדי להתחיל.`,
    factsLine,
    `עיקרון רלוונטי: ${guide.principle}`,
    guide.caution ? `שים לב: ${guide.caution}` : null,
    `שני צעדים קטנים שאפשר לנסות:\n1. ${guide.actions[0]}\n2. ${guide.actions[1]}`,
    `איזה צעד תבחר, ומתי תבדוק את זה? אם תרצה, אפשר לסמן אותו כמטרה ולחזור אליו בסקירה השבועית.`,
  ].filter(Boolean).join("\n\n");
}

export interface AiCoachResult {
  ok: true;
  reply: string;
}
export interface AiCoachFailure {
  ok: false;
  reason: "not-configured" | "network" | "server";
  detail?: string;
}

// Access code for the AI endpoint. Kept only in this browser (not in exported data).
const TOKEN_KEY = "ascend:coach-token";
export function getCoachToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}
export function setCoachToken(value: string): void {
  try {
    if (value.trim()) localStorage.setItem(TOKEN_KEY, value.trim());
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable: the code is simply not remembered.
  }
}

// Once the server reports that AI is not configured, stop asking for the rest of this session.
let aiNotConfigured = false;

/** Calls the server-side coach endpoint. Returns a failure object (never throws) so the UI can fall back. */
export async function askAiCoach(message: string, history: CoachMessage[], profile: Profile | null): Promise<AiCoachResult | AiCoachFailure> {
  if (aiNotConfigured) return { ok: false, reason: "not-configured" };
  const recent = history.slice(-12).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
  const context = profile
    ? { goals: profile.goals, timeMode: profile.timeMode, workStatus: profile.workStatus, salesExperience: profile.salesExperience }
    : null;
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(getCoachToken() ? { "x-ascend-token": getCoachToken() } : {}) },
      body: JSON.stringify({ message, history: recent, context }),
    });
    if (res.status === 401) return { ok: false, reason: "server", detail: "קוד הגישה למאמן לא תקין" };
    if (res.status === 404 || res.status === 501 || res.status === 503) {
      aiNotConfigured = true;
      return { ok: false, reason: "not-configured" };
    }
    if (!res.ok) return { ok: false, reason: "server", detail: `קוד ${res.status}` };
    const data = (await res.json()) as { reply?: unknown };
    if (typeof data.reply !== "string" || !data.reply.trim()) return { ok: false, reason: "server", detail: "תשובה ריקה" };
    return { ok: true, reply: data.reply.slice(0, 4000) };
  } catch {
    return { ok: false, reason: "network" };
  }
}
