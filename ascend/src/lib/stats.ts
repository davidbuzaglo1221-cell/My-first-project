import type { AppState, CheckIn, Habit } from "./types";
import { addDays, lastNDays, todayKey } from "./dates";

/** A day "counts" if the user did anything recorded that day: a planned action, a check-in, a habit, or a review. */
export function isActiveDay(state: AppState, date: string): boolean {
  const d = state.days[date];
  if (!d) return false;
  return d.actions.length > 0 || !!d.checkIn || !!d.review || d.habits.length > 0;
}

/** Consecutive active days ending today. If today has nothing yet, the streak continues from yesterday. */
export function currentStreak(state: AppState, endKey: string = todayKey()): number {
  let cursor = isActiveDay(state, endKey) ? endKey : addDays(endKey, -1);
  let count = 0;
  while (isActiveDay(state, cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function longestStreak(state: AppState): number {
  const dates = Object.keys(state.days).filter((k) => isActiveDay(state, k)).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of dates) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function checkIns(state: AppState, days: number, endKey: string = todayKey()) {
  return lastNDays(days, endKey).map((date) => ({ date, checkIn: state.days[date]?.checkIn as CheckIn | undefined }));
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function checkInAverages(state: AppState, days: number, endKey: string = todayKey()) {
  const items = checkIns(state, days, endKey).map((x) => x.checkIn).filter((c): c is CheckIn => !!c);
  return {
    count: items.length,
    sleepHours: average(items.map((c) => c.sleepHours)),
    energy: average(items.map((c) => c.energy)),
    stress: average(items.map((c) => c.stress)),
    mood: average(items.map((c) => c.mood)),
    exercisedDays: items.filter((c) => c.exercised).length,
    learningMinutes: items.reduce((s, c) => s + c.learningMinutes, 0),
  };
}

/** Share of the window's days on which the habit was completed. Counts only days that have a log entry. */
export function habitRate(state: AppState, habit: Habit, days: number, endKey: string = todayKey()): number {
  const window = lastNDays(days, endKey);
  const done = window.filter((d) => state.days[d]?.habits.includes(habit.id)).length;
  return Math.round((done / days) * 100);
}

export function completedActionsToday(state: AppState, planIds: string[], date: string = todayKey()): number {
  const done = state.days[date]?.actions ?? [];
  return planIds.filter((id) => done.includes(id)).length;
}
