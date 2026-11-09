import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { COACH_SYSTEM } from "@/lib/journey/coach-prompt";

// The coach on a server (the web build): the page sends the prompt, Claude answers in JSON, and
// the page validates the shape. Same guard as the photo route: the key stays here, and a deployed
// URL answers only requests that carry APP_ACCESS_TOKEN.

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ prompt: z.string().min(10).max(40_000), tier: z.enum(["quick", "default", "complex"]) });

const json = (body: unknown, status: number) => Response.json(body, { status });

/** The first {...} block of a reply, parsed. */
function firstJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: "not_configured" }, 503);
  const required = process.env.APP_ACCESS_TOKEN;
  if (!required && process.env.VERCEL) return json({ ok: false, error: "not_configured" }, 503);
  if (required && request.headers.get("x-app-token") !== required) return json({ ok: false, error: "not_allowed" }, 401);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return json({ ok: false, error: "unreadable" }, 400);
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: body.tier === "quick" ? "claude-haiku-5-5" : "claude-opus-5-5",
      max_tokens: 4000,
      system: COACH_SYSTEM,
      messages: [{ role: "user", content: body.prompt }],
    });
    if (response.stop_reason === "refusal") return json({ ok: false, error: "refused" }, 422);
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try {
      return json({ ok: true, data: firstJson(text) }, 200);
    } catch {
      return json({ ok: false, error: "unreadable" }, 502);
    }
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ ok: false, error: "busy" }, 429);
    if (error instanceof Anthropic.APIError) return json({ ok: false, error: "upstream" }, 502);
    throw error;
  }
}
