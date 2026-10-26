import { db } from "./db";
import { normaliseHe } from "./repo";
import { DEFAULT_TARGETS, addDays, scale, sumMacros } from "@/lib/nutrition";
import type { Food, FoodLog, LogSource, Macros, Meal, NutritionTarget, Per100, Serving, TargetInputs } from "./types";

// Nutrition data layer. Same rule as repo.ts: these signatures stay when Supabase replaces IndexedDB.

// Strictly increasing, so items saved in the same millisecond (a photo meal) keep their order.
let lastStamp = 0;
const now = () => {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return new Date(lastStamp).toISOString();
};
const uuid = () => crypto.randomUUID();
const USER = "me";

// ---------- foods --------------------------------------------------------------

/** Search by name or alias. With no query: the foods logged most recently, then the library. */
export async function searchFoods(query: string, limit = 40): Promise<Food[]> {
  const all = (await db().foods.toArray()).filter((f) => f.userId === null || f.userId === USER);
  const q = normaliseHe(query);
  if (!q) {
    const recentIds = await recentFoodIds(12);
    const byId = new Map(all.map((f) => [f.id, f]));
    const recent = recentIds.map((id) => byId.get(id)).filter((f): f is Food => !!f);
    const rest = all.filter((f) => !recentIds.includes(f.id)).sort((a, b) => a.nameHe.localeCompare(b.nameHe, "he"));
    return [...recent, ...rest].slice(0, limit);
  }
  const score = (f: Food) => {
    const names = [f.nameHe, ...f.aliasesHe, f.brand ?? ""].map(normaliseHe);
    if (names.some((n) => n === q)) return 0;
    if (names.some((n) => n.startsWith(q))) return 1;
    if (names.some((n) => n.split(" ").some((w) => w.startsWith(q)))) return 2;
    if (names.some((n) => n.includes(q))) return 3;
    return 9;
  };
  return all
    .map((f) => ({ f, s: score(f) }))
    .filter((x) => x.s < 9)
    .sort((a, b) => a.s - b.s || a.f.nameHe.length - b.f.nameHe.length)
    .slice(0, limit)
    .map((x) => x.f);
}

async function recentFoodIds(limit: number): Promise<string[]> {
  const logs = await db().foodLogs.orderBy("createdAt").reverse().limit(200).toArray();
  const ids: string[] = [];
  for (const l of logs) if (l.foodId && !ids.includes(l.foodId)) ids.push(l.foodId);
  return ids.slice(0, limit);
}

export async function getFood(id: string): Promise<Food | undefined> {
  return db().foods.get(id);
}

export async function getFoodByBarcode(barcode: string): Promise<Food | undefined> {
  return db().foods.where("barcode").equals(barcode).first();
}

export async function createFood(input: {
  nameHe: string;
  brand?: string | null;
  barcode?: string | null;
  per100: Per100;
  servings?: Serving[];
  source?: Food["source"];
}): Promise<Food> {
  const food: Food = {
    id: uuid(),
    userId: input.source === "openfoodfacts" ? null : USER,
    source: input.source ?? "user",
    nameHe: input.nameHe.trim(),
    aliasesHe: [],
    brand: input.brand ?? null,
    barcode: input.barcode ?? null,
    per100: input.per100,
    servings: input.servings ?? [],
  };
  await db().foods.add(food);
  return food;
}

// ---------- the diary ---------------------------------------------------------

export async function logFood(input: { date: string; meal: Meal; food: Food; grams: number; source?: LogSource }): Promise<string> {
  const m = scale(input.food.per100, input.grams);
  const entry: FoodLog = {
    id: uuid(),
    logDate: input.date,
    meal: input.meal,
    foodId: input.food.id,
    nameHe: input.food.nameHe,
    grams: input.grams,
    per100: input.food.per100,
    source: input.source ?? "search",
    photoId: null,
    confidence: null,
    createdAt: now(),
    ...m,
  };
  await db().foodLogs.add(entry);
  return entry.id;
}

