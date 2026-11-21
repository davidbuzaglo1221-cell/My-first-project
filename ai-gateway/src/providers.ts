import Anthropic from "@anthropic-ai/sdk";
import { baseUrlOf, type Env, type ModelRef, type Provider } from "./registry.js";

export type Part = { type: "text"; text: string } | { type: "image"; mediaType: string; data: string };
export interface ChatMessage {
  role: "user" | "assistant";
  content: string | Part[];
}
export interface ChatInput {
  system?: string;
  messages: ChatMessage[];
  json?: boolean;
  maxTokens?: number;
}

export type Outcome =
  | "ok"
  | "bad_key"
  | "rate_limited"
  | "model_unavailable"
  | "bad_request"
  | "upstream"
  | "timeout"
  | "network"
  | "empty"
  | "invalid_json"
  | "refused";

export interface CallResult {
  outcome: Outcome;
  status?: number;
  text?: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Rate-limit headers the provider sent back (remaining quota). */
  limits?: Record<string, string>;
  error?: string;
}

export interface Deps {
  fetch: typeof fetch;
  anthropic: (apiKey: string) => Pick<Anthropic, "beta" | "models">;
}

export const defaultDeps: Deps = {
  fetch: (...a) => fetch(...a),
  anthropic: (apiKey) => new Anthropic({ apiKey, maxRetries: 0 }),
};

const LIMIT_HEADER = /^(x-ratelimit-|anthropic-ratelimit-|retry-after$)/i;

export function pickLimits(headers: Headers | undefined): Record<string, string> | undefined {
  if (!headers) return undefined;
  const out: Record<string, string> = {};
  headers.forEach((v, k) => {
    if (LIMIT_HEADER.test(k)) out[k.toLowerCase()] = v;
  });
  return Object.keys(out).length ? out : undefined;
}

export function outcomeOfStatus(status: number): Outcome {
  if (status === 401 || status === 403) return "bad_key";
  if (status === 429) return "rate_limited";
  if (status === 404) return "model_unavailable";
  if (status === 408) return "timeout";
  if (status >= 500) return "upstream";
  return "bad_request";
}

const JSON_RULE = "Reply with one valid JSON value only: no prose, no code fences.";

/** The text with code fences removed, if it parses as JSON; otherwise null. */
export function asJson(text: string): string | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    JSON.parse(t);
    return t;
  } catch {
    return null;
  }
}

function finish(text: string | undefined, input: ChatInput, base: CallResult): CallResult {
  const clean = (text ?? "").trim();
  if (!clean) return { ...base, outcome: "empty", text: undefined };
  if (input.json) {
    const j = asJson(clean);
    if (j === null) return { ...base, outcome: "invalid_json", text: undefined, error: "response was not valid JSON" };
    return { ...base, outcome: "ok", text: j };
  }
  return { ...base, outcome: "ok", text: clean };
}

function systemText(input: ChatInput): string | undefined {
  const parts = [input.system, input.json ? JSON_RULE : undefined].filter(Boolean);
  return parts.length ? parts.join("\n\n") : undefined;
}

async function callClaude(ref: ModelRef, input: ChatInput, apiKey: string, deps: Deps, signal: AbortSignal): Promise<CallResult> {
  const client = deps.anthropic(apiKey);
  const messages: Anthropic.Beta.BetaMessageParam[] = input.messages.map((m) => ({
    role: m.role,
    content:
      typeof m.content === "string"
        ? m.content
        : m.content.map((p): Anthropic.Beta.BetaContentBlockParam =>
            p.type === "text"
              ? { type: "text", text: p.text }
              : {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: p.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                    data: p.data,
                  },
                },
          ),
  }));
  const system = systemText(input);
  try {
    const res = await client.beta.messages.create(
      {
        model: ref.model,
        max_tokens: input.maxTokens ?? 16000,
        // If a safety classifier declines, the API retries on its recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        ...(system ? { system } : {}),
        messages,
      },
      { signal },
    );
    const base: CallResult = {
      outcome: "ok",
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    };
    if (res.stop_reason === "refusal") return { ...base, outcome: "refused", error: "Claude declined" };
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return finish(text, input, base);
  } catch (e) {
    if (e instanceof Anthropic.APIConnectionTimeoutError) return { outcome: "timeout", error: "timeout" };
    if (e instanceof Anthropic.APIUserAbortError) return { outcome: "timeout", error: "deadline reached" };
    if (e instanceof Anthropic.APIConnectionError) return { outcome: "network", error: e.message };
    if (e instanceof Anthropic.APIError && typeof e.status === "number") {
      return { outcome: outcomeOfStatus(e.status), status: e.status, limits: pickLimits(e.headers), error: e.message.slice(0, 300) };
    }
    return { outcome: "network", error: String((e as Error)?.message ?? e).slice(0, 300) };
  }
}

type OpenAIPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

async function callOpenAI(p: Provider, ref: ModelRef, input: ChatInput, env: Env, deps: Deps, signal: AbortSignal): Promise<CallResult> {
  const base = baseUrlOf(p, env)!;
  const key = p.keyEnv ? env[p.keyEnv] : undefined;
  const system = systemText(input);
  const messages: { role: string; content: string | OpenAIPart[] }[] = [];
  if (system) messages.push({ role: "system", content: system });
  for (const m of input.messages) {
    messages.push({
      role: m.role,
      content:
        typeof m.content === "string"
          ? m.content
          : m.content.map((x): OpenAIPart =>
              x.type === "text" ? x : { type: "image_url", image_url: { url: `data:${x.mediaType};base64,${x.data}` } },
            ),
    });
  }
  const body: Record<string, unknown> = { model: ref.model, messages, max_tokens: input.maxTokens ?? 4096, stream: false };
  if (input.json) body.response_format = { type: "json_object" };
  const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "ai-gateway/1.0" };
  if (key) headers.authorization = `Bearer ${key}`;
  let res: Response;
  try {
    res = await deps.fetch(`${base}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") return { outcome: "timeout", error: "timeout" };
    return { outcome: "network", error: String((e as Error)?.message ?? e).slice(0, 300) };
  }
  const limits = pickLimits(res.headers);
  const raw = await res.text().catch(() => "");
  if (!res.ok) return { outcome: outcomeOfStatus(res.status), status: res.status, limits, error: raw.slice(0, 300) };
  let data: {
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
  };
  try {
    data = JSON.parse(raw);
  } catch {
    return { outcome: "upstream", status: res.status, limits, error: "unreadable response" };
  }
  // Some gateways answer HTTP 200 with an error body.
  if (data.error && !data.choices) return { outcome: "upstream", status: res.status, limits, error: data.error.message?.slice(0, 300) };
  return finish(data.choices?.[0]?.message?.content ?? undefined, input, {
    outcome: "ok",
    status: res.status,
    limits,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });
}

export function callModel(p: Provider, ref: ModelRef, input: ChatInput, env: Env, deps: Deps, signal: AbortSignal): Promise<CallResult> {
  if (p.kind === "anthropic") return callClaude(ref, input, env[p.keyEnv!]!, deps, signal);
  return callOpenAI(p, ref, input, env, deps, signal);
}
