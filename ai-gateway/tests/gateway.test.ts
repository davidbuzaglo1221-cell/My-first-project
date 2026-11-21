import { beforeEach, describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { asJson, outcomeOfStatus, type Deps } from "../src/providers.js";
import { baseUrlOf, costOf, PROVIDERS, TASKS, unavailableReason } from "../src/registry.js";
import { plan, route } from "../src/router.js";
import { checkAccess, handleChat, handleStatus, parseChatBody } from "../src/http.js";
import { resetUsage, snapshot } from "../src/usage.js";

const TOKEN = "t".repeat(32);
type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | Error;

/** A fake network: answers by URL substring, records every call. */
function fakeDeps(replies: Record<string, Reply>, claude?: () => Promise<unknown>) {
  const calls: { url: string; body?: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const deps: Deps = {
    fetch: (async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body, headers: (init?.headers ?? {}) as Record<string, string> });
      const key = Object.keys(replies).find((k) => url.includes(k));
      const r = key ? replies[key] : { status: 404, body: { error: "no route" } };
      if (r instanceof Error) throw r;
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: r.headers });
    }) as typeof fetch,
    anthropic: () =>
      ({
        beta: { messages: { create: claude ?? (async () => { throw new Error("claude not expected"); }) } },
        models: { list: async () => ({ data: [] }) },
      }) as unknown as Pick<Anthropic, "beta" | "models">,
  };
  return { deps, calls };
}

const okChat = (text: string) => ({
  status: 200,
  body: { choices: [{ message: { content: text } }], usage: { prompt_tokens: 10, completion_tokens: 5 } },
  headers: { "x-ratelimit-remaining-requests": "29", "content-type": "application/json" },
});

const ask = (text = "שלום") => ({ task: "hebrew" as const, messages: [{ role: "user" as const, content: text }] });

beforeEach(() => resetUsage());

describe("registry", () => {
  it("keeps Claude first in every task (house rule)", () => {
    for (const t of Object.values(TASKS)) expect(t.chain[0].provider).toBe("claude");
  });
  it("only references known providers, and vision tasks only vision models", () => {
    for (const t of Object.values(TASKS)) {
      for (const r of t.chain) expect(PROVIDERS[r.provider]).toBeDefined();
      if (t.needsVision) for (const r of t.chain) expect(r.vision).toBe(true);
    }
  });
  it("prices Claude and nothing else", () => {
    expect(costOf(TASKS.hebrew.chain[0], 1_000_000, 1_000_000)).toBe(24);
    expect(costOf({ provider: "groq", model: "x" }, 1e6, 1e6)).toBe(0);
  });
  it("adds /v1 to the FreeLLMAPI origin", () => {
    expect(baseUrlOf(PROVIDERS.freellmapi, { FREELLMAPI_URL: "https://r.example.com/" })).toBe("https://r.example.com/v1");
    expect(baseUrlOf(PROVIDERS.freellmapi, { FREELLMAPI_URL: "https://r.example.com/v1" })).toBe("https://r.example.com/v1");
  });
  it("keeps keyless providers off unless allowed", () => {
    expect(unavailableReason(PROVIDERS.kilo, {})).toBe("keyless_off");
    expect(unavailableReason(PROVIDERS.kilo, { ALLOW_KEYLESS: "1" })).toBeNull();
    expect(unavailableReason(PROVIDERS.groq, {})).toBe("no_key");
    expect(unavailableReason(PROVIDERS.freellmapi, { FREELLMAPI_KEY: "k" })).toBe("no_url");
  });
});

