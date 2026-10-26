import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import {
  deleteFoodLog,
  getDayLog,
  getFood,
  getTargetsFor,
  getWeekMarks,
  logCustom,
  logFood,
  logPhotoMeal,
  saveTargets,
  savePhoto,
  searchFoods,
  updateFoodLog,
} from "./nutrition-repo";
import { computeTargets, scale } from "@/lib/nutrition";

beforeEach(async () => {
  await db().delete();
  await db().open();
});

describe("food library", () => {
  it("is seeded in Hebrew and found by name, alias and prefix", async () => {
    expect((await db().foods.count())).toBeGreaterThan(100);
    expect((await searchFoods("קוטג"))[0].nameHe).toBe("קוטג' 5%");
    expect((await searchFoods("חומוס"))[0].nameHe).toBe("חומוס (ממרח)");
    expect((await searchFoods("פסטרמה")).map((f) => f.id)).toContain("seed:turkey-slices");
    expect(await searchFoods("זזזזז")).toEqual([]);
  });

  it("puts recently logged foods first when there is no query", async () => {
    const banana = (await getFood("seed:banana"))!;
    await logFood({ date: "2026-10-26", meal: "snack", food: banana, grams: 120 });
    expect((await searchFoods(""))[0].id).toBe("seed:banana");
  });
});

describe("diary", () => {
  it("scales a food by grams and totals the day", async () => {
    const cottage = (await getFood("seed:cottage-5"))!;
    const egg = (await getFood("seed:egg"))!;
    await logFood({ date: "2026-10-26", meal: "breakfast", food: cottage, grams: 250 });
    await logFood({ date: "2026-10-26", meal: "breakfast", food: egg, grams: 110 });
    const day = await getDayLog("2026-10-26");
    expect(day.byMeal.breakfast).toHaveLength(2);
    expect(day.totals.kcal).toBe(Math.round(98 * 2.5) + Math.round(143 * 1.1));
    expect(day.totals.protein).toBeCloseTo(11 * 2.5 + 12.6 * 1.1, 1);
  });

  it("editing the amount recalculates, also for photo estimates", async () => {
    const id = await logCustom({
      date: "2026-10-26",
      meal: "lunch",
      nameHe: "שניצל",
      grams: 150,
      macros: { kcal: 390, protein: 30, carbs: 18, fat: 22, fiber: null },
      source: "photo",
      confidence: "medium",
    });
    await updateFoodLog(id, { grams: 300 });
    const [e] = (await getDayLog("2026-10-26")).entries;
    expect(e.kcal).toBe(780);
    expect(e.protein).toBe(60);
  });

  it("deleting the last item from a photo deletes the photo", async () => {
    const photoId = await savePhoto("data:image/jpeg;base64,AAAA");
    const a = await logCustom({ date: "2026-10-26", meal: "lunch", nameHe: "אורז", macros: { kcal: 200, protein: 4, carbs: 44, fat: 0.5, fiber: null }, source: "photo", photoId });
    const b = await logCustom({ date: "2026-10-26", meal: "lunch", nameHe: "עוף", macros: { kcal: 250, protein: 45, carbs: 0, fat: 6, fiber: null }, source: "photo", photoId });
    await deleteFoodLog(a);
    expect(await db().mealPhotos.get(photoId)).toBeDefined();
    await deleteFoodLog(b);
    expect(await db().mealPhotos.get(photoId)).toBeUndefined();
  });
});

describe("targets", () => {
  it("uses defaults until set, then the latest target on or before the day", async () => {
    expect((await getTargetsFor("2026-10-26")).isDefault).toBe(true);
    await saveTargets({ effectiveFrom: "2026-10-20", calories: 2400, protein: 160, carbs: 260, fat: 75, fiber: 34, method: "manual", inputs: null });
    await saveTargets({ effectiveFrom: "2026-10-25", calories: 2200, protein: 170, carbs: 220, fat: 70, fiber: 31, method: "manual", inputs: null });
    expect((await getTargetsFor("2026-10-19")).isDefault).toBe(true);
    expect((await getTargetsFor("2026-10-22")).calories).toBe(2400);
    expect((await getTargetsFor("2026-10-26")).calories).toBe(2200);
  });

  it("marks the days of the week that were logged and on target", async () => {
    await saveTargets({ effectiveFrom: "2026-01-01", calories: 2000, protein: 150, carbs: 200, fat: 60, fiber: 28, method: "manual", inputs: null });
    await logCustom({ date: "2026-10-25", meal: "lunch", nameHe: "ארוחה", macros: { kcal: 1950, protein: 0, carbs: 0, fat: 0, fiber: null }, source: "quick" });
    await logCustom({ date: "2026-10-26", meal: "lunch", nameHe: "ארוחה", macros: { kcal: 900, protein: 0, carbs: 0, fat: 0, fiber: null }, source: "quick" });
    const marks = await getWeekMarks("2026-10-25");
    expect(marks.map((m) => [m.logged, m.onTarget]).slice(0, 3)).toEqual([[true, true], [true, false], [false, false]]);
  });
});

describe("formulas", () => {
  it("computes Mifflin-St Jeor targets with the macro split", () => {
    const t = computeTargets({ sex: "male", age: 30, heightCm: 178, weightKg: 80, activity: "moderate", goal: "lose_fat", pace: "normal" });
    expect(t.bmr).toBe(1768); // 800 + 1112.5 - 150 + 5 = 1767.5
    expect(t.tdee).toBe(2740); // × 1.55
    expect(t.calories).toBe(2190); // -20%, rounded to 10
    expect(t.protein).toBe(176);
    expect(t.fat).toBe(61);
    expect(t.protein * 4 + t.carbs * 4 + t.fat * 9).toBeLessThanOrEqual(t.calories + 4);
  });

  it("never goes under the calorie floor", () => {
    const t = computeTargets({ sex: "female", age: 60, heightCm: 150, weightKg: 45, activity: "sedentary", goal: "lose_fat", pace: "fast" });
    expect(t.calories).toBe(1200);
    expect(t.floored).toBe(true);
  });

  it("scales per-100 g values", () => {
    expect(scale({ kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 }, 150)).toEqual({ kcal: 248, protein: 46.5, carbs: 0, fat: 5.4, fiber: 0 });
  });
});

describe("photo meal", () => {
  it("saves the photo and every item together, sharing one photo", async () => {
    await logPhotoMeal({
      date: "2026-10-26",
      meal: "lunch",
      photoDataUrl: "data:image/jpeg;base64,AAAA",
      items: [
        { nameHe: "עוף", grams: 160, macros: { kcal: 264, protein: 50, carbs: 0, fat: 6, fiber: null }, confidence: "high" },
        { nameHe: "אורז", grams: 180, macros: { kcal: 234, protein: 5, carbs: 50, fat: 0.5, fiber: null }, confidence: "medium" },
        { nameHe: "סלט", grams: 150, macros: { kcal: 45, protein: 1, carbs: 6, fat: 2, fiber: null }, confidence: "low" },
      ],
    });
    const day = await getDayLog("2026-10-26");
    expect(day.byMeal.lunch.map((e) => e.nameHe)).toEqual(["עוף", "אורז", "סלט"]);
    expect(new Set(day.entries.map((e) => e.photoId)).size).toBe(1);
    expect(await db().mealPhotos.count()).toBe(1);
  });
});
