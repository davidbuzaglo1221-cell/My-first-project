import type { CheckIn, Difficulty, Domain, Journey, Mission, MissionSlot } from "@/data/life-types";
import { addDays } from "@/lib/nutrition";
import { BOSSES, DOMAINS, LIBRARY, type MissionTemplate } from "./library";

// The rules of the 90 days, as pure functions: which level a day belongs to, which missions it
// gets, how hard they are, and what the numbers say. The repository stores what these return.

export const JOURNEY_DAYS = 90;
export const LEVEL_DAYS = 15;

export type Level = { n: number; name: string; theme: string; firstDay: number; lastDay: number };

export const LEVELS: Level[] = [
  { n: 1, name: "יסודות", theme: "שינה, אימון ורישום. לבנות בסיס שמחזיק.", firstDay: 1, lastDay: 15 },
  { n: 2, name: "משמעת", theme: "לעמוד במילה שלך גם בלי מוטיבציה.", firstDay: 16, lastDay: 30 },
  { n: 3, name: "אומץ", theme: "ללכת לכיוון הפחד, בצעדים מחושבים.", firstDay: 31, lastDay: 45 },
  { n: 4, name: "נוכחות", theme: "קול, עיניים, סיפור. להיות מישהו שרואים.", firstDay: 46, lastDay: 60 },
  { n: 5, name: "שליטה", theme: "כסף, מחיר ורגש. לבחור את התגובה.", firstDay: 61, lastDay: 75 },
  { n: 6, name: "האיש שבחרת", theme: "לחבר הכול ולהחליט על הפרק הבא.", firstDay: 76, lastDay: 90 },
];

/** Whole days from a to b (date keys). */
export function daysBetween(a: string, b: string): number {
  const t = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** Day 1 is the start date. Before it, 0. */
export function dayNumber(startDate: string, date: string): number {
  return daysBetween(startDate, date) + 1;
}

export function levelOf(day: number): Level {
  const i = Math.min(LEVELS.length - 1, Math.max(0, Math.floor((day - 1) / LEVEL_DAYS)));
  return LEVELS[i];
}

export const isBossDay = (day: number) => day >= 1 && day <= JOURNEY_DAYS && day % LEVEL_DAYS === 0;

/** A small stable hash, so a date always picks the same missions. */
export function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Which area leads each day of the week (Sunday first), before focus and weak spots bend it. */
const WEEK: Domain[] = ["discipline", "sales", "fitness", "charisma", "business", "courage", "mind"];

/** Completion rate of the main missions in the last `n` days before `date` (null with no data). */
export function completionRate(missions: Mission[], date: string, n = 7, slot: MissionSlot | null = "main"): number | null {
  const from = addDays(date, -n);
  const past = missions.filter((m) => m.date >= from && m.date < date && (slot == null || m.slot === slot));
  if (!past.length) return null;
  return past.filter((m) => m.status === "done").length / past.length;
}

/** Target difficulty: the level sets the base, the last week and the coach's call move it. */
export function targetDifficulty(day: number, missions: Mission[], date: string, bias: -1 | 0 | 1): Difficulty {
  const base = day <= 30 ? 1 : day <= 60 ? 2 : 3;
  const rate = completionRate(missions, date);
  const adapt = rate == null ? 0 : rate < 0.5 ? -1 : rate >= 0.85 ? 1 : 0;
  return Math.min(3, Math.max(1, base + adapt + bias)) as Difficulty;
}

/** The area with the fewest completed missions in the last two weeks (ties broken by the date). */
export function weakestDomain(missions: Mission[], date: string, exclude: Domain[]): Domain {
  const from = addDays(date, -14);
  const done = new Map<Domain, number>(DOMAINS.map((d) => [d, 0]));
  for (const m of missions) if (m.date >= from && m.date < date && m.status === "done") done.set(m.domain, (done.get(m.domain) ?? 0) + 1);
  const candidates = DOMAINS.filter((d) => !exclude.includes(d));
  const min = Math.min(...candidates.map((d) => done.get(d)!));
  const lowest = candidates.filter((d) => done.get(d) === min);
  return lowest[seed(date + "weak") % lowest.length];
}

/** The lead area for a date: the weekday's, swapped for a focus area every other day. */
export function leadDomain(date: string, focus: Domain[]): Domain {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const base = WEEK[weekday];
  if (focus.length && seed(date) % 2 === 0) return focus[seed(date + "f") % focus.length];
  return base;
}

function pick(domain: Domain, difficulty: Difficulty, date: string, salt: string, recent: Set<string>, taken: Set<string>): MissionTemplate {
  const pool = LIBRARY.filter((t) => t.domain === domain && !taken.has(t.id));
  // Closest difficulty first, then the ones not given in the last month.
  const ranked = [...pool].sort((a, b) => Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty));
  const best = Math.abs(ranked[0].difficulty - difficulty);
  const close = ranked.filter((t) => Math.abs(t.difficulty - difficulty) <= best + (recent.size ? 1 : 0));
  const fresh = close.filter((t) => !recent.has(t.id));
  const list = fresh.length ? fresh : close;
  return list[seed(date + salt) % list.length];
}