describe("router", () => {
  it("uses Claude when it is configured and answers", async () => {
    const { deps, calls } = fakeDeps({}, async () => ({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "שלום לך" }],
      usage: { input_tokens: 100, output_tokens: 50 },
    }));
    const r = await route(ask(), { ANTHROPIC_API_KEY: "k", GROQ_API_KEY: "g" }, { deps });
    expect(r.ok).toBe(true);
    expect(r.servedBy?.provider).toBe("claude");
    expect(r.fellBack).toBe(false);
    expect(r.costUsd).toBeCloseTo((100 * 4 + 50 * 20) / 1e6);
    expect(calls).toHaveLength(0);
  });

  it("falls back to the next provider when Claude is rate limited", async () => {
    const { deps } = fakeDeps({ "api.groq.com": okChat("תשובה") }, async () => {
      throw new Anthropic.RateLimitError(429, { type: "error" }, "rate limited", new Headers());
    });
    const r = await route(ask(), { ANTHROPIC_API_KEY: "k", GROQ_API_KEY: "g" }, { deps });
    expect(r.ok).toBe(true);
    expect(r.servedBy?.provider).toBe("groq");
    expect(r.fellBack).toBe(true);
    expect(r.attempts.find((a) => a.provider === "claude")?.outcome).toBe("rate_limited");
    expect(r.costUsd).toBe(0);
  });

  it("walks the chain past 429, 5xx, bad keys and network errors", async () => {
    const { deps } = fakeDeps({
      "generativelanguage.googleapis.com": { status: 429, body: {} },
      "api.groq.com": { status: 503, body: {} },
      "openrouter.ai": { status: 401, body: {} },
      "oai.endpoints.kepler": new TypeError("fetch failed"),
      "api.kilo.ai": okChat("הגיע"),
    });
    const env = { GEMINI_API_KEY: "a", GROQ_API_KEY: "b", OPENROUTER_API_KEY: "c", ALLOW_KEYLESS: "1" };
    const r = await route(ask(), env, { deps });
    expect(r.ok).toBe(true);
    expect(r.servedBy?.provider).toBe("kilo");
    const o = Object.fromEntries(r.attempts.map((a) => [a.provider, a.outcome]));
    expect(o).toMatchObject({ claude: "no_key", freellmapi: "no_url", gemini: "rate_limited", groq: "upstream", openrouter: "bad_key", ovh: "network" });
  });

  it("reports no_providers when nothing is configured", async () => {
    const { deps } = fakeDeps({});
    const r = await route(ask(), {}, { deps });
    expect(r).toMatchObject({ ok: false, error: "no_providers" });
  });

  it("reports all_failed when every configured provider fails", async () => {
    const { deps } = fakeDeps({ "api.groq.com": { status: 500 } });
    const r = await route(ask(), { GROQ_API_KEY: "g" }, { deps });
    expect(r).toMatchObject({ ok: false, error: "all_failed" });
  });

  it("skips models that cannot see images when the request has one", () => {
    const req = {
      task: "hebrew" as const,
      messages: [{ role: "user" as const, content: [{ type: "image" as const, mediaType: "image/jpeg", data: "AAAA" }, { type: "text" as const, text: "מה זה?" }] }],
    };
    const steps = plan(req, { GROQ_API_KEY: "g", GEMINI_API_KEY: "x" });
    expect(steps.find((s) => s.ref.provider === "groq")?.skip).toBe("no_vision");
    expect(steps.find((s) => s.ref.provider === "gemini")?.skip).toBeUndefined();
  });

  it("skips providers that train on data for private requests", () => {
    const steps = plan({ ...ask(), private: true }, { GEMINI_API_KEY: "x", GROQ_API_KEY: "g", ALLOW_KEYLESS: "1" });
    expect(steps.find((s) => s.ref.provider === "gemini")?.skip).toBe("private");
    expect(steps.find((s) => s.ref.provider === "kilo")?.skip).toBe("private");
    const withRouter = plan({ ...ask(), private: true }, { FREELLMAPI_URL: "http://r", FREELLMAPI_KEY: "k" });
    expect(withRouter.find((s) => s.ref.provider === "freellmapi")?.skip).toBe("private");
    expect(steps.find((s) => s.ref.provider === "groq")?.skip).toBeUndefined();
  });

  it("rejects invalid JSON in json mode and moves on", async () => {
    const { deps } = fakeDeps({ "generativelanguage.googleapis.com": okChat("not json"), "api.groq.com": okChat('```json\n{"a":1}\n```') });
    const r = await route({ ...ask(), task: "json", json: true }, { GEMINI_API_KEY: "x", GROQ_API_KEY: "g" }, { deps });
    expect(r.servedBy?.provider).toBe("groq");
    expect(r.text).toBe('{"a":1}');
    expect(r.attempts.find((a) => a.provider === "gemini")?.outcome).toBe("invalid_json");
  });

  it("treats a Claude refusal as a reason to fall back", async () => {
    const { deps } = fakeDeps({ "api.groq.com": okChat("ok") }, async () => ({ stop_reason: "refusal", content: [], usage: { input_tokens: 5, output_tokens: 0 } }));
    const r = await route(ask(), { ANTHROPIC_API_KEY: "k", GROQ_API_KEY: "g" }, { deps });
    expect(r.attempts[0].outcome).toBe("refused");
    expect(r.servedBy?.provider).toBe("groq");
  });

  it("stops trying when the time budget runs out", async () => {
    let t = 0;
    const { deps } = fakeDeps({ "generativelanguage.googleapis.com": { status: 500 } });
    const r = await route(ask(), { GEMINI_API_KEY: "x", GROQ_API_KEY: "g" }, { deps, budgetMs: 10_000, now: () => (t += 4_000) });
    expect(r.attempts.some((a) => a.outcome === "deadline")).toBe(true);
  });

  it("sends keys only as headers and never in the body", async () => {
    const { deps, calls } = fakeDeps({ "api.groq.com": okChat("x") });
    await route(ask(), { GROQ_API_KEY: "secret-groq" }, { deps });
    expect(calls[0].headers.authorization).toBe("Bearer secret-groq");
    expect(JSON.stringify(calls[0].body)).not.toContain("secret-groq");
  });

  it("records usage, quotas and errors for the dashboard", async () => {
    const { deps } = fakeDeps({ "generativelanguage.googleapis.com": { status: 429 }, "api.groq.com": okChat("x") });
    await route(ask(), { GEMINI_API_KEY: "x", GROQ_API_KEY: "g" }, { deps });
    const s = snapshot();
    expect(s.totals.groq).toMatchObject({ requests: 1, ok: 1, inputTokens: 10, outputTokens: 5 });
    expect(s.totals.groq.lastLimits?.["x-ratelimit-remaining-requests"]).toBe("29");
    expect(s.recentErrors[0]).toMatchObject({ provider: "gemini", outcome: "rate_limited" });
  });
});