/** A logged item that is not a library food: a photo estimate or a quick calories entry. */
export async function logCustom(input: {
  date: string;
  meal: Meal;
  nameHe: string;
  macros: Macros;
  grams?: number | null;
  source: LogSource;
  photoId?: string | null;
  confidence?: FoodLog["confidence"];
}): Promise<string> {
  const grams = input.grams ?? null;
  const per100: Per100 | null =
    grams && grams > 0
      ? {
          kcal: (input.macros.kcal / grams) * 100,
          protein: (input.macros.protein / grams) * 100,
          carbs: (input.macros.carbs / grams) * 100,
          fat: (input.macros.fat / grams) * 100,
          fiber: input.macros.fiber == null ? null : (input.macros.fiber / grams) * 100,
        }
      : null;
  const entry: FoodLog = {
    id: uuid(),
    logDate: input.date,
    meal: input.meal,
    foodId: null,
    nameHe: input.nameHe.trim() || "ארוחה",
    grams,
    per100,
    source: input.source,
    photoId: input.photoId ?? null,
    confidence: input.confidence ?? null,
    createdAt: now(),
    kcal: Math.round(input.macros.kcal),
    protein: round1(input.macros.protein),
    carbs: round1(input.macros.carbs),
    fat: round1(input.macros.fat),
    fiber: input.macros.fiber == null ? null : round1(input.macros.fiber),
  };
  await db().foodLogs.add(entry);
  return entry.id;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Change the amount (numbers follow, when the entry knows its per-100 g values), meal or name. */
export async function updateFoodLog(id: string, patch: { grams?: number; meal?: Meal; nameHe?: string; macros?: Macros }): Promise<void> {
  const entry = await db().foodLogs.get(id);
  if (!entry) return;
  const next: Partial<FoodLog> = {};
  if (patch.meal) next.meal = patch.meal;
  if (patch.nameHe != null) next.nameHe = patch.nameHe.trim() || entry.nameHe;
  if (patch.macros) Object.assign(next, { ...patch.macros, kcal: Math.round(patch.macros.kcal) });
  if (patch.grams != null && patch.grams > 0) {
    next.grams = patch.grams;
    if (entry.per100 && !patch.macros) Object.assign(next, scale(entry.per100, patch.grams));
  }
  await db().foodLogs.update(id, next);
}

export async function deleteFoodLog(id: string): Promise<void> {
  const entry = await db().foodLogs.get(id);
  await db().foodLogs.delete(id);
  // A photo is shared by the items found in it; drop it with the last one.
  if (entry?.photoId && (await db().foodLogs.filter((l) => l.photoId === entry.photoId).count()) === 0) {
    await db().mealPhotos.delete(entry.photoId);
  }
}

export async function getFoodLog(id: string): Promise<FoodLog | undefined> {
  return db().foodLogs.get(id);
}

export type DayLog = {
  date: string;
  entries: FoodLog[];
  byMeal: Record<Meal, FoodLog[]>;
  totals: Macros;
  targets: Omit<NutritionTarget, "id" | "inputs" | "method" | "effectiveFrom"> & { isDefault: boolean };
};

export async function getDayLog(date: string): Promise<DayLog> {
  const entries = (await db().foodLogs.where("logDate").equals(date).toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const byMeal: DayLog["byMeal"] = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const e of entries) byMeal[e.meal].push(e);
  return { date, entries, byMeal, totals: sumMacros(entries), targets: await getTargetsFor(date) };
}

/** Seven days from `weekStart`, each marked as logged and within ±10% of the calorie target. */
export async function getWeekMarks(weekStart: string): Promise<{ date: string; logged: boolean; onTarget: boolean; kcal: number }[]> {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const logs = await db().foodLogs.where("logDate").between(days[0], days[6], true, true).toArray();
  return Promise.all(
    days.map(async (date) => {
      const kcal = logs.filter((l) => l.logDate === date).reduce((n, l) => n + l.kcal, 0);
      const t = await getTargetsFor(date);
      return { date, kcal, logged: kcal > 0, onTarget: kcal > 0 && Math.abs(kcal - t.calories) <= t.calories * 0.1 };
    }),
  );
}

// ---------- photos -------------------------------------------------------------

export async function savePhoto(dataUrl: string): Promise<string> {
  const id = uuid();
  await db().mealPhotos.add({ id, dataUrl, createdAt: now() });
  return id;
}

export async function getPhoto(id: string): Promise<string | undefined> {
  return (await db().mealPhotos.get(id))?.dataUrl;
}

// ---------- targets ------------------------------------------------------------

/** The target in force on `date`: the latest one that started on or before it. */
export async function getTargetsFor(date: string): Promise<DayLog["targets"]> {
  const t = (await db().targets.where("effectiveFrom").belowOrEqual(date).sortBy("effectiveFrom")).at(-1);
  return t
    ? { calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat, fiber: t.fiber, isDefault: false }
    : { ...DEFAULT_TARGETS, isDefault: true };
}

export async function getLatestTarget(): Promise<NutritionTarget | undefined> {
  return (await db().targets.orderBy("effectiveFrom").toArray()).at(-1);
}

/** Saves new targets from `effectiveFrom`. Past days keep the targets they had. */
export async function saveTargets(input: Omit<NutritionTarget, "id">): Promise<void> {
  await db().transaction("rw", db().targets, async () => {
    await db().targets.where("effectiveFrom").equals(input.effectiveFrom).delete();
    await db().targets.add({ ...input, id: uuid() });
  });
}

export type { TargetInputs };

/**
 * Saves a recognised meal in one transaction: the photo and every item, or nothing.
 * Leaving the screen mid-save can no longer drop the last items.
 */
export async function logPhotoMeal(input: {
  date: string;
  meal: Meal;
  photoDataUrl: string;
  items: { nameHe: string; grams: number; macros: Macros; confidence: FoodLog["confidence"] }[];
}): Promise<void> {
  await db().transaction("rw", db().mealPhotos, db().foodLogs, async () => {
    const photoId = await savePhoto(input.photoDataUrl);
    for (const i of input.items) {
      await logCustom({ date: input.date, meal: input.meal, nameHe: i.nameHe, grams: i.grams, macros: i.macros, source: "photo", photoId, confidence: i.confidence });
    }
  });
}
