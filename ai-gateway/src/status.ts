import { defaultDeps, outcomeOfStatus, pickLimits, type Deps, type Outcome } from "./providers.js";
import { baseUrlOf, PROVIDERS, TASKS, unavailableReason, type Env, type ProviderId } from "./registry.js";
import { snapshot } from "./usage.js";

// A live check of every provider: is a key set, does the key work, what quota is left.
// Probes list models only, so they spend no tokens.

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  paid: boolean;
  trainsOnData: boolean;
  keyless: boolean;
  freeTier: string;
  note?: string;
  signupUrl?: string;
  keyEnv?: string;
  state: "ok" | "error" | "not_configured" | "off";
  reason?: string;
  outcome?: Outcome;
  status?: number;
  ms?: number;
  limits?: Record<string, string>;
  /** Provider-reported usage (OpenRouter credits, FreeLLMAPI monthly totals). */
  account?: Record<string, unknown>;
}

async function probe(id: ProviderId, env: Env, deps: Deps): Promise<Partial<ProviderStatus>> {
  const p = PROVIDERS[id];
  const signal = AbortSignal.timeout(10_000);
  const t0 = Date.now();
  try {
    if (p.kind === "anthropic") {
      const client = deps.anthropic(env[p.keyEnv!]!);
      await client.models.list({ limit: 1 }, { signal });
      return { state: "ok", outcome: "ok", ms: Date.now() - t0 };
    }
    const base = baseUrlOf(p, env)!;
    const key = p.keyEnv ? env[p.keyEnv] : undefined;
    const headers: Record<string, string> = { "user-agent": "ai-gateway/1.0" };
    if (key) headers.authorization = `Bearer ${key}`;
    const res = await deps.fetch(`${base}/models`, { headers, signal });
    const ms = Date.now() - t0;
    const out: Partial<ProviderStatus> = { status: res.status, ms, limits: pickLimits(res.headers) };
    await res.body?.cancel().catch(() => {});
    if (!res.ok) return { ...out, state: "error", outcome: outcomeOfStatus(res.status) };
    out.state = "ok";
    out.outcome = "ok";
    if (id === "openrouter") {
      const r = await deps.fetch(`${base}/key`, { headers, signal });
      if (r.ok) out.account = ((await r.json()) as { data?: Record<string, unknown> }).data;
    }
    if (id === "freellmapi") {
      const r = await deps.fetch(`${base}/usage`, { headers, signal });
      if (r.ok) {
        const u = (await r.json()) as Record<string, unknown>;
        out.account = { month: u.month, requests: u.requests, tokens: u.tokens, resetsAt: u.resetsAt, byPlatform: u.byPlatform };
      }
    }
    return out;
  } catch (e) {
    const name = (e as Error)?.name;
    const status = (e as { status?: number })?.status;
    if (typeof status === "number") return { state: "error", status, outcome: outcomeOfStatus(status), ms: Date.now() - t0 };
    return {
      state: "error",
      outcome: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network",
      reason: String((e as Error)?.message ?? e).slice(0, 200),
      ms: Date.now() - t0,
    };
  }
}

export async function providerStatuses(env: Env, deps: Deps = defaultDeps): Promise<ProviderStatus[]> {
  return Promise.all(
    (Object.keys(PROVIDERS) as ProviderId[]).map(async (id) => {
      const p = PROVIDERS[id];
      const base: ProviderStatus = {
        id,
        label: p.label,
        paid: p.paid,
        trainsOnData: p.trainsOnData,
        keyless: !!p.keyless,
        freeTier: p.freeTier,
        note: p.note,
        signupUrl: p.signupUrl,
        keyEnv: p.keyEnv,
        state: "not_configured",
      };
      const why = unavailableReason(p, env);
      if (why === "keyless_off") return { ...base, state: "off", reason: why };
      if (why) return { ...base, reason: why };
      return { ...base, ...(await probe(id, env, deps)) };
    }),
  );
}

export async function fullStatus(env: Env, deps: Deps = defaultDeps) {
  return {
    checkedAt: Date.now(),
    providers: await providerStatuses(env, deps),
    tasks: Object.values(TASKS).map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      chain: t.chain.map((r) => ({ provider: r.provider, model: r.model, vision: !!r.vision, price: r.price ?? null })),
    })),
    usage: snapshot(),
  };
}
