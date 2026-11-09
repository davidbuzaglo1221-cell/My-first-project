import type { Cut, Journey, MonthlyCosts } from "@/data/life-types";
import { addDays } from "@/lib/nutrition";

// The barber business in numbers: what came in, from whom, and how long the savings last.

export const monthlyTotal = (m: MonthlyCosts) => m.rent + m.bills + m.food + m.other;

export type Period = { income: number; cuts: number; avgPrice: number; newClients: number; returningShare: number; rebookShare: number; tips: number };

export function summarize(cuts: Cut[]): Period {
  const income = cuts.reduce((s, c) => s + c.price + c.tip, 0);
  const tips = cuts.reduce((s, c) => s + c.tip, 0);
  const n = cuts.length;
  return {
    income,
    tips,
    cuts: n,
    avgPrice: n ? cuts.reduce((s, c) => s + c.price, 0) / n : 0,
    newClients: cuts.filter((c) => c.isNew).length,
    returningShare: n ? cuts.filter((c) => !c.isNew).length / n : 0,
    rebookShare: n ? cuts.filter((c) => c.rebooked).length / n : 0,
  };
}

/** Income per week for the last `weeks` weeks ending on `today` (oldest first). */
export function weeklyIncome(cuts: Cut[], today: string, weeks = 8): { start: string; income: number; cuts: number }[] {
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = addDays(today, -7 * i);
    const start = addDays(end, -6);
    const inWeek = cuts.filter((c) => c.date >= start && c.date <= end);
    out.push({ start, income: inWeek.reduce((s, c) => s + c.price + c.tip, 0), cuts: inWeek.length });
  }
  return out;
}

export type Runway = {
  costs: number;
  /** Months the savings last with the current income (Infinity when income covers costs). */
  months: number;
  /** Months with no income at all. */
  monthsNoIncome: number;
  /** Cuts per month that pay the costs at the current average price. */
  cutsToBreakEven: number;
  monthlyIncome: number;
  gap: number;
};

/**
 * How long the money lasts. Income is the average of the last 30 days, so one big day does not
 * make the picture look better than it is.
 */
export function runway(journey: Pick<Journey, "savings" | "monthly">, cuts: Cut[], today: string, fallbackPrice = 60): Runway {
  const costs = monthlyTotal(journey.monthly);
  const from = addDays(today, -29);
  const recent = cuts.filter((c) => c.date >= from && c.date <= today);
  const monthlyIncome = recent.reduce((s, c) => s + c.price + c.tip, 0);
  const avg = recent.length ? recent.reduce((s, c) => s + c.price, 0) / recent.length : fallbackPrice;
  const savings = journey.savings ?? 0;
  const gap = costs - monthlyIncome;
  return {
    costs,
    monthlyIncome,
    gap,
    months: gap <= 0 ? Infinity : savings / gap,
    monthsNoIncome: costs > 0 ? savings / costs : Infinity,
    cutsToBreakEven: avg > 0 ? Math.ceil(costs / avg) : 0,
  };
}

/** Clients by name: visits, money, last visit. Names are matched loosely (trimmed, case-folded). */
export function clients(cuts: Cut[]) {
  const map = new Map<string, { name: string; visits: number; spent: number; last: string }>();
  for (const c of cuts) {
    const key = c.client.trim().toLowerCase();
    if (!key) continue;
    const e = map.get(key) ?? { name: c.client.trim(), visits: 0, spent: 0, last: "" };
    e.visits++;
    e.spent += c.price + c.tip;
    if (c.date > e.last) e.last = c.date;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
}

export const shekel = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;
