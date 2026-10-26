import type { Equipment, PreviousSet } from "@/data/types";
import { formatWeight, type Units } from "./format";

// Today's target for an exercise, by double progression: stay on a weight and add reps until
// every work set reaches the top of the rep range, then add the smallest sensible weight and
// start again at the bottom of the range. Each suggestion comes with the reason, in Hebrew.

export type Suggestion = {
  weightKg: number | null; // null for bodyweight work
  reps: number;
  kind: "add_weight" | "add_reps" | "repeat";
  why: string;
};

/** The smallest jump that is actually loadable, in kg. */
export function increment(equipment: Equipment, units: Units): number {
  if (units === "lb") return equipment === "dumbbell" || equipment === "kettlebell" ? 2.26796 : 2.26796 * 2; // 5 lb / 10 lb
  if (equipment === "dumbbell" || equipment === "kettlebell") return 2;
  if (equipment === "cable" || equipment === "machine") return 2.5;
  return 2.5;
}

export function suggestNext(input: {
  previous: PreviousSet[];
  repsMin: number | null;
  repsMax: number | null;
  equipment: Equipment;
  units: Units;
}): Suggestion | null {
  const work = input.previous.filter((s) => s.kind !== "warmup" && s.reps != null && s.reps > 0);
  if (!work.length) return null;
  const min = input.repsMin ?? 8;
  const max = Math.max(min, input.repsMax ?? 12);
  const w = (kg: number) => `${formatWeight(kg, input.units)} ${input.units === "kg" ? 'ק"ג' : "ליב'"}`;

  // Bodyweight: progress by reps only.
  if (work.every((s) => !s.weightKg)) {
    const low = Math.min(...work.map((s) => s.reps!));
    return {
      weightKg: null,
      reps: low + 1,
      kind: "add_reps",
      why: `בפעם הקודמת הסט החלש היה ${low} חזרות. היעד היום: חזרה אחת יותר בכל סט.`,
    };
  }

  // Judge by the heaviest weight used in work sets.
  const top = Math.max(...work.map((s) => s.weightKg ?? 0));
  const atTop = work.filter((s) => s.weightKg === top);
  const lowReps = Math.min(...atTop.map((s) => s.reps!));

  if (lowReps >= max) {
    const next = top + increment(input.equipment, input.units);
    return {
      weightKg: next,
      reps: min,
      kind: "add_weight",
      why: `בפעם הקודמת הגעת ל-${max} חזרות או יותר בכל הסטים עם ${w(top)}. זה הסימן להעלות משקל: ${w(next)}, ולהתחיל שוב מ-${min} חזרות.`,
    };
  }
  if (lowReps < min) {
    return {
      weightKg: top,
      reps: min,
      kind: "repeat",
      why: `בפעם הקודמת סט אחד נעצר ב-${lowReps}, מתחת לטווח של ${min} עד ${max} חזרות. נשארים על ${w(top)} ומכוונים ל-${min} חזרות בכל הסטים.`,
    };
  }
  return {
    weightKg: top,
    reps: Math.min(max, lowReps + 1),
    kind: "add_reps",
    why: `עוד לא ${max} חזרות בכל הסטים. נשארים על ${w(top)} ומוסיפים חזרה: ${lowReps + 1}. כשכל הסטים יגיעו ל-${max}, מעלים משקל.`,
  };
}
