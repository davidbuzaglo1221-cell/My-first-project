import { z } from "zod";

// Shared by the API route (as Claude's output schema) and the photo screen (as the response type).

export const FoodPhotoItem = z.object({
  name_he: z.string(),
  grams: z.number(),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
});

export const FoodPhotoResult = z.object({
  is_food: z.boolean(),
  dish_name_he: z.string(),
  items: z.array(FoodPhotoItem),
  notes_he: z.string(),
});

export type FoodPhotoItem = z.infer<typeof FoodPhotoItem>;
export type FoodPhotoResult = z.infer<typeof FoodPhotoResult>;

export type FoodPhotoError =
  | "not_configured" // no ANTHROPIC_API_KEY on the server
  | "bad_key"
  | "unauthorized" // APP_ACCESS_TOKEN set and missing or wrong in the app
  | "bad_request"
  | "refused"
  | "unreadable"
  | "busy"
  | "upstream";

export type FoodPhotoResponse = { ok: true; result: FoodPhotoResult } | { ok: false; error: FoodPhotoError };
