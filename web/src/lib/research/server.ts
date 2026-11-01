import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { ApiError } from "./schema";

// Server-only helpers for the research routes: the access gate, the Claude call, and error mapping.
//   ANTHROPIC_API_KEY  required for every research step
//   APP_ACCESS_TOKEN   same gate as the photo route: requests must send it in `x-app-token`

/** Claude model for every research step. Opus 5.5 is the default for this app. */
export const RESEARCH_MODEL = "claude-opus-5-5";

export class ResearchError extends Error {
  constructor(public code: ApiError) {
    super(code);
  }
}

export function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status });
}

export function failure(error: ApiError): Response {
  const status: Record<ApiError, number> = {
    not_configured: 503,
    unauthorized: 401,
    bad_key: 503,
    bad_request: 400,
    busy: 429,
    refused: 422,
    unreadable: 502,
    upstream: 502,
  };
  return json({ ok: false, error }, status[error]);
}

/** Null when the request may proceed; otherwise the response to send back. */
export function gate(request: Request): Response | null {
  const required = process.env.APP_ACCESS_TOKEN;
  if (!required && process.env.VERCEL) return failure("not_configured");
  if (required && request.headers.get("x-app-token") !== required) return failure("unauthorized");
  return null;
}

/** Parses a JSON body against a schema, or null when it does not match. */
export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S> | null> {
  try {
    const parsed = schema.safeParse(await request.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * One structured Claude call. The reply is validated against the schema by the SDK.
 * Refusals and unreadable replies become ResearchError so the route can answer clearly.
 */
export async function askClaude<S extends z.ZodType>(options: {
  system: string;
  user: string;
  schema: S;
  effort: "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  if (!process.env.ANTHROPIC_API_KEY) throw new ResearchError("not_configured");
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: RESEARCH_MODEL,
      max_tokens: options.maxTokens ?? 16000,
      // If a safety classifier declines, the API retries on the recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: options.effort, format: betaZodOutputFormat(options.schema) },
      system: options.system,
      messages: [{ role: "user", content: options.user }],
    });
    if (response.stop_reason === "refusal") throw new ResearchError("refused");
    if (!response.parsed_output) throw new ResearchError("unreadable");
    return response.parsed_output as z.infer<S>;
  } catch (error) {
    if (error instanceof ResearchError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new ResearchError("bad_key");
    if (error instanceof Anthropic.RateLimitError) throw new ResearchError("busy");
    if (error instanceof Anthropic.BadRequestError) throw new ResearchError("bad_request");
    if (error instanceof Anthropic.APIError) throw new ResearchError("upstream");
    throw error;
  }
}

/** Maps any thrown error from a route body to an API error response. */
export function routeError(error: unknown): Response {
  if (error instanceof ResearchError) return failure(error.code);
  return failure("upstream");
}
