import type { Goal } from "@/data/types";

// Starting plans, written for this app from standard program shapes:
// 2–3 days full body, 4 days upper/lower, 5–6 days push/pull/legs; gym, dumbbells or bodyweight.
// Rep ranges follow the goal; beginners get fewer sets and at most 3 different days.

export type EquipmentAccess = "gym" | "dumbbells" | "bodyweight";
export type Experience = "beginner" | "intermediate" | "advanced";

export type PlanItem = { slug: string; sets: number; repsMin: number; repsMax: number; restSec: number };
export type PlanTemplate = { name: string; items: PlanItem[] };
export type Plan = { name: string; summary: string; templates: PlanTemplate[] };

type Role = "main" | "secondary" | "accessory";
type Slot = [slug: string, role: Role];

const DAYS: Record<EquipmentAccess, Record<string, Slot[]>> = {
  gym: {
    "גוף מלא A": [["back-squat", "main"], ["bench-press", "main"], ["barbell-row", "secondary"], ["lateral-raise", "accessory"], ["triceps-pushdown", "accessory"]],
    "גוף מלא B": [["romanian-deadlift", "main"], ["overhead-press", "main"], ["lat-pulldown", "secondary"], ["leg-curl", "accessory"], ["db-curl", "accessory"]],
    "גוף מלא C": [["leg-press", "main"], ["incline-db-press", "secondary"], ["seated-cable-row", "secondary"], ["face-pull", "accessory"], ["hanging-leg-raise", "accessory"]],
    "עליון A": [["bench-press", "main"], ["barbell-row", "main"], ["overhead-press", "secondary"], ["lat-pulldown", "secondary"], ["db-curl", "accessory"], ["triceps-pushdown", "accessory"]],
    "תחתון A": [["back-squat", "main"], ["romanian-deadlift", "secondary"], ["leg-press", "secondary"], ["leg-curl", "accessory"], ["calf-raise", "accessory"]],
    "עליון B": [["incline-db-press", "main"], ["pull-up", "main"], ["db-shoulder-press", "secondary"], ["seated-cable-row", "secondary"], ["lateral-raise", "accessory"], ["hammer-curl", "accessory"]],
    "תחתון B": [["deadlift", "main"], ["bulgarian-split-squat", "secondary"], ["leg-extension", "accessory"], ["hip-thrust", "secondary"], ["plank", "accessory"]],
    דחיפה: [["bench-press", "main"], ["overhead-press", "secondary"], ["incline-db-press", "secondary"], ["lateral-raise", "accessory"], ["triceps-pushdown", "accessory"]],
    משיכה: [["deadlift", "main"], ["pull-up", "secondary"], ["seated-cable-row", "secondary"], ["face-pull", "accessory"], ["db-curl", "accessory"]],
    רגליים: [["back-squat", "main"], ["romanian-deadlift", "secondary"], ["leg-press", "secondary"], ["leg-curl", "accessory"], ["calf-raise", "accessory"]],
  },
  dumbbells: {
    "גוף מלא A": [["goblet-squat", "main"], ["db-bench-press", "main"], ["db-row", "secondary"], ["lateral-raise", "accessory"], ["db-curl", "accessory"]],
    "גוף מלא B": [["db-rdl", "main"], ["db-shoulder-press", "main"], ["chest-supported-row", "secondary"], ["reverse-lunge", "secondary"], ["overhead-triceps", "accessory"]],
    "גוף מלא C": [["bulgarian-split-squat", "main"], ["incline-db-press", "secondary"], ["db-row", "secondary"], ["rear-delt-fly", "accessory"], ["hammer-curl", "accessory"]],
    "עליון A": [["db-bench-press", "main"], ["db-row", "main"], ["db-shoulder-press", "secondary"], ["lateral-raise", "accessory"], ["db-curl", "accessory"], ["overhead-triceps", "accessory"]],
    "תחתון A": [["goblet-squat", "main"], ["db-rdl", "secondary"], ["reverse-lunge", "secondary"], ["glute-bridge", "accessory"], ["plank", "accessory"]],
    "עליון B": [["incline-db-press", "main"], ["chest-supported-row", "main"], ["arnold-press", "secondary"], ["rear-delt-fly", "accessory"], ["hammer-curl", "accessory"]],
    "תחתון B": [["bulgarian-split-squat", "main"], ["db-rdl", "secondary"], ["step-up", "secondary"], ["glute-bridge", "accessory"], ["dead-bug", "accessory"]],
  },
  bodyweight: {
    "גוף מלא A": [["bodyweight-squat", "main"], ["push-up", "main"], ["glute-bridge", "secondary"], ["pike-push-up", "secondary"], ["plank", "accessory"]],
    "גוף מלא B": [["reverse-lunge", "main"], ["decline-push-up", "main"], ["back-extension", "secondary"], ["side-plank", "accessory"], ["dead-bug", "accessory"]],
    "גוף מלא C": [["bodyweight-squat", "main"], ["push-up", "secondary"], ["burpee", "secondary"], ["crunch", "accessory"], ["russian-twist", "accessory"]],
  },
};

const REPS: Record<Goal, Record<Role, [number, number]>> = {
  strength: { main: [3, 6], secondary: [5, 8], accessory: [8, 12] },
  build_muscle: { main: [6, 10], secondary: [8, 12], accessory: [10, 15] },
  lose_fat: { main: [8, 12], secondary: [10, 12], accessory: [12, 15] },
  maintain: { main: [6, 10], secondary: [8, 12], accessory: [10, 15] },
};

const REST: Record<Role, number> = { main: 150, secondary: 120, accessory: 75 };

export function generatePlan(i: { days: number; equipment: EquipmentAccess; experience: Experience; goal: Goal }): Plan {
  const days = Math.max(2, Math.min(6, Math.round(i.days)));
  const pool = DAYS[i.equipment];
  let names: string[];
  let summary: string;
  if (i.equipment === "bodyweight" || i.experience === "beginner" || days <= 3) {
    names = days <= 2 ? ["גוף מלא A", "גוף מלא B"] : ["גוף מלא A", "גוף מלא B", "גוף מלא C"];
    summary = `גוף מלא, ${days} פעמים בשבוע, מתחלפים בין ${names.length} אימונים`;
  } else if (days === 4 || i.equipment === "dumbbells") {
    names = ["עליון A", "תחתון A", "עליון B", "תחתון B"];
    summary = `פלג עליון ותחתון, ${days} פעמים בשבוע`;
  } else {
    names = ["דחיפה", "משיכה", "רגליים"];
    summary = `דחיפה, משיכה, רגליים: ${days === 6 ? "כל אחד פעמיים בשבוע" : `${days} פעמים בשבוע, בסבב`}`;
  }
  const sets = (role: Role) => (i.experience === "beginner" ? 3 : role === "main" ? 4 : 3);
  return {
    name: summary,
    summary,
    templates: names.map((name) => ({
      name,
      items: pool[name].map(([slug, role]) => {
        // Bodyweight moves are done for reps, so they get a higher range.
        const [lo, hi] = i.equipment === "bodyweight" ? [10, 20] : REPS[i.goal][role];
        return { slug, sets: sets(role), repsMin: lo, repsMax: hi, restSec: i.equipment === "bodyweight" ? 60 : REST[role] };
      }),
    })),
  };
}
