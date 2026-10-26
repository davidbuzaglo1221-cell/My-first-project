import { describe, expect, it } from "vitest";
import { computeStrength, explainChange, levelFor, type ScoredSet } from "./strength";

const day = (d: string) => `2026-10-${d}T10:00:00.000Z`;
const set = (slug: string, name: string, w: number, r: number, d: string, kind = "work"): ScoredSet => ({
  slug,
  exerciseName: name,
  weightKg: w,
  reps: r,
  kind,
  completedAt: day(d),
});
const kg = (n: number) => `${n} ק"ג`;

describe("strength score", () => {
  it("an intermediate squat at 80 kg bodyweight scores 300", () => {
    // standard 1.5 × 80 = 120 kg e1RM; 100 × 6 → e1RM 120
    const r = computeStrength([set("back-squat", "סקוואט", 100, 6, "20")], { bodyweightKg: 80, sex: "male", asOf: new Date(day("26")) })!;
    expect(r.groups.legs!.score).toBe(300);
    expect(r.total).toBe(300);
    expect(r.level).toBe("intermediate");
  });

  it("ignores warmups, sets outside 6 weeks, unknown and reps-only lifts", () => {
    const r = computeStrength(
      [
        set("back-squat", "סקוואט", 200, 5, "20", "warmup"),
        { ...set("back-squat", "סקוואט", 200, 5, "01"), completedAt: "2026-08-01T10:00:00.000Z" },
        set("custom", "משהו", 300, 5, "20"),
      ],
      { bodyweightKg: 80, sex: "male", asOf: new Date(day("26")) },
    );
    expect(r).toBeNull();
  });

  it("weights groups and skips the ones with no data", () => {
    const r = computeStrength(
      [set("back-squat", "סקוואט", 100, 6, "20"), set("bench-press", "לחיצת חזה", 92, 1, "21")],
      { bodyweightKg: 80, sex: "male", asOf: new Date(day("26")) },
    )!;
    expect(r.groups.chest!.score).toBe(300); // 92 / 80 = 1.15
    expect(r.total).toBe(300);
    expect(r.groups.back).toBeUndefined();
  });

  it("uses lower standards for women", () => {
    const r = computeStrength([set("bench-press", "לחיצת חזה", 60, 1, "21")], { bodyweightKg: 60, sex: "female", asOf: new Date(day("26")) })!;
    expect(r.groups.chest!.score).toBe(Math.round((1 / (1.15 * 0.65)) * 300));
  });

  it("needs a bodyweight", () => {
    expect(computeStrength([set("back-squat", "סקוואט", 100, 6, "20")], { bodyweightKg: 0, sex: "male", asOf: new Date(day("26")) })).toBeNull();
  });

  it("explains a weekly change by the lift that moved it and by bodyweight", () => {
    const opts = { bodyweightKg: 80, sex: "male" as const };
    const before = computeStrength([set("back-squat", "סקוואט", 100, 6, "15")], { ...opts, asOf: new Date(day("19")) });
    const now = computeStrength([set("back-squat", "סקוואט", 100, 6, "15"), set("back-squat", "סקוואט", 110, 5, "24")], { ...opts, asOf: new Date(day("26")) })!;
    const c = explainChange(now, before, { now: 80, before: 81 }, kg);
    expect(c.delta).toBeGreaterThan(0);
    expect(c.reasons[0]).toContain("שיא חדש בסקוואט");
    expect(c.reasons[1]).toContain("ירד");
  });

  it("levels", () => {
    expect([150, 250, 400, 500, 580].map(levelFor)).toEqual(["beginner", "intermediate", "advanced", "expert", "elite"]);
  });
});
