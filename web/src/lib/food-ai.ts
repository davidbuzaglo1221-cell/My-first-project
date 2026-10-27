import { z } from "zod";
import type { Per100, Serving } from "@/data/types";
import { FoodPhotoResult, type FoodPhotoError, type FoodPhotoResponse } from "./food-photo-schema";
import { cleanItems, LABEL_PROMPT, MEAL_PHOTO_SYSTEM } from "./food-photo-prompt";
import { base64Of } from "./image";
import { getAppToken } from "./local-settings";
import { cap, IS_ARTIFACT, type SampleError } from "./runtime";

// Photo recognition, wherever the app runs: the server route in the web build, Claude itself
// (the viewer's own account, no key) in the in-chat build.

export function dataUrlToBlob(dataUrl: string): Blob {
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? "image/jpeg";
  const bin = atob(base64Of(dataUrl));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function sampleError(e: unknown): FoodPhotoError {
  switch ((e as SampleError)?.code) {
    case "not_granted":
    case "sampling_disabled":
    case "not_declared":
    case "images_unavailable":
      return "not_allowed";
    case "rate_limited":
      return "busy";
    case "refused":
      return "refused";
    case "image_rejected":
      return "bad_request";
    case "invalid_json":
    case "empty_completion":
      return "unreadable";
    default:
      return "upstream";
  }
}

/** What is on the plate: items with grams and macros, or a reason it could not say. */
export async function analyzeMealPhoto(uploadDataUrl: string, hint: string): Promise<FoodPhotoResponse | { ok: false; error: "network" }> {
  if (!IS_ARTIFACT) {
    try {
      const res = await fetch("/api/food-photo", {
        method: "POST",
        headers: { "content-type": "application/json", "x-app-token": getAppToken() },
        body: JSON.stringify({ image: base64Of(uploadDataUrl), mediaType: "image/jpeg", hint: hint || undefined }),
      });
      return (await res.json()) as FoodPhotoResponse;
    } catch {
      return { ok: false, error: "network" };
    }
  }
  const sample = await cap("sample");
  if (!sample) return { ok: false, error: "not_allowed" };
  const prompt = `${MEAL_PHOTO_SYSTEM}

${hint.trim() ? `הערה מהמשתמש: ${hint.trim()}` : "מה יש בצלחת?"}

Reply with only this JSON (numbers, not strings):
{"is_food": true, "dish_name_he": "...", "items": [{"name_he": "...", "grams": 0, "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "confidence": "high" | "medium" | "low"}], "notes_he": ""}`;
  try {
    const raw = await sample.json(prompt, { images: [dataUrlToBlob(uploadDataUrl)], modelTier: "complex", effort: "medium" });
    const parsed = FoodPhotoResult.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "unreadable" };
    return { ok: true, result: { ...parsed.data, items: cleanItems(parsed.data.items) } };
  } catch (e) {
    return { ok: false, error: sampleError(e) };
  }
}

const Label = z.object({
  barcode: z.string().nullable().optional(),
  name_he: z.string(),
  brand: z.string().nullable().optional(),
  per100: z.object({ kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number(), fiber: z.number().nullable().optional() }),
  serving_grams: z.number().nullable().optional(),
  found_table: z.boolean(),
  notes_he: z.string().optional(),
});

export type LabelProduct = { barcode: string | null; nameHe: string; brand: string | null; per100: Per100; servings: Serving[]; notes: string };
export type LabelResult = { ok: true; product: LabelProduct } | { ok: false; error: FoodPhotoError | "no_table" };

const r1 = (v: number) => Math.max(0, Math.round(v * 10) / 10);

/** Reads a product's nutrition table (and barcode) from photos of the package. In-chat build only. */
export async function readProductPhotos(photos: Blob[]): Promise<LabelResult> {
  const sample = await cap("sample");
  if (!sample) return { ok: false, error: "not_allowed" };
  try {
    const parsed = Label.safeParse(await sample.json(LABEL_PROMPT, { images: photos, modelTier: "default" }));
    if (!parsed.success) return { ok: false, error: "unreadable" };
    const l = parsed.data;
    if (!l.found_table || !(l.per100.kcal > 0)) return { ok: false, error: "no_table" };
    const digits = l.barcode?.replace(/\D/g, "") ?? "";
    return {
      ok: true,
      product: {
        barcode: digits.length >= 8 ? digits : null,
        nameHe: l.name_he.trim() || "מוצר",
        brand: l.brand?.trim() || null,
        per100: { kcal: Math.round(l.per100.kcal), protein: r1(l.per100.protein), carbs: r1(l.per100.carbs), fat: r1(l.per100.fat), fiber: l.per100.fiber == null ? null : r1(l.per100.fiber) },
        servings: l.serving_grams && l.serving_grams > 0 ? [{ nameHe: "מנה", grams: Math.round(l.serving_grams) }] : [],
        notes: l.notes_he ?? "",
      },
    };
  } catch (e) {
    return { ok: false, error: sampleError(e) };
  }
}

/** Offers a file to save: the downloads capability in the chat, a plain download on the web. */
export async function saveFile(filename: string, text: string, type = "application/json"): Promise<boolean> {
  if (IS_ARTIFACT) {
    const downloads = await cap("downloads");
    if (!downloads) return false;
    try {
      await downloads.save({ filename, data: new Blob([text], { type }) });
      return true;
    } catch {
      return false;
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