export const XP = { main: [0, 30, 50, 80], side: [0, 10, 15, 20], boss: 150 } as const;

function toMission(t: MissionTemplate, date: string, slot: MissionSlot, boss = false, difficulty?: Difficulty): Mission {
  const d = difficulty ?? t.difficulty;
  return {
    id: `${date}:${slot}`,
    date,
    slot,
    templateId: t.id,
    domain: t.domain,
    title: t.title,
    objective: t.objective,
    why: t.why,
    steps: t.steps,
    kind: t.kind,
    target: t.target,
    difficulty: d,
    boss,
    source: "library",
    prompt: t.prompt,
    status: "open",
    progress: 0,
    reflection: null,
    completedAt: null,
    xp: boss ? XP.boss : slot === "main" ? XP.main[d] : XP.side[d],
  };
}

/** The three missions of one day: the main one (or the level's test) and two short side missions. */
export function planDay(journey: Pick<Journey, "startDate" | "focus" | "difficultyBias">, date: string, history: Mission[]): Mission[] {
  const day = Math.max(1, dayNumber(journey.startDate, date));
  const recent = new Set(history.filter((m) => m.date >= addDays(date, -30) && m.date < date).map((m) => m.templateId));
  const taken = new Set<string>();
  const out: Mission[] = [];

  if (isBossDay(day)) {
    out.push(toMission(BOSSES[day / LEVEL_DAYS - 1], date, "main", true));
  } else {
    const lead = leadDomain(date, journey.focus);
    const t = pick(lead, targetDifficulty(day, history, date, journey.difficultyBias), date, "main", recent, taken);
    taken.add(t.id);
    out.push(toMission(t, date, "main"));
  }
  const used = [out[0].domain];
  const weak = weakestDomain(history, date, used);
  const side1 = pick(weak, 1, date, "s1", recent, taken);
  taken.add(side1.id);
  used.push(weak);
  out.push(toMission(side1, date, "side1", false, 1));
  const others = DOMAINS.filter((d) => !used.includes(d));
  const third = others[seed(date + "s2") % others.length];
  out.push(toMission(pick(third, 1, date, "s2", recent, taken), date, "side2", false, 1));
  return out;
}

/** Days in a row (up to and including today) with the main mission done. Today still open keeps the run. */
export function streak(missions: Mission[], today: string): number {
  const doneDays = new Set(missions.filter((m) => m.slot === "main" && m.status === "done").map((m) => m.date));
  let d = doneDays.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (doneDays.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(missions: Mission[]): number {
  const days = [...new Set(missions.filter((m) => m.slot === "main" && m.status === "done").map((m) => m.date))].sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export const totalXp = (missions: Mission[]) => missions.reduce((s, m) => s + (m.status === "done" ? m.xp : 0), 0);

/** Rank from points: a quiet title for how much has actually been done. */
export const RANKS = [
  { min: 0, name: "מתחיל" },
  { min: 300, name: "מגויס" },
  { min: 900, name: "לוחם" },
  { min: 1800, name: "לוחם ותיק" },
  { min: 3000, name: "מפקד" },
  { min: 4500, name: "אגדה" },
];

export function rankOf(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].min) i++;
  const next = RANKS[i + 1];
  return { name: RANKS[i].name, next: next?.name ?? null, progress: next ? (xp - RANKS[i].min) / (next.min - RANKS[i].min) : 1, toNext: next ? next.min - xp : 0 };
}

/**
 * Performance over the last seven days, 0..100: main missions done (45), side missions (15),
 * check-ins (15), seven hours of sleep or more (15), training on at least three days (10).
 */
export function performance(missions: Mission[], checkins: CheckIn[], today: string): { score: number; parts: { label: string; value: number; max: number }[] } {
  const from = addDays(today, -6);
  const inWeek = (d: string) => d >= from && d <= today;
  const ms = missions.filter((m) => inWeek(m.date));
  const mains = ms.filter((m) => m.slot === "main");
  const sides = ms.filter((m) => m.slot !== "main");
  const cs = checkins.filter((c) => inWeek(c.date));
  const slept = cs.filter((c) => (c.sleepHours ?? 0) >= 7).length;
  const trained = cs.filter((c) => c.trained).length;
  const ratio = (a: number, b: number) => (b ? a / b : 0);
  const parts = [
    { label: "משימות ראשיות", value: Math.round(45 * ratio(mains.filter((m) => m.status === "done").length, Math.max(1, mains.length))), max: 45 },
    { label: "משימות צד", value: Math.round(15 * ratio(sides.filter((m) => m.status === "done").length, Math.max(1, sides.length))), max: 15 },
    { label: "צ'ק-אין", value: Math.round(15 * Math.min(1, cs.length / 7)), max: 15 },
    { label: "שינה", value: Math.round(15 * Math.min(1, slept / 7)), max: 15 },
    { label: "אימונים", value: Math.round(10 * Math.min(1, trained / 3)), max: 10 },
  ];
  return { score: parts.reduce((s, p) => s + p.value, 0), parts };
}

/** Milliseconds until the end of the local day. */
export function msLeftToday(now: Date): number {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return Math.max(0, end.getTime() - now.getTime());
}
