import { describe, expect, it } from "vitest";
import { suggestNext } from "./coach";
import type { PreviousSet } from "@/data/types";

const sets = (...s: [number | null, number][]): PreviousSet[] => s.map(([w, r], i) => ({ position: i, kind: "work", weightKg: w, reps: r }));

describe("double progression", () => {
  it("adds weight once every set reaches the top of the range", () => {
    const s = suggestNext({ previous: sets([100, 8], [100, 8], [100, 9]), repsMin: 5, repsMax: 8, equipment: "barbell", units: "kg" })!;
    expect([s.kind, s.weightKg, s.reps]).toEqual(["add_weight", 102.5, 5]);
    expect(s.why).toContain("102.5");
  });

  it("adds a rep while not every set is at the top", () => {
    const s = suggestNext({ previous: sets([100, 8], [100, 7], [100, 6]), repsMin: 5, repsMax: 8, equipment: "barbell", units: "kg" })!;
    expect([s.kind, s.weightKg, s.reps]).toEqual(["add_reps", 100, 7]);
  });

  it("repeats the weight when a set fell under the range", () => {
    const s = suggestNext({ previous: sets([100, 6], [100, 4]), repsMin: 5, repsMax: 8, equipment: "barbell", units: "kg" })!;
    expect([s.kind, s.weightKg, s.reps]).toEqual(["repeat", 100, 5]);
  });

  it("uses the dumbbell jump, ignores warmups, and handles bodyweight", () => {
    const db = suggestNext({ previous: [{ position: 0, kind: "warmup", weightKg: 10, reps: 15 }, ...sets([20, 12], [20, 12])], repsMin: 8, repsMax: 12, equipment: "dumbbell", units: "kg" })!;
    expect([db.weightKg, db.reps]).toEqual([22, 8]);
    const bw = suggestNext({ previous: sets([null, 10], [null, 8]), repsMin: null, repsMax: null, equipment: "bodyweight", units: "kg" })!;
    expect([bw.weightKg, bw.reps]).toEqual([null, 9]);
  });

  it("has nothing to suggest the first time", () => {
    expect(suggestNext({ previous: [], repsMin: 8, repsMax: 12, equipment: "barbell", units: "kg" })).toBeNull();
  });
});
