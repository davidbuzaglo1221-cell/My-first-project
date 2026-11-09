import type { CheckIn, Cut, Mission, SalesSession } from "@/data/life-types";
import { bestStreak, totalXp } from "./engine";

// Marks of the journey. Each is earned by something that happened in the real world and is
// counted from the stored rows, never granted by tapping.

export type JourneyBadge = {
  id: string;
  title: string;
  body: string;
  /** 0..1 */
  progress: number;
  unlocked: boolean;
  /** What is counted, e.g. "4 / 7". */
  detail: string;
};

type Input = { missions: Mission[]; checkins: CheckIn[]; cuts: Cut[]; sales: SalesSession[] };

const badge = (id: string, title: string, body: string, have: number, need: number): JourneyBadge => ({
  id,
  title,
  body,
  progress: Math.min(1, have / need),
  unlocked: have >= need,
  detail: `${Math.min(have, need).toLocaleString("he-IL")} / ${need.toLocaleString("he-IL")}`,
});

export function journeyBadges({ missions, checkins, cuts, sales }: Input): JourneyBadge[] {
  const done = missions.filter((m) => m.status === "done");
  const byDomain = (d: Mission["domain"]) => done.filter((m) => m.domain === d).length;
  const bosses = done.filter((m) => m.boss).length;
  const months = new Map<string, number>();
  for (const c of cuts) months.set(c.date.slice(0, 7), (months.get(c.date.slice(0, 7)) ?? 0) + c.price + c.tip);
  const bestMonth = Math.max(0, ...months.values());
  const reviewed = sales.filter((s) => s.review);
  const bestSales = Math.max(0, ...reviewed.map((s) => s.review!.score));
  const rebooked = cuts.filter((c) => c.rebooked).length;
  const domains = new Set(done.map((m) => m.domain)).size;
  const best = bestStreak(missions);

  return [
    badge("first", "הצעד הראשון", "משימה ראשונה בוצעה עד הסוף", done.length, 1),
    badge("week", "שבוע ברצף", "7 ימים ברצף עם המשימה הראשית", best, 7),
    badge("month", "חודש של מילה", "30 ימים ברצף", best, 30),
    badge("boss1", "עבר את המבחן", "מבחן דרגה ראשון הושלם", bosses, 1),
    badge("boss6", "כל המבחנים", "ששת מבחני הדרגה", bosses, 6),
    badge("all", "רוחב", "משימה שבוצעה בכל אחד מתשעת התחומים", domains, 9),
    badge("brave", "לב של לוחם", "10 משימות אומץ", byDomain("courage"), 10),
    badge("presence", "נוכחות", "10 משימות כריזמה", byDomain("charisma"), 10),
    badge("checkins", "יומן אמת", "30 צ'ק-אינים", checkins.length, 30),
    badge("chair", "הכיסא מתמלא", "50 תספורות ברישום", cuts.length, 50),
    badge("rebook", "לקוחות שחוזרים", "25 לקוחות שקבעו תור לפני שיצאו", rebooked, 25),
    badge("month5k", "חודש של 5,000", "חודש עם 5,000 ₪ הכנסה מהכיסא", Math.round(bestMonth), 5000),
    badge("sales10", "איש מכירות", "10 סימולציות מכירה עם משוב", reviewed.length, 10),
    badge("closer", "סוגר", "ציון 85 ומעלה בסימולציה", bestSales >= 85 ? 1 : 0, 1),
    badge("xp", "אלף וחמש מאות", "1,500 נקודות", totalXp(missions), 1500),
  ];
}
