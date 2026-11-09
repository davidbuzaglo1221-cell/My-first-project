import { describe, expect, it } from "vitest";
import type { Mission } from "@/data/life-types";
import { addDays } from "@/lib/nutrition";
import { bestStreak, dayNumber, isBossDay, levelOf, performance, planDay, rankOf, streak, targetDifficulty } from "./engine";
import { BOSSES, LIBRARY, TEMPLATE_BY_ID } from "./library";
import { runway, summarize } from "./business";

const J = { startDate: "2026-11-09", focus: [], difficultyBias: 0 as const };

function history(days: number, doneEvery: (i: number) => boolean): Mission[] {
  const out: Mission[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(J.startDate, i);
    for (const m of planDay(J, date, out)) out.push({ ...m, status: m.slot === "main" && doneEvery(i) ? "done" : "open" });
  }
  return out;
}

describe("journey engine", () => {
  it("counts days and levels", () => {
    expect(dayNumber("2026-11-09", "2026-11-09")).toBe(1);
    expect(dayNumber("2026-11-09", "2026-12-08")).toBe(30);
    expect(levelOf(1).name).toBe("יסודות");
    expect(levelOf(16).n).toBe(2);
    expect(levelOf(90).n).toBe(6);
    expect(levelOf(120).n).toBe(6);
    expect([15, 30, 45, 60, 75, 90].every(isBossDay)).toBe(true);
    expect(isBossDay(14)).toBe(false);
  });

  it("plans three distinct missions a day, stable for the same date", () => {
    const a = planDay(J, "2026-11-10", []);
    const b = planDay(J, "2026-11-10", []);
    expect(a.map((m) => m.templateId)).toEqual(b.map((m) => m.templateId));
    expect(a.map((m) => m.slot)).toEqual(["main", "side1", "side2"]);
    expect(new Set(a.map((m) => m.templateId)).size).toBe(3);
    expect(new Set(a.map((m) => m.domain)).size).toBe(3);
    for (const m of a) expect(TEMPLATE_BY_ID.has(m.templateId)).toBe(true);
  });

  it("gives the level's test on day 15", () => {
    const [main] = planDay(J, addDays(J.startDate, 14), []);
    expect(main.boss).toBe(true);
    expect(main.templateId).toBe(BOSSES[0].id);
    expect(main.xp).toBe(150);
  });

  it("does not repeat a main mission inside two weeks while the library allows", () => {
    const h = history(28, () => true);
    const mains = h.filter((m) => m.slot === "main" && !m.boss);
    const seen = new Map<string, string>();
    for (const m of mains) {
      const last = seen.get(m.templateId);
      if (last) expect(dayNumber(last, m.date)).toBeGreaterThan(7);
      seen.set(m.templateId, m.date);
    }
  });

  it("raises difficulty for someone who completes everything and lowers it for someone who does not", () => {
    const strong = history(10, () => true);
    const weak = history(10, () => false);
    const date = addDays(J.startDate, 10);
    expect(targetDifficulty(11, strong, date, 0)).toBe(2);
    expect(targetDifficulty(11, weak, date, 0)).toBe(1);
    expect(targetDifficulty(40, weak, date, -1)).toBe(1);
    expect(targetDifficulty(70, strong, date, 1)).toBe(3);
  });

  it("covers every area with at least five missions, and every mission is well formed", () => {
    for (const d of new Set(LIBRARY.map((t) => t.domain))) expect(LIBRARY.filter((t) => t.domain === d).length).toBeGreaterThanOrEqual(6);
    const ids = new Set<string>();
    for (const t of [...LIBRARY, ...BOSSES]) {
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      expect(t.steps.length).toBeGreaterThanOrEqual(2);
      expect(t.prompt.length).toBeGreaterThan(5);
      if (t.kind === "check") expect(t.target).toBe(1);
    }
  });

  it("counts the streak, keeping it while today is still open", () => {
    const h = history(5, (i) => i !== 1);
    const today = addDays(J.startDate, 4);
    expect(streak(h, today)).toBe(3);
    const todayOpen = h.map((m) => (m.date === today ? { ...m, status: "open" as const } : m));
    expect(streak(todayOpen, today)).toBe(2);
    expect(bestStreak(h)).toBe(3);
  });

  it("scores the week out of 100", () => {
    const h = history(7, () => true);
    const today = addDays(J.startDate, 6);
    const checkins = Array.from({ length: 7 }, (_, i) => ({ id: addDays(J.startDate, i), date: addDays(J.startDate, i), sleepHours: 8, energy: 4, mood: 4, screenHours: 2, trained: i % 2 === 0, win: "", lesson: "", updatedAt: "" }));
    const p = performance(h, checkins, today);
    expect(p.score).toBe(45 + 0 + 15 + 15 + 10);
    expect(rankOf(0).name).toBe("מתחיל");
    expect(rankOf(950).name).toBe("לוחם");
  });
});

describe("business numbers", () => {
  const cut = (date: string, price: number, extra: Partial<{ isNew: boolean; rebooked: boolean; tip: number }> = {}) => ({
    id: date + price, date, at: `${date}T10:00:00Z`, client: "רון", price, tip: extra.tip ?? 0, service: "haircut" as const, isNew: extra.isNew ?? false, source: "returning" as const, rebooked: extra.rebooked ?? false, notes: "",
  });

  it("summarizes a period", () => {
    const s = summarize([cut("2026-11-01", 60, { isNew: true, rebooked: true }), cut("2026-11-02", 80, { tip: 10 })]);
    expect(s.income).toBe(150);
    expect(s.avgPrice).toBe(70);
    expect(s.newClients).toBe(1);
    expect(s.rebookShare).toBe(0.5);
  });

  it("says how long the savings last", () => {
    const j = { savings: 50000, monthly: { rent: 4000, bills: 800, food: 1800, other: 600 } };
    const none = runway(j, [], "2026-11-30");
    expect(none.costs).toBe(7200);
    expect(none.months).toBeCloseTo(50000 / 7200);
    expect(none.cutsToBreakEven).toBe(120);
    const cuts = Array.from({ length: 40 }, (_, i) => cut(addDays("2026-11-01", i % 29), 90));
    const some = runway(j, cuts, "2026-11-30");
    expect(some.monthlyIncome).toBe(3600);
    expect(some.months).toBeCloseTo(50000 / 3600);
    expect(some.cutsToBreakEven).toBe(80);
  });
});
