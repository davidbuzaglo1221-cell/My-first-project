import { z } from "zod";
import type { CheckIn, CoachAnswer, Cut, Domain, Journey, Mission, SalesReview, Turn, WeeklyReport } from "@/data/life-types";
import { getAppToken } from "@/lib/local-settings";
import { addDays } from "@/lib/nutrition";
import { cap, IS_ARTIFACT, type SampleError } from "@/lib/runtime";
import { completionRate, dayNumber, levelOf, performance, streak } from "./engine";
import { DOMAIN_LABEL, DOMAINS } from "./library";
import { summarize } from "./business";
import type { Scenario } from "./sales";
import { COACH_SYSTEM } from "./coach-prompt";

export { COACH_SYSTEM };

// The coach: Claude, given the person's own profile and the last weeks of data. In the chat
// build it runs on the viewer's own Claude account (no key); on a server, through /api/coach.



export type CoachError = "not_allowed" | "busy" | "refused" | "unreadable" | "network" | "upstream" | "not_configured";

export const COACH_ERROR_TEXT: Record<CoachError, string> = {
  not_allowed: "למאמן אין גישה כרגע. אפשר לאשר אותה בחלון של Claude.",
  busy: "המאמן עמוס כרגע. נסה שוב בעוד דקה.",
  refused: "המאמן לא יכול לענות על זה.",
  unreadable: "התשובה לא הגיעה בצורה תקינה. נסה שוב.",
  network: "אין חיבור. נסה שוב כשיש רשת.",
  upstream: "משהו השתבש בדרך. נסה שוב.",
  not_configured: "המאמן לא מוגדר בשרת הזה (צריך ANTHROPIC_API_KEY).",
};

export type CoachResult<T> = { ok: true; data: T } | { ok: false; error: CoachError };

function sampleError(e: unknown): CoachError {
  switch ((e as SampleError)?.code) {
    case "not_granted":
    case "sampling_disabled":
    case "not_declared":
      return "not_allowed";
    case "rate_limited":
      return "busy";
    case "refused":
      return "refused";
    case "invalid_json":
    case "empty_completion":
      return "unreadable";
    default:
      return "upstream";
  }
}

/** One structured request to Claude, wherever the app runs. */
async function ask<T>(prompt: string, schema: z.ZodType<T>, tier: "quick" | "default" | "complex" = "default"): Promise<CoachResult<T>> {
  let raw: unknown;
  if (IS_ARTIFACT) {
    const sample = await cap("sample");
    if (!sample) return { ok: false, error: "not_allowed" };
    try {
      raw = await sample.json(`${COACH_SYSTEM}\n\n${prompt}`, { modelTier: tier, effort: tier === "quick" ? "low" : "medium" });
    } catch (e) {
      return { ok: false, error: sampleError(e) };
    }
  } else {
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json", "x-app-token": getAppToken() },
        body: JSON.stringify({ prompt, tier }),
      });
      const body = (await res.json()) as { ok: boolean; data?: unknown; error?: CoachError };
      if (!body.ok) return { ok: false, error: body.error ?? "upstream" };
      raw = body.data;
    } catch {
      return { ok: false, error: "network" };
    }
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: "unreadable" };
}

export type CoachContext = { journey: Journey; missions: Mission[]; checkins: CheckIn[]; cuts: Cut[]; workoutsLast14: number; today: string };

