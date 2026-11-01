import type { Objection, ObjectionKind, SalesScenario } from "../content/sales";
import { OBJECTION_COUNT } from "../content/sales";

export type Difficulty = "easy" | "medium" | "hard";
export type Dimension = "discovery" | "listening" | "clarity" | "value" | "objections" | "ethics" | "nextStep";

export const DIMENSION_LABEL: Record<Dimension, string> = {
  discovery: "שאלות גילוי",
  listening: "הקשבה וסיכום",
  clarity: "בהירות",
  value: "הצגת ערך",
  objections: "טיפול בהתנגדויות",
  ethics: "אתיקה ולחץ",
  nextStep: "צעד הבא מוסכם",
};

export const DIMENSION_TIP: Record<Dimension, string> = {
  discovery: "שאל לפני שאתה מציע. שאלה אחת על המצב, אחת על מה שחשוב, ואחת על מה שקרה עד היום.",
  listening: "חזור במילים שלך על מה ששמעת ובקש אישור. זה מונע הנחות.",
  clarity: "משפט אחד או שניים עם מטרה אחת. אם צריך משפט ארוך, כדאי לחלק אותו.",
  value: "קשור את ההצעה למה שהלקוח אמר: זמן, כסף, לחץ או תוצאה שהוא כבר מחפש.",
  objections: "לפני תשובה, שאל מה עומד מאחורי ההתנגדות. מחיר הוא לעיתים מילה במקום חשש אחר.",
  ethics: "בלי דחיפות מלאכותית ובלי הפחדה. לקוח שמחליט בלחץ לא יישאר מרוצה.",
  nextStep: "סיים כל סבב בצעד ברור ומוסכם: שיחה, שליחה, או החלטה עד תאריך מסוים.",
};

const QUESTION_WORDS = /(^|\s)(מה|איך|למה|מתי|כמה|מי|האם|איזה|איזו)(\s|$)/;
const LISTENING = /(אם הבנתי|כלומר|נשמע ש|בעצם|אם אני מבין|אז ככה|אם אני מבינה|אם הבנתי נכון)/;
const VALUE = /(תוצאה|חוסך|להרוויח|להגדיל|מטרה|יעד|בשבילך|הכאב|שעות|הזמן שלך|ערך|החזר|יציבות)/;
const NEXT_STEP = /(הצעד הבא|נקבע|נשלח|נתחיל|שיחה|פגישה|מתאים לך|נמשיך|אם תרצה|נבדוק|מתאים לך|נחזיר)/;
const PRESSURE = /(היום האחרון|רק עכשיו|אחרונה|אין ברירה|כולם כבר|המחיר יעלה|תחליט עכשיו|אתה טועה|בטח לא|מפסיד|תפסיד)/;
const DISCOUNT_EARLY = /(הנחה|נוריד|בוא נוריד|אוריד לך|אני יכול להוריד)/;

const HANDLERS: Record<ObjectionKind, RegExp> = {
  price: /(ערך|השקעה|החזר|תוצאה|השוואה|מה חשוב|תקציב|חלוקה|שלבים|כדאי|מסלול|זמן)/,
  think: /(מה בדיוק|מה חשוב|על מה אתה|על מה את|מה צריך להיות|מה מעסיק|מה הדבר)/,
  trust: /(דוגמ|המלצה|לקוחות|ניסיון|ניסוי|לבדוק|התחייבות|הבטחה|לא הבטחה|לעצור)/,
  timing: /(מתי|מה נוח|נוח לך|שבוע|תאריך|מסלול|כניסה|בשבוע הבא)/,
  need: /(מה הבעיה|מה התוצאה|מה חשוב|מה המצב|מה קורה|אם הבנתי נכון)/,
  competitor: /(מה מדויק|במה|מה ההבדל|מה שחשוב לך|מה מבדיל)/,
};

