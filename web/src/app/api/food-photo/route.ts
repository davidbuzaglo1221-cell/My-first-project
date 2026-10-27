import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { FoodPhotoResult, type FoodPhotoResponse } from "@/lib/food-photo-schema";

// Estimates the foods in a meal photo with Claude (vision + structured output).
// Server-only: the API key never reaches the browser.
//   ANTHROPIC_API_KEY  required
//   APP_ACCESS_TOKEN   requests must send it in `x-app-token`, so a deployed URL cannot be
//                      used to spend the key by strangers. Required on Vercel; optional locally.

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  image: z.string().min(100).max(4_000_000), // base64, no data: prefix (~3 MB image)
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  hint: z.string().max(300).optional(),
});

const SYSTEM = `You estimate the nutrition of a meal from one photo, for a Hebrew-language food diary used in Israel.

Return every distinct food you can see as its own item. Name items in natural Israeli Hebrew, the way people order or cook them (for example "חזה עוף בגריל", "אורז לבן", "סלט ירקות", "חומוס", "פיתה"). Give the dish a short Hebrew name.

Estimate the edible weight in grams of each item as served (cooked weight for cooked foods), using visual cues for scale: a standard dinner plate is about 26 cm across, a fork about 19 cm, a pita about 16 cm. Then give calories, protein, carbohydrates and fat for that weight, consistent with typical values per 100 g; calories should roughly equal 4×protein + 4×carbs + 9×fat.

Include cooking fat only when you can see the food was fried or dressed, and say so in the notes. Do not invent hidden items. If a portion is partly hidden or the scale is unclear, lower the confidence for that item rather than guessing confidently.

If the user adds a note (for example "בלי שמן" or "2 ביצים"), trust it over the photo.

If the photo does not show food or drink, set is_food to false and return no items. Write notes_he in one or two short Hebrew sentences, addressed to the user: what to check or correct. Leave it empty when there is nothing worth saying.`;

function json(body: FoodPhotoResponse, status: number) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ ok: false, error: "not_configured" }, 503);
  }
  const required = process.env.APP_ACCESS_TOKEN;
  if (!required && process.env.VERCEL) {
    return json({ ok: false, error: "not_configured" }, 503);
  }
  if (required && request.headers.get("x-app-token") !== required) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // If a safety classifier declines, the API retries on the recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(FoodPhotoResult) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: body.mediaType, data: body.image } },
            {
              type: "text",
              text: body.hint?.trim() ? `הערה מהמשתמש: ${body.hint.trim()}` : "מה יש בצלחת?",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") return json({ ok: false, error: "refused" }, 422);
    const parsed = response.parsed_output;
    if (!parsed) return json({ ok: false, error: "unreadable" }, 502);

    // Clean up model numbers: no negatives, sensible rounding.
    const items = parsed.items
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

    return json({ ok: true, result: { ...parsed, items } }, 200);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json({ ok: false, error: "bad_key" }, 503);
    if (error instanceof Anthropic.RateLimitError) return json({ ok: false, error: "busy" }, 429);
    if (error instanceof Anthropic.BadRequestError) return json({ ok: false, error: "bad_request" }, 400);
    if (error instanceof Anthropic.APIConnectionError) return json({ ok: false, error: "upstream" }, 502);
    if (error instanceof Anthropic.APIError) return json({ ok: false, error: "upstream" }, 502);
    throw error;
  }
}
