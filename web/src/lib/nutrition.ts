import type { ActivityLevel, Goal, Macros, Pace, Per100, TargetInputs } from "@/data/types";

// The formulas are written out here so the app can explain every number it shows
// (replica/architecture.md, "נוסחאות").

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Calorie change from TDEE, as a fraction. */
const GOAL_ADJUST: Record<Goal, Record<Pace, number>> = {
  lose_fat: { slow: -0.12, normal: -0.2, fast: -0.25 },
  maintain: { slow: 0, normal: 0, fast: 0 },
  build_muscle: { slow: 0.05, normal: 0.1, fast: 0.15 },
  strength: { slow: 0.03, normal: 0.05, fast: 0.08 },
};

/** Protein in g per kg of bodyweight: higher when cutting, to keep muscle. */
const PROTEIN_PER_KG: Record<Goal, number> = {
  lose_fat: 2.2,
  maintain: 1.8,
  build_muscle: 2.0,
  strength: 2.0,
};

export type TargetResult = {
  bmr: number;
  tdee: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** A floor was applied, so the plan is gentler than the goal asked for. */
  floored: boolean;
};

/** Mifflin-St Jeor BMR × activity = TDEE, then the goal adjustment and the macro split. */
export function computeTargets(i: TargetInputs): TargetResult {
  const bmr = 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age + (i.sex === "male" ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTOR[i.activity];
  const floor = i.sex === "male" ? 1500 : 1200;
  const wanted = tdee * (1 + GOAL_ADJUST[i.goal][i.pace]);
  const calories = Math.round(Math.max(floor, wanted) / 10) * 10;

  const protein = Math.round(PROTEIN_PER_KG[i.goal] * i.weightKg);
  // Fat: 25% of calories, but not below 0.6 g/kg (hormones need it).
  const fat = Math.round(Math.max((calories * 0.25) / 9, 0.6 * i.weightKg));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((calories / 1000) * 14);

  return { bmr: Math.round(bmr), tdee: Math.round(tdee), calories, protein, carbs, fat, fiber, floored: wanted < floor };
}

export const DEFAULT_TARGETS = { calories: 2000, protein: 140, carbs: 210, fat: 65, fiber: 28 };

/** Nutrients for `grams` of a food given per 100 g. */
export function scale(per100: Per100, grams: number): Macros {
  const f = grams / 100;
  const r = (n: number) => Math.round(n * f * 10) / 10;
  return {
    kcal: Math.round(per100.kcal * f),
    protein: r(per100.protein),
    carbs: r(per100.carbs),
    fat: r(per100.fat),
    fiber: per100.fiber == null ? null : r(per100.fiber),
  };
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce<Macros>(
    (t, m) => ({
      kcal: t.kcal + m.kcal,
      protein: t.protein + m.protein,
      carbs: t.carbs + m.carbs,
      fat: t.fat + m.fat,
      fiber: (t.fiber ?? 0) + (m.fiber ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

/** Calories implied by macros (4/4/9). Used to sanity-check photo estimates. */
export function kcalFromMacros(m: { protein: number; carbs: number; fat: number }): number {
  return m.protein * 4 + m.carbs * 4 + m.fat * 9;
}

/** YYYY-MM-DD for a moment in the device's local time zone. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDateKey(d);
}

/** The meal that fits the time of day, as a default when adding food. */
export function mealForTime(d: Date = new Date()): "breakfast" | "lunch" | "dinner" | "snack" {
  const h = d.getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 18 && h < 22) return "dinner";
  return "snack";
}
