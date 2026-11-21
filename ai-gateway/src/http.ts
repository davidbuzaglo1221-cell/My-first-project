import { timingSafeEqual } from "node:crypto";
import { defaultDeps, type ChatMessage, type Deps, type Part } from "./providers.js";
import { TASKS, type Env, type TaskId } from "./registry.js";
import { route } from "./router.js";
import { fullStatus } from "./status.js";

// Web-standard handlers shared by the Vercel functions and the local dev server.
// Every API key stays on the server: browsers send only the app access code.

const DEFAULT_ORIGINS = ["https://davidbuzaglo1221-cell.github.io", "http://localhost:5173", "http://localhost:3000"];

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()) : DEFAULT_ORIGINS;
  const h: Record<string, string> = { vary: "origin", "cache-control": "no-store" };
  if (origin && allowed.includes(origin)) {
    h["access-control-allow-origin"] = origin;
    h["access-control-allow-headers"] = "content-type, x-app-token, authorization";
    h["access-control-allow-methods"] = "GET, POST, OPTIONS";
  }
  return h;
}

function json(request: Request, env: Env, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request, env) });
}

export function tokenOf(request: Request): string {
  const t = request.headers.get("x-app-token");
  if (t) return t;
  const a = request.headers.get("authorization") ?? "";
  return a.toLowerCase().startsWith("bearer ") ? a.slice(7).trim() : "";
}

/** null when allowed, otherwise the response to send. */
export function checkAccess(request: Request, env: Env): Response | null {
  const required = env.APP_ACCESS_TOKEN;
  if (!required || required.length < 16) return json(request, env, { ok: false, error: "not_configured" }, 503);
  const given = Buffer.from(tokenOf(request));
  const want = Buffer.from(required);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return json(request, env, { ok: false, error: "unauthorized" }, 401);
  return null;
}

const MAX_TEXT = 200_000;
const MAX_IMAGE_B64 = 7_000_000;

function parseParts(v: unknown): Part[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 20) return null;
  const out: Part[] = [];
  for (const p of v) {
    if (p?.type === "text" && typeof p.text === "string" && p.text.length <= MAX_TEXT) out.push({ type: "text", text: p.text });
    else if (
      p?.type === "image" &&
      typeof p.data === "string" &&
      p.data.length <= MAX_IMAGE_B64 &&
      ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(p.mediaType)
    )
      out.push({ type: "image", mediaType: p.mediaType, data: p.data });
    else return null;
  }
  return out;
}

export function parseChatBody(b: unknown) {
  const o = b as Record<string, unknown>;
  if (!o || typeof o !== "object") return null;
  if (typeof o.task !== "string" || !(o.task in TASKS)) return null;
  if (!Array.isArray(o.messages) || o.messages.length === 0 || o.messages.length > 60) return null;
  const messages: ChatMessage[] = [];
  for (const m of o.messages as Record<string, unknown>[]) {
    if (m?.role !== "user" && m?.role !== "assistant") return null;
    if (typeof m.content === "string") {
      if (!m.content || m.content.length > MAX_TEXT) return null;
      messages.push({ role: m.role, content: m.content });
    } else {
      const parts = parseParts(m.content);
      if (!parts) return null;
      messages.push({ role: m.role, content: parts });
    }
  }
  if (messages[messages.length - 1].role !== "user") return null;
  if (o.system !== undefined && (typeof o.system !== "string" || o.system.length > MAX_TEXT)) return null;
  const maxTokens = o.maxTokens === undefined ? undefined : Number(o.maxTokens);
  if (maxTokens !== undefined && !(Number.isInteger(maxTokens) && maxTokens >= 1 && maxTokens <= 16000)) return null;
  return {
    task: o.task as TaskId,
    messages,
    system: o.system as string | undefined,
    json: o.json === true,
    private: o.private === true,
    maxTokens,
  };
}

export function handleOptions(request: Request, env: Env): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function handleChat(request: Request, env: Env, deps: Deps = defaultDeps): Promise<Response> {
  const denied = checkAccess(request, env);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(request, env, { ok: false, error: "bad_request" }, 400);
  }
  const req = parseChatBody(body);
  if (!req) return json(request, env, { ok: false, error: "bad_request" }, 400);
  const result = await route(req, env, { deps });
  if (result.ok) return json(request, env, result, 200);
  return json(request, env, result, result.error === "no_providers" ? 503 : 502);
}

export async function handleStatus(request: Request, env: Env, deps: Deps = defaultDeps): Promise<Response> {
  const denied = checkAccess(request, env);
  if (denied) return denied;
  return json(request, env, await fullStatus(env, deps));
}