/** What the coach knows: the profile in the person's words, and the numbers of the last two weeks. */
export function contextText({ journey, missions, checkins, cuts, workoutsLast14, today }: CoachContext): string {
  const day = dayNumber(journey.startDate, today);
  const from = addDays(today, -13);
  const recent = missions.filter((m) => m.date >= from && m.date <= today);
  const perDomain = DOMAINS.map((d) => {
    const ms = recent.filter((m) => m.domain === d);
    return ms.length ? `${DOMAIN_LABEL[d]} ${ms.filter((m) => m.status === "done").length}/${ms.length}` : null;
  }).filter(Boolean);
  const skipped = recent.filter((m) => m.status === "skipped").map((m) => `"${m.title}"${m.reflection ? ` (סיבה: ${m.reflection})` : ""}`);
  const reflections = recent.filter((m) => m.status === "done" && m.reflection).slice(-8).map((m) => `- ${m.title}: ${m.reflection}`);
  const cs = checkins.filter((c) => c.date >= from);
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "אין נתון";
  };
  const biz = summarize(cuts.filter((c) => c.date >= from));
  const perf = performance(missions, checkins, today);
  return `## הפרופיל שלו, במילים שלו
${journey.about.trim() || "(לא מילא פרופיל)"}

## המסע
יום ${Math.max(1, day)} מתוך 90, שלב ${levelOf(Math.max(1, day)).n}: ${levelOf(Math.max(1, day)).name}.
רצף נוכחי: ${streak(missions, today)} ימים. ציון ביצוע 7 ימים: ${perf.score}/100.
ביצוע משימות ראשיות ב-7 ימים: ${Math.round((completionRate(missions, today) ?? 0) * 100)}%.
תחומי מיקוד שבחר: ${journey.focus.map((d) => DOMAIN_LABEL[d]).join(", ") || "לא בחר"}.

## 14 הימים האחרונים
משימות שבוצעו לפי תחום: ${perDomain.join(" · ") || "אין עדיין"}.
דילג על: ${skipped.join("; ") || "כלום"}.
מה כתב אחרי משימות:
${reflections.join("\n") || "(אין)"}
צ'ק-אין: ${cs.length} ימים. שינה ממוצעת ${avg(cs.map((c) => c.sleepHours))} שעות, אנרגיה ${avg(cs.map((c) => c.energy))}/5, מסך ${avg(cs.map((c) => c.screenHours))} שעות ביום, ימי אימון לפי הצ'ק-אין ${cs.filter((c) => c.trained).length}.
אימוני כוח שנרשמו: ${workoutsLast14}.
עסק (ספרות): ${biz.cuts} תספורות, הכנסה ${Math.round(biz.income)} ₪, מחיר ממוצע ${Math.round(biz.avgPrice)} ₪, ${biz.newClients} לקוחות חדשים, ${Math.round(biz.rebookShare * 100)}% קבעו תור הבא.
חסכונות: ${journey.savings ?? "לא הזין"} ₪. הוצאות חודשיות: ${journey.monthly.rent + journey.monthly.bills + journey.monthly.food + journey.monthly.other} ₪.`;
}

const Report = z.object({
  headline: z.string(),
  wins: z.array(z.string()).max(5),
  gaps: z.array(z.string()).max(5),
  pattern: z.string(),
  priorities: z.array(z.string()).min(1).max(3),
  difficulty: z.enum(["down", "same", "up"]),
});

export function weeklyReport(ctx: CoachContext): Promise<CoachResult<WeeklyReport>> {
  return ask(
    `${contextText(ctx)}

כתוב לו סיכום שבועי. כנה, מבוסס על המספרים למעלה בלבד. אל תמציא נתונים שאין.
- headline: משפט אחד שמסכם את השבוע, חד.
- wins: עד 3 דברים שבאמת התקדמו, עם מספר כשיש.
- gaps: עד 3 מקומות שבהם הוא התחמק או נפל, ישיר.
- pattern: דפוס אחד שאתה מזהה (במשפט או שניים). אם אין מספיק נתונים, תגיד את זה.
- priorities: שלוש עדיפויות לשבוע הבא, כל אחת פעולה ספציפית ומדידה.
- difficulty: "up" אם המשימות קלות לו מדי (מעל 85% ביצוע), "down" אם הוא נשבר (מתחת ל-50%), אחרת "same".

Reply with only this JSON:
{"headline": "...", "wins": ["..."], "gaps": ["..."], "pattern": "...", "priorities": ["...", "...", "..."], "difficulty": "same"}`,
    Report,
    "complex",
  );
}

const Answer = z.object({ answer: z.string(), actions: z.array(z.string()).max(4) });

export function askCoach(ctx: CoachContext, question: string): Promise<CoachResult<CoachAnswer>> {
  return ask(
    `${contextText(ctx)}

השאלה שלו: ${question.trim()}

ענה ישירות, עד 180 מילים, מותאם למה שאתה יודע עליו. אם השאלה בתחום בריאות או הורמונים, הבחן בין מה שמבוסס היטב לבין מה שלא, ואל תמציא מקורות.
סיים בעד 3 פעולות קונקרטיות.

Reply with only this JSON:
{"answer": "...", "actions": ["..."]}`,
    Answer,
    "default",
  );
}

