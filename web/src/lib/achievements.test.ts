import { describe, expect, it } from "vitest";
import { achievements, foodStreak, newlyUnlocked, weeklyStreak, type WorkoutFact } from "./achievements";

const w = (d: string, volumeKg = 1000, records = 0): WorkoutFact => ({ startedAt: `${d}T10:00:00`, volumeKg, records });
const now = new Date("2026-10-28T12:00:00"); // a Wednesday; the week started Sunday 25th

describe("streaks", () => {
  it("counts weeks in a row at the goal, and an unfinished week does not break it", () => {
    const ws = [w("2026-10-12"), w("2026-10-14"), w("2026-10-19"), w("2026-10-21"), w("2026-10-26")];
    expect(weeklyStreak(ws, 2, "sun", now)).toEqual({ weeks: 2, thisWeek: 1 });
    expect(weeklyStreak([...ws, w("2026-10-27")], 2, "sun", now)).toEqual({ weeks: 3, thisWeek: 2 });
    expect(weeklyStreak([w("2026-10-05"), w("2026-10-06"), w("2026-10-26"), w("2026-10-27")], 2, "sun", now).weeks).toBe(1);
  });

  it("food streak ends today, or yesterday while today is empty", () => {
    expect(foodStreak(new Set(["2026-10-26", "2026-10-27", "2026-10-28"]), now)).toBe(3);
    expect(foodStreak(new Set(["2026-10-25", "2026-10-26", "2026-10-27"]), now)).toBe(3);
    expect(foodStreak(new Set(["2026-10-25"]), now)).toBe(0);
  });
});

describe("achievements", () => {
  it("unlocks from real data and shows progress toward the next", () => {
    const a = achievements({ workouts: [w("2026-10-26", 5000, 1)], lifts: [{ slug: "back-squat", heaviestKg: 80 }], bodyweightKg: 80, weekStreak: 1, foodStreak: 0 });
    const by = Object.fromEntries(a.map((x) => [x.id, x]));
    expect(by["first-workout"].unlocked).toBe(true);
    expect(by["first-record"].unlocked).toBe(true);
    expect(by["workouts-10"].progress).toBeCloseTo(0.1);
    expect(by["squat-100"].progress).toBeCloseTo(0.8);
    expect(by["tonnes-10"].progress).toBeCloseTo(0.5);
  });

  it("knows what the latest workout unlocked", () => {
    const before = achievements({ workouts: [], lifts: [], bodyweightKg: 80, weekStreak: 0, foodStreak: 0 });
    const after = achievements({ workouts: [w("2026-10-26", 1000, 0)], lifts: [], bodyweightKg: 80, weekStreak: 0, foodStreak: 0 });
    expect(newlyUnlocked(before, after).map((x) => x.id)).toEqual(["first-workout"]);
  });
});