export interface TurnEvaluation {
  flags: Record<Dimension, boolean>;
  weaknesses: string[];
  weak: boolean;
  discountEarly: boolean;
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function evaluateReply(text: string, objection: Objection | undefined, isFinal: boolean, previousReply?: string): TurnEvaluation {
  const t = text.trim();
  const repeated = !!previousReply && normalize(previousReply) === normalize(t);
  const words = countWords(t);
  const hasQuestion = t.includes("?") || QUESTION_WORDS.test(t);
  const discountEarly = !!objection && objection.kind === "price" && DISCOUNT_EARLY.test(t) && !LISTENING.test(t) && !hasQuestion;
  // A repeated reply does not answer the new message, even if it contains the right keywords.
  const handled = (objection ? HANDLERS[objection.kind].test(t) && !discountEarly : true) && !repeated;
  const ethicsOk = !PRESSURE.test(t);
  const clarity = words >= 5 && words <= 70;
  const flags: Record<Dimension, boolean> = {
    discovery: hasQuestion,
    listening: LISTENING.test(t) && !repeated,
    clarity,
    value: VALUE.test(t),
    objections: handled,
    ethics: ethicsOk,
    nextStep: NEXT_STEP.test(t),
  };

  const weaknesses: string[] = [];
  if (repeated) weaknesses.push("זו אותה תשובה כמו בשלב הקודם. כל שלב דורש תגובה שמתייחסת למה שהלקוח אמר עכשיו.");
  if (objection && !handled) {
    weaknesses.push(discountEarly
      ? "הצעת הנחה לפני שהבנת את הערך עבור הלקוח. זה מלמד אותו שהמחיר גמיש, ולא מסביר למה כדאי."
      : "לא נגעת בהתנגדות עצמה. לפני הצעה חדשה, שאל מה עומד מאחוריה.");
  }
  if (!ethicsOk) weaknesses.push("הנוסח מפעיל לחץ באמצעות דחיפות מלאכותית או הפחדה. החלטה טובה דורשת מידע, לא לחץ.");
  if (!clarity) weaknesses.push(words < 5 ? "התשובה קצרה מדי כדי להיות ברורה ללקוח." : "התשובה ארוכה מדי. רוב הלקוחות מאבדים את הקשב אחרי משפט או שניים.");
  if (isFinal && !flags.nextStep) weaknesses.push("לא הצעת צעד הבא מוסכם. בסוף שיחה, הלקוח צריך לדעת מה קורה עכשיו.");

  const weak = !flags.objections || !flags.ethics || !flags.clarity || (isFinal && !flags.nextStep);
  return { flags, weaknesses, weak, discountEarly };
}

/** Picks the objections for a difficulty level, keeping the scenario's order. */
export function objectionsFor(scenario: SalesScenario, difficulty: Difficulty): Objection[] {
  const count = OBJECTION_COUNT[difficulty];
  if (difficulty === "easy") return scenario.objections.filter((o) => !o.hard).slice(0, count);
  return scenario.objections.slice(0, count);
}

export interface SalesReport {
  scores: Record<Dimension, number>;
  overall: number;
  strongest: Dimension;
  weakest: Dimension;
  turns: { objection?: Objection; reply: string; evaluation: TurnEvaluation }[];
  tips: string[];
}

export function buildReport(turns: { objection?: Objection; reply: string; evaluation: TurnEvaluation }[]): SalesReport {
  const dims = Object.keys(DIMENSION_LABEL) as Dimension[];
  const n = Math.max(1, turns.length);
  const scores = {} as Record<Dimension, number>;
  for (const d of dims) {
    // Discovery, value and listening are expected at least once across the conversation. Others are per turn.
    const hits = turns.filter((x) => x.evaluation.flags[d]).length;
    const ratio = hits / n;
    scores[d] = Math.round(1 + 4 * ratio);
  }
  const sorted = [...dims].sort((a, b) => scores[b] - scores[a]);
  const overall = Math.round((dims.reduce((s, d) => s + scores[d], 0) / dims.length) * 10) / 10;
  const weakest = sorted[sorted.length - 1];
  const strongest = sorted[0];
  const tips = dims.filter((d) => scores[d] <= 3).map((d) => `${DIMENSION_LABEL[d]}: ${DIMENSION_TIP[d]}`);
  return { scores, overall, strongest, weakest, turns, tips };
}
