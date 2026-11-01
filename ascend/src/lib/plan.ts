import { ACTIONS, type CatalogAction } from "../content/actions";
import type { Area, Goal, Profile, TimeMode } from "./types";

export interface PlannedAction extends CatalogAction {}

export interface DailyPlan {
  mode: TimeMode;
  budget: number;
  actions: PlannedAction[];
  skippedAreas: Area[];
  totalMinutes: number;
}

const AREA_ORDER: Area[] = ["body", "mind", "work"];

export function dayOfYear(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const start = Date.UTC(y, 0, 0);
  return Math.floor((Date.UTC(y, m - 1, d) - start) / 86400000);
}

/**
 * Builds the daily plan: one action per area (body, mind, work), chosen to match the user's goals
 * and to fit inside the selected time budget. The rotation changes the pick across days, so the
 * same goal doesn't produce the same action every day. Nothing is assigned that doesn't fit.
 */
export function buildDailyPlan(profile: Profile, dateKey: string): DailyPlan {
  const budget = profile.timeMode;
  const goals = new Set<Goal>(profile.goals);
  const actions: PlannedAction[] = [];
  const skippedAreas: Area[] = [];
  let remaining = budget;
  const day = dayOfYear(dateKey);

  for (const area of AREA_ORDER) {
    const inArea = ACTIONS.filter((a) => a.area === area);
    const matching = inArea.filter((a) => a.goals.some((g) => goals.has(g)));
    const pool = matching.length > 0 ? matching : inArea;
    const fitting = pool.filter((a) => a.minutes <= remaining);
    if (fitting.length === 0) {
      skippedAreas.push(area);
      continue;
    }
    // Prefer actions that match more of the user's goals, then rotate among the best.
    const score = (a: CatalogAction) => a.goals.filter((g) => goals.has(g)).length;
    const bestScore = Math.max(...fitting.map(score));
    const best = fitting.filter((a) => score(a) === bestScore);
    const pick = best[day % best.length];
    actions.push(pick);
    remaining -= pick.minutes;
  }

  return {
    mode: profile.timeMode,
    budget,
    actions,
    skippedAreas,
    totalMinutes: budget - remaining,
  };
}
