import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { FoodPhotoResult, type FoodPhotoResponse } from "@/lib/food-photo-schema";
import { cleanItems, MEAL_PHOTO_SYSTEM as SYSTEM } from "@/lib/food-photo-prompt";

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

    const items = cleanItems(parsed.items);
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
