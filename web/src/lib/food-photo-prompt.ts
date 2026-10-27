import type { FoodPhotoItem } from "./food-photo-schema";

// The instructions for estimating a meal from a photo: shared by the server route (web build)
// and the in-chat build, so both answer the same way.

export const MEAL_PHOTO_SYSTEM = `You estimate the nutrition of a meal from one photo, for a Hebrew-language food diary used in Israel.

Return every distinct food you can see as its own item. Name items in natural Israeli Hebrew, the way people order or cook them (for example "חזה עוף בגריל", "אורז לבן", "סלט ירקות", "חומוס", "פיתה"). Give the dish a short Hebrew name.

Estimate the edible weight in grams of each item as served (cooked weight for cooked foods), using visual cues for scale: a standard dinner plate is about 26 cm across, a fork about 19 cm, a pita about 16 cm. Then give calories, protein, carbohydrates and fat for that weight, consistent with typical values per 100 g; calories should roughly equal 4×protein + 4×carbs + 9×fat.

Include cooking fat only when you can see the food was fried or dressed, and say so in the notes. Do not invent hidden items. If a portion is partly hidden or the scale is unclear, lower the confidence for that item rather than guessing confidently.

If the user adds a note (for example "בלי שמן" or "2 ביצים"), trust it over the photo.

If the photo does not show food or drink, set is_food to false and return no items. Write notes_he in one or two short Hebrew sentences, addressed to the user: what to check or correct. Leave it empty when there is nothing worth saying.`;

/** Model numbers cleaned up: no negatives, sensible rounding, no empty rows. */
export function cleanItems(items: FoodPhotoItem[]): FoodPhotoItem[] {
  return items
    .map((i) => ({
      ...i,
      name_he: i.name_he.trim(),
      grams: Math.max(0, Math.round(i.grams)),
      kcal: Math.max(0, Math.round(i.kcal)),
      protein_g: Math.max(0, Math.round(i.protein_g * 10) / 10),
      carbs_g: Math.max(0, Math.round(i.carbs_g * 10) / 10),
      fat_g: Math.max(0, Math.round(i.fat_g * 10) / 10),
    }))
    .filter((i) => i.name_he && (i.kcal > 0 || i.grams > 0));
}

export const LABEL_PROMPT = `You read food packaging for a Hebrew-language food diary used in Israel. The photos show one product: its nutrition table, its front, and/or its barcode.

Read, do not guess:
- barcode: the digits printed under the barcode (EAN-13, EAN-8 or UPC), or null if none is readable.
- name_he: the product name as printed, in Hebrew if the pack has Hebrew; otherwise a short natural Hebrew name.
- brand: the brand as printed, or null.
- per100: values per 100 g (or 100 ml) from the nutrition table: kcal, protein, carbs, fat, fiber (null if not listed). If the table only gives values per serving, convert to per 100 using the serving size. If only kJ is given, kcal = kJ / 4.184.
- serving_grams: the serving size in grams if printed, else null.
- found_table: true only if you could read a nutrition table.
- notes_he: one short Hebrew sentence if something was unclear (for example a blurry number), else "".

Reply with only this JSON:
{"barcode": "7290000000000" | null, "name_he": "...", "brand": "..." | null, "per100": {"kcal": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0 | null}, "serving_grams": 0 | null, "found_table": true, "notes_he": ""}`;
