import { callModel, defaultDeps, type ChatInput, type Deps, type Outcome } from "./providers.js";
import { costOf, PROVIDERS, TASKS, unavailableReason, type Env, type ModelRef, type ProviderId, type TaskId } from "./registry.js";
import { record } from "./usage.js";

export interface RouteRequest extends ChatInput {
  task: TaskId;
  /** Skip providers that may keep prompts for training. Use for anything personal. */
  private?: boolean;
}

export type SkipReason = "no_key" | "keyless_off" | "no_url" | "no_vision" | "private" | "deadline";

export interface Attempt {
  provider: ProviderId;
  model: string;
  outcome: Outcome | SkipReason;
  status?: number;
  ms?: number;
  error?: string;
}

export interface RouteResult {
  ok: boolean;
  text?: string;
  servedBy?: { provider: ProviderId; model: string; label: string; paid: boolean };
  /** True when the first usable model in the chain did not answer. */
  fellBack: boolean;
  usage?: { inputTokens: number; outputTokens: number };
  costUsd: number;
  attempts: Attempt[];
  error?: "no_providers" | "all_failed";
}

export interface RouteOptions {
  deps?: Deps;
  /** Total time budget across attempts (the serverless limit is 60 s). */
  budgetMs?: number;
  /** Time limit for one attempt. */
  attemptMs?: number;
  now?: () => number;
}

export function hasImage(req: ChatInput): boolean {
  return req.messages.some((m) => typeof m.content !== "string" && m.content.some((p) => p.type === "image"));
}

/** Which models of the chain would be tried, in order, and why the others are skipped. */
export function plan(req: RouteRequest, env: Env): { ref: ModelRef; skip?: SkipReason }[] {
  const task = TASKS[req.task];
  const needsVision = task.needsVision || hasImage(req);
  return task.chain.map((ref) => {
    const p = PROVIDERS[ref.provider];
    const why = unavailableReason(p, env);
    if (why) return { ref, skip: why };
    if (needsVision && !ref.vision) return { ref, skip: "no_vision" };
    if (req.private && p.trainsOnData) return { ref, skip: "private" };
    return { ref };
  });
}

export async function route(req: RouteRequest, env: Env, opts: RouteOptions = {}): Promise<RouteResult> {
  const deps = opts.deps ?? defaultDeps;
  const now = opts.now ?? Date.now;
  const budget = opts.budgetMs ?? 55_000;
  const perAttempt = opts.attemptMs ?? 40_000;
  const start = now();
  const attempts: Attempt[] = [];
  const steps = plan(req, env);
  let firstUsable = true;

  for (const { ref, skip } of steps) {
    if (skip) {
      attempts.push({ provider: ref.provider, model: ref.model, outcome: skip });
      continue;
    }
    const left = budget - (now() - start);
    if (left < 3_000) {
      attempts.push({ provider: ref.provider, model: ref.model, outcome: "deadline" });
      continue;
    }
    const p = PROVIDERS[ref.provider];
    const t0 = now();
    const r = await callModel(p, ref, req, env, deps, AbortSignal.timeout(Math.min(perAttempt, left)));
    const ms = now() - t0;
    attempts.push({ provider: ref.provider, model: ref.model, outcome: r.outcome, status: r.status, ms, error: r.error });
    const inT = r.inputTokens ?? 0;
    const outT = r.outputTokens ?? 0;
    const cost = r.outcome === "ok" || r.inputTokens ? costOf(ref, inT, outT) : 0;
    record({ provider: ref.provider, model: ref.model, task: req.task, outcome: r.outcome, status: r.status, ms, inputTokens: inT, outputTokens: outT, costUsd: cost, limits: r.limits, error: r.error });
    if (r.outcome === "ok") {
      return {
        ok: true,
        text: r.text,
        servedBy: { provider: ref.provider, model: ref.model, label: p.label, paid: p.paid },
        fellBack: !firstUsable,
        usage: { inputTokens: inT, outputTokens: outT },
        costUsd: cost,
        attempts,
      };
    }
    firstUsable = false;
  }

  const triedAny = attempts.some((a) => a.ms !== undefined);
  return { ok: false, fellBack: false, costUsd: 0, attempts, error: triedAny ? "all_failed" : "no_providers" };
}