const Personal = z.object({
  domain: z.enum(DOMAINS as [Domain, ...Domain[]]),
  title: z.string().max(40),
  objective: z.string(),
  why: z.string(),
  steps: z.array(z.string()).min(2).max(5),
  kind: z.enum(["check", "timer", "count"]),
  target: z.number().int().min(1).max(10000),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  prompt: z.string(),
});
export type PersonalMission = z.infer<typeof Personal>;

export function personalMission(ctx: CoachContext): Promise<CoachResult<PersonalMission>> {
  return ask(
    `${contextText(ctx)}

כתוב לו משימה אחת להיום, שמכוונת בדיוק לפער הכי גדול שאתה רואה בנתונים ובפרופיל. משהו שעושים בעולם האמיתי היום, עם קו סיום ברור, קשה אבל אפשרי.
- kind: "timer" (target = דקות), "count" (target = כמה פעמים), או "check" (target = 1).
- why: למה דווקא המשימה הזאת ודווקא לו, משפט או שניים. בלי להמציא מחקרים.
- prompt: שאלה אחת שהוא יענה עליה כשיסיים.

Reply with only this JSON:
{"domain": "courage", "title": "...", "objective": "...", "why": "...", "steps": ["...", "..."], "kind": "count", "target": 3, "difficulty": 2, "prompt": "..."}`,
    Personal,
    "default",
  );
}

const Reply = z.object({ reply: z.string(), done: z.boolean() });

/** The client's next line. `done` once the conversation reached a natural end (a yes, a no, a booking). */
export function salesTurn(s: Scenario, turns: Turn[]): Promise<CoachResult<{ reply: string; done: boolean }>> {
  const transcript = turns.map((t) => `${t.role === "client" ? "לקוח" : "ספר"}: ${t.text}`).join("\n");
  return ask(
    `זה תרגול מכירה. אתה משחק את הלקוח, לא את המאמן. הספר הוא המשתמש.
מי אתה: ${s.persona}

השיחה עד עכשיו:
${transcript}

כתוב את המשפט הבא של הלקוח בלבד: קצר, טבעי, בעברית מדוברת. תגיב בדיוק לפי איך שהספר דיבר, לפי ההתנהגות שתוארה. אל תקל עליו ואל תעזור לו.
done=true רק כשהשיחה הגיעה לסוף טבעי (הסכים, סירב סופית, קבע או הלך). אחרי 10 תורות של הספר, סיים.

Reply with only this JSON:
{"reply": "...", "done": false}`,
    Reply,
    "quick",
  );
}

const Review = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).max(4),
  fixes: z.array(z.string()).max(4),
  betterLine: z.string(),
});

export function salesReview(s: Scenario, turns: Turn[]): Promise<CoachResult<SalesReview>> {
  const transcript = turns.map((t) => `${t.role === "client" ? "לקוח" : "ספר"}: ${t.text}`).join("\n");
  return ask(
    `נתח את שיחת המכירה הזאת כמאמן מכירות קשוח והוגן.
התרחיש: ${s.title}. המטרה: ${s.goal}
מה שהלקוח לא אמר בגלוי: ${s.persona}

השיחה:
${transcript}

הערך לפי: שאלות לפני המלצה (מצב, בעיה, השלכה, צורך), הקשבה וחזרה על מה שהלקוח אמר, ביטחון במחיר, טיפול בהתנגדות, סגירה או צעד הבא ברור, וטון.
- score: 0–100, מחמיר. 85 ומעלה רק לשיחה שהייתה עובדת גם במציאות.
- strengths: מה עבד, עם ציטוט קצר מהשיחה.
- fixes: מה לתקן, ספציפי.
- betterLine: משפט אחד שהיה עדיף שהספר יגיד ברגע המפתח, מוכן לשימוש.

Reply with only this JSON:
{"score": 0, "summary": "...", "strengths": ["..."], "fixes": ["..."], "betterLine": "..."}`,
    Review,
    "default",
  );
}
