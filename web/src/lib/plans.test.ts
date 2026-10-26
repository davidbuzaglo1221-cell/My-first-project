import { describe, expect, it } from "vitest";
import { generatePlan } from "./plans";
import { SEED_EXERCISES } from "@/data/seed";

const known = new Set(SEED_EXERCISES.map((e) => e.slug));

describe("starting plans", () => {
  it("picks the split from days and experience", () => {
    expect(generatePlan({ days: 3, equipment: "gym", experience: "intermediate", goal: "build_muscle" }).templates.map((t) => t.name)).toEqual(["גוף מלא A", "גוף מלא B", "גוף מלא C"]);
    expect(generatePlan({ days: 4, equipment: "gym", experience: "intermediate", goal: "build_muscle" }).templates).toHaveLength(4);
    expect(generatePlan({ days: 6, equipment: "gym", experience: "advanced", goal: "strength" }).templates.map((t) => t.name)).toEqual(["דחיפה", "משיכה", "רגליים"]);
    expect(generatePlan({ days: 6, equipment: "gym", experience: "beginner", goal: "build_muscle" }).templates[0].name).toBe("גוף מלא A");
  });

  it("matches reps and sets to the goal and experience", () => {
    const strength = generatePlan({ days: 3, equipment: "gym", experience: "advanced", goal: "strength" }).templates[0].items[0];
    expect([strength.sets, strength.repsMin, strength.repsMax]).toEqual([4, 3, 6]);
    const beginner = generatePlan({ days: 3, equipment: "gym", experience: "beginner", goal: "lose_fat" }).templates[0].items[0];
    expect([beginner.sets, beginner.repsMin, beginner.repsMax]).toEqual([3, 8, 12]);
  });

  it("only uses exercises that exist in the library, for every combination", () => {
    for (const equipment of ["gym", "dumbbells", "bodyweight"] as const)
      for (const days of [2, 3, 4, 5, 6])
        for (const experience of ["beginner", "intermediate", "advanced"] as const) {
          const plan = generatePlan({ days, equipment, experience, goal: "build_muscle" });
          for (const t of plan.templates) for (const it of t.items) expect(known.has(it.slug), `${it.slug} in ${equipment}/${days}`).toBe(true);
        }
  });
});