describe("http", () => {
  const req = (body: unknown, token = TOKEN, origin?: string) =>
    new Request("http://x/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-app-token": token, ...(origin ? { origin } : {}) },
      body: JSON.stringify(body),
    });

  it("refuses everything when no access code is set", async () => {
    expect(checkAccess(req({}), {})?.status).toBe(503);
  });
  it("refuses a wrong access code", async () => {
    expect(checkAccess(req({}, "wrong"), { APP_ACCESS_TOKEN: TOKEN })?.status).toBe(401);
  });
  it("accepts the code as a bearer token too", () => {
    const r = new Request("http://x", { headers: { authorization: `Bearer ${TOKEN}` } });
    expect(checkAccess(r, { APP_ACCESS_TOKEN: TOKEN })).toBeNull();
  });
  it("validates the body", () => {
    expect(parseChatBody({ task: "nope", messages: [{ role: "user", content: "x" }] })).toBeNull();
    expect(parseChatBody({ task: "hebrew", messages: [] })).toBeNull();
    expect(parseChatBody({ task: "hebrew", messages: [{ role: "assistant", content: "x" }] })).toBeNull();
    expect(parseChatBody({ task: "hebrew", messages: [{ role: "user", content: [{ type: "image", mediaType: "text/html", data: "x" }] }] })).toBeNull();
    expect(parseChatBody({ task: "hebrew", maxTokens: 99999, messages: [{ role: "user", content: "x" }] })).toBeNull();
    expect(parseChatBody({ task: "hebrew", messages: [{ role: "user", content: "x" }], private: true })).toMatchObject({ private: true });
  });
  it("answers a chat end to end and never echoes keys", async () => {
    const { deps } = fakeDeps({ "api.groq.com": okChat("שלום") });
    const res = await handleChat(req(ask()), { APP_ACCESS_TOKEN: TOKEN, GROQ_API_KEY: "secret-groq" }, deps);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ ok: true, text: "שלום", servedBy: { provider: "groq" } });
    expect(text).not.toContain("secret-groq");
  });
  it("allows CORS only for listed origins", async () => {
    const { deps } = fakeDeps({ "api.groq.com": okChat("x") });
    const env = { APP_ACCESS_TOKEN: TOKEN, GROQ_API_KEY: "g" };
    const good = await handleChat(req(ask(), TOKEN, "https://davidbuzaglo1221-cell.github.io"), env, deps);
    expect(good.headers.get("access-control-allow-origin")).toBe("https://davidbuzaglo1221-cell.github.io");
    const bad = await handleChat(req(ask(), TOKEN, "https://evil.example"), env, deps);
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });
  it("status lists every provider without leaking keys", async () => {
    const { deps } = fakeDeps({ "api.groq.com/openai/v1/models": { status: 200, body: { data: [] } } });
    const r = new Request("http://x/api/status", { headers: { "x-app-token": TOKEN } });
    const res = await handleStatus(r, { APP_ACCESS_TOKEN: TOKEN, GROQ_API_KEY: "secret-groq" }, deps);
    const text = await res.text();
    expect(text).not.toContain("secret-groq");
    const s = JSON.parse(text);
    const byId = Object.fromEntries(s.providers.map((p: { id: string }) => [p.id, p]));
    expect(byId.groq.state).toBe("ok");
    expect(byId.claude.state).toBe("not_configured");
    expect(byId.kilo.state).toBe("off");
    expect(s.tasks).toHaveLength(Object.keys(TASKS).length);
  });
});

describe("helpers", () => {
  it("maps HTTP statuses", () => {
    expect([401, 403, 404, 408, 429, 500, 400].map(outcomeOfStatus)).toEqual(["bad_key", "bad_key", "model_unavailable", "timeout", "rate_limited", "upstream", "bad_request"]);
  });
  it("extracts JSON from fenced replies", () => {
    expect(asJson('```json\n[1,2]\n```')).toBe("[1,2]");
    expect(asJson("hello")).toBeNull();
  });
});
