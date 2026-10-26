// Types mirror replica/schema.sql (snake_case there, camelCase here).
// The local data layer (IndexedDB) and the future Supabase layer both speak these types.

export type Units = "kg" | "lb";
export type WeekStart = "sun" | "mon";
export type Theme = "dark" | "light" | "system";
export type Goal = "lose_fat" | "maintain" | "build_muscle" | "strength";
export type MuscleGroup = "legs" | "chest" | "back" | "shoulders" | "arms" | "core" | "full_body" | "cardio";
export type Equipment =
  | "barbell" | "dumbbell" | "kettlebell" | "machine" | "cable" | "bodyweight"
  | "band" | "smith" | "ez_bar" | "trap_bar" | "bench" | "pullup_bar" | "other";
export type TrackingType = "weight_reps" | "reps" | "time" | "distance_time" | "bodyweight_plus" | "assisted";
export type SetKind = "warmup" | "work" | "drop" | "failure";

export interface Profile {
  id: string;
  displayName: string | null;
  units: Units;
  weekStartsOn: WeekStart;
  theme: Theme;
  goal: Goal | null;
  bodyweightKg: number | null;
  defaultRestSec: number;
  autoRestTimer: boolean;
}

export interface Exercise {
  id: string;
  userId: string | null; // null = library
  slug: string | null;
  nameHe: string;
  aliasesHe: string[];
  primaryMuscle: MuscleGroup;
  equipment: Equipment;
  tracking: TrackingType;
  isUnilateral: boolean;
  instructionsHe: string | null;
}

export interface WorkoutTemplate {
  id: string;
  userId: string | null;
  name: string;
  notes: string | null;
  position: number;
  createdAt: string;
}

export interface TemplateExercise {
  id: string;
  templateId: string;
  exerciseId: string;
  position: number;
  supersetGroup: number | null;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetRestSec: number | null;
}

export interface Workout {
  id: string;
  userId: string;
  templateId: string | null;
  name: string | null;
  startedAt: string; // ISO, UTC
  endedAt: string | null;
  notes: string | null;
  rating: number | null;
  bodyweightKg: number | null;
  /** Local only: when the running rest timer ends. Survives a reload. */
  restEndsAt?: number | null;
  restTotalSec?: number | null;
  updatedAt: string;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  position: number;
  supersetGroup: number | null;
  notes: string | null;
}

export interface WorkoutSet {
  id: string;
  workoutExerciseId: string;
  workoutId: string; // denormalised locally so a workout's sets load in one query
  position: number;
  kind: SetKind;
  weightKg: number | null;
  reps: number | null;
  completedAt: string | null;
  isPr: boolean;
  updatedAt: string;
}

export interface PreviousSet {
  position: number;
  kind: SetKind;
  weightKg: number | null;
  reps: number | null;
}

export interface WorkoutSummary {
  workout: Workout;
  durationSec: number;
  setCount: number;
  exerciseCount: number;
  volumeKg: number;
  records: { exerciseId: string; exerciseName: string; weightKg: number; reps: number; e1rm: number }[];
  vsPrevious: { volumeDeltaKg: number } | null;
}

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  legs: "רגליים",
  chest: "חזה",
  back: "גב",
  shoulders: "כתפיים",
  arms: "ידיים",
  core: "בטן",
  full_body: "גוף מלא",
  cardio: "קרדיו",
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: "מוט",
  dumbbell: "משקולות יד",
  kettlebell: "קטלבל",
  machine: "מכונה",
  cable: "כבל",
  bodyweight: "משקל גוף",
  band: "גומייה",
  smith: "סמית'",
  ez_bar: "מוט EZ",
  trap_bar: "מוט משושה",
  bench: "ספסל",
  pullup_bar: "מתח",
  other: "אחר",
};

// ---------- nutrition ----------------------------------------------------------

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export type FoodSource = "seed" | "openfoodfacts" | "user";
export type LogSource = "search" | "photo" | "barcode" | "quick";

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: "ארוחת בוקר",
  lunch: "ארוחת צהריים",
  dinner: "ארוחת ערב",
  snack: "נשנושים",
};
export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

export interface Per100 {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
}

export interface Serving {
  nameHe: string;
  grams: number;
}

export interface Food {
  id: string;
  userId: string | null; // null = shared library
  source: FoodSource;
  nameHe: string;
  aliasesHe: string[];
  brand: string | null;
  barcode: string | null;
  per100: Per100;
  servings: Serving[];
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
}

/** One line in the food diary. Nutrients are a snapshot, so editing a food never rewrites history. */
export interface FoodLog extends Macros {
  id: string;
  logDate: string; // YYYY-MM-DD in the user's local day
  meal: Meal;
  foodId: string | null; // null for photo and quick entries
  nameHe: string;
  grams: number | null;
  per100: Per100 | null; // lets the amount be edited later and the numbers follow
  source: LogSource;
  photoId: string | null;
  confidence: "high" | "medium" | "low" | null; // photo estimates only
  createdAt: string;
}

export interface MealPhoto {
  id: string;
  dataUrl: string; // a small JPEG, kept on the phone only
  createdAt: string;
}

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Pace = "slow" | "normal" | "fast";

export interface TargetInputs {
  sex: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  pace: Pace;
}

export interface NutritionTarget {
  id: string;
  effectiveFrom: string; // YYYY-MM-DD
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  method: "wizard" | "manual";
  inputs: TargetInputs | null;
}
