import type { Outcome } from "./providers.js";
import type { ProviderId, TaskId } from "./registry.js";

// Usage seen by this server instance since it started. Serverless instances are recycled,
// so these numbers cover recent traffic only; the dashboard says so.

export interface UsageEvent {
  at: number;
  provider: ProviderId;
  model: string;
  task: TaskId | "probe";
  outcome: Outcome;
  status?: number;
  ms: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  limits?: Record<string, string>;
  error?: string;
}

export interface ProviderUsage {
  requests: number;
  ok: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  avgMs: number;
  lastLimits?: Record<string, string>;
  lastLimitsAt?: number;
}

const MAX_EVENTS = 200;
const events: UsageEvent[] = [];
const totals = new Map<ProviderId, ProviderUsage>();
const startedAt = Date.now();

export function record(e: Omit<UsageEvent, "at">): void {
  const ev = { ...e, at: Date.now() };
  events.push(ev);
  if (events.length > MAX_EVENTS) events.shift();
  const t = totals.get(e.provider) ?? { requests: 0, ok: 0, failed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, avgMs: 0 };
  t.avgMs = (t.avgMs * t.requests + e.ms) / (t.requests + 1);
  t.requests += 1;
  if (e.outcome === "ok") t.ok += 1;
  else t.failed += 1;
  t.inputTokens += e.inputTokens;
  t.outputTokens += e.outputTokens;
  t.costUsd += e.costUsd;
  if (e.limits) {
    t.lastLimits = e.limits;
    t.lastLimitsAt = ev.at;
  }
  totals.set(e.provider, t);
}

export function snapshot() {
  return {
    since: startedAt,
    totals: Object.fromEntries(totals),
    recentErrors: events.filter((e) => e.outcome !== "ok").slice(-20).reverse(),
    recent: events.slice(-20).reverse(),
  };
}

export function resetUsage(): void {
  events.length = 0;
  totals.clear();
}
