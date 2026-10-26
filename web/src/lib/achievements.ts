// Streaks and achievements, computed from what is already logged. Nothing is stored, nothing
// can be gamed by opening the app: every badge is a real thing you did.

export type WorkoutFact = { startedAt: string; volumeKg: number; records: number };
export type LiftFact = { slug: string; heaviestKg: number };

export type Achievement = {
  id: string;
  title: string;
  detail: string;
  unlocked: boolean;
  /** 0..1 toward unlocking, so the next one is always visible. */
  progress: number;
};

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function weekStartKey(d: Date, weekStartsOn: "sun" | "mon"): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() - (weekStartsOn === "sun" ? 0 : 1) + 7) % 7));
  return dayKey(x);
}

/**
 * Weeks in a row that reached the weekly goal. The current week only counts once it is reached,
 * and never breaks the streak while it is still in progress.
 */
export function weeklyStreak(workouts: WorkoutFact[], goal: number, weekStartsOn: "sun" | "mon", now: Date): { weeks: number; thisWeek: number } {
  const perWeek = new Map<string, number>();
  for (const w of workouts) {
    const k = weekStartKey(new Date(w.startedAt), weekStartsOn);
    perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
  }
  const cursor = new Date(now);
  const thisKey = weekStartKey(cursor, weekStartsOn);
  const thisWeek = perWeek.get(thisKey) ?? 0;
  let weeks = thisWeek >= goal ? 1 : 0;
  for (let i = 1; i < 520; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7 * i);
    if ((perWeek.get(weekStartKey(d, weekStartsOn)) ?? 0) >= goal) weeks++;
    else break;
  }
  return { weeks, thisWeek };
}

/** Days in a row with food logged, ending today (or yesterday, while today is still empty). */
export function foodStreak(loggedDays: Set<string>, now: Date): number {
  const d = new Date(now);
  if (!loggedDays.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (loggedDays.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function achievements(input: {
  workouts: WorkoutFact[];
  lifts: LiftFact[];
  bodyweightKg: number | null;
  weekStreak: number;
  foodStreak: number;
}): Achievement[] {
  const count = input.workouts.length;
  const records = input.workouts.reduce((n, w) => n + w.records, 0);
  const tonnes = input.workouts.reduce((n, w) => n + w.volumeKg, 0) / 1000;
  const heaviest = (slug: string) => input.lifts.find((l) => l.slug === slug)?.heaviestKg ?? 0;
  const bw = input.bodyweightKg;
  const step = (value: number, target: number) => Math.min(1, value / target);

  const list: Omit<Achievement, "unlocked">[] = [
    { id: "first-workout", title: "האימון הראשון", detail: "הצעד הכי קשה", progress: step(count, 1) },
    { id: "workouts-10", title: "10 אימונים", detail: "זה כבר הרגל", progress: step(count, 10) },
    { id: "workouts-50", title: "50 אימונים", detail: "חצי מאה", progress: step(count, 50) },
    { id: "workouts-100", title: "100 אימונים", detail: "מאה אימונים מתועדים", progress: step(count, 100) },
    { id: "first-record", title: "שיא ראשון", detail: "הרמת יותר מאי פעם", progress: step(records, 1) },
    { id: "records-25", title: "25 שיאים", detail: "התקדמות עקבית", progress: step(records, 25) },
    { id: "tonnes-10", title: "10 טון", detail: "נפח מצטבר של 10,000 ק״ג", progress: step(tonnes, 10) },
    { id: "tonnes-100", title: "100 טון", detail: "נפח מצטבר של 100,000 ק״ג", progress: step(tonnes, 100) },
    { id: "streak-4", title: "4 שבועות ברצף", detail: "עמדת ביעד השבועי חודש שלם", progress: step(input.weekStreak, 4) },
    { id: "streak-12", title: "12 שבועות ברצף", detail: "רבעון בלי לוותר", progress: step(input.weekStreak, 12) },
    { id: "food-7", title: "שבוע של רישום", detail: "7 ימים ברצף ביומן התזונה", progress: step(input.foodStreak, 7) },
    { id: "squat-100", title: "סקוואט 100", detail: "100 ק״ג בסקוואט", progress: step(heaviest("back-squat"), 100) },
    { id: "bench-bw", title: "לחיצת חזה במשקל גוף", detail: "המשקל שלך על המוט", progress: bw ? step(heaviest("bench-press"), bw) : 0 },
    { id: "deadlift-2bw", title: "דדליפט כפול משקל גוף", detail: "פי שניים מהמשקל שלך", progress: bw ? step(heaviest("deadlift"), 2 * bw) : 0 },
  ];
  return list.map((a) => ({ ...a, unlocked: a.progress >= 1 }));
}

/** Badges unlocked by the latest workout: present now, absent without it. */
export function newlyUnlocked(before: Achievement[], after: Achievement[]): Achievement[] {
  const had = new Set(before.filter((a) => a.unlocked).map((a) => a.id));
  return after.filter((a) => a.unlocked && !had.has(a.id));
}
