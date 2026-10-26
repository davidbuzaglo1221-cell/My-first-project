import type { Per100, Serving } from "@/data/types";

// Open Food Facts: an open product database (data under ODbL; we show the credit).
// Called from the browser, so the product lookup works without our server.

export type OffProduct = { nameHe: string; brand: string | null; per100: Per100; servings: Serving[] };

type OffResponse = {
  status: number;
  product?: {
    product_name_he?: string;
    product_name?: string;
    brands?: string;
    serving_quantity?: number | string;
    nutriments?: Record<string, number | string | undefined>;
  };
};

const n = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN);

export async function lookupBarcode(barcode: string, signal?: AbortSignal): Promise<OffProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_he,brands,serving_quantity,nutriments`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts ${res.status}`);
  const data = (await res.json()) as OffResponse;
  const p = data.product;
  if (data.status !== 1 || !p) return null;
  const nu = p.nutriments ?? {};
  let kcal = n(nu["energy-kcal_100g"]);
  if (!Number.isFinite(kcal) && Number.isFinite(n(nu["energy_100g"]))) kcal = n(nu["energy_100g"]) / 4.184; // kJ → kcal
  if (!Number.isFinite(kcal)) return null; // no nutrition table: not useful for the diary
  const grams = n(p.serving_quantity);
  return {
    nameHe: (p.product_name_he || p.product_name || "מוצר").trim(),
    brand: p.brands?.split(",")[0]?.trim() || null,
    per100: {
      kcal: Math.round(kcal),
      protein: round1(n(nu["proteins_100g"])),
      carbs: round1(n(nu["carbohydrates_100g"])),
      fat: round1(n(nu["fat_100g"])),
      fiber: Number.isFinite(n(nu["fiber_100g"])) ? round1(n(nu["fiber_100g"])) : null,
    },
    servings: Number.isFinite(grams) && grams > 0 ? [{ nameHe: "מנה", grams: Math.round(grams) }] : [],
  };
}

function round1(v: number) {
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : 0;
}
