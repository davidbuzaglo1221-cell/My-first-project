import { describe, expect, it } from "vitest";
import { LESSONS } from "./lessons";
import { ACTIONS } from "./actions";
import { TRACKS } from "./tracks";
import { SALES_SCENARIOS } from "./sales";
import { RELATION_SCENARIOS } from "./relations";

describe("lesson content", () => {
  it.each(LESSONS.map((l) => [l.id, l] as const))("%s has every required part", (_id, l) => {
    expect(l.principle.length).toBeGreaterThan(20);
    expect(l.explanation.length).toBeGreaterThanOrEqual(2);
    expect(l.example.length).toBeGreaterThan(20);
    expect(l.exercise.length).toBeGreaterThan(10);
    expect(l.assignment.length).toBeGreaterThan(10);
    expect(l.quiz.length).toBeGreaterThanOrEqual(1);
    expect(l.reflection.length).toBeGreaterThan(10);
    expect(l.evidence.level).toBeTruthy();
  });

  it.each(LESSONS.map((l) => [l.id, l] as const))("%s quiz answers point at real options", (_id, l) => {
    for (const q of l.quiz) {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
      expect(q.why.length).toBeGreaterThan(5);
    }
  });

  it("lesson ids are unique and each belongs to a defined track", () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const trackIds = new Set(TRACKS.map((t) => t.id));
    for (const l of LESSONS) expect(trackIds.has(l.track)).toBe(true);
  });

  it("the testosterone lesson keeps the medical boundary", () => {
    const t = LESSONS.find((l) => l.id === "b-testosterone-facts")!;
    expect(t.medicalNote).toBeTruthy();
    expect(t.principle + t.explanation.join(" ")).toContain("רופא");
    expect(t.explanation.join(" ")).not.toMatch(/מגביר את הטסטוסטרון ב-\d/);
  });

  it("no lesson asserts a percentage or a study as a fact", () => {
    for (const l of LESSONS) {
      const text = [l.principle, ...l.explanation, l.example].join(" ");
      expect(text).not.toMatch(/\d+\s?%/);
    }
  });
});

describe("action catalog", () => {
  it("every action has a positive duration and at least one goal", () => {
    for (const a of ACTIONS) {
      expect(a.minutes).toBeGreaterThan(0);
      expect(a.goals.length).toBeGreaterThan(0);
    }
  });

  it("every area has actions that fit a 10-minute budget", () => {
    for (const area of ["body", "mind", "work"] as const) {
      expect(ACTIONS.some((a) => a.area === area && a.minutes <= 10)).toBe(true);
    }
  });
});

describe("simulator content", () => {
  it("each sales scenario has at least 4 objections, and the hard ones are marked", () => {
    for (const s of SALES_SCENARIOS) {
      expect(s.objections.length).toBeGreaterThanOrEqual(4);
      expect(s.objections.some((o) => o.hard)).toBe(true);
      for (const o of s.objections) expect(o.ideal.length).toBeGreaterThan(20);
    }
  });

  it("each relationship scenario has one strong option and one weak option", () => {
    for (const s of RELATION_SCENARIOS) {
      expect(s.options.some((o) => o.quality === "strong")).toBe(true);
      expect(s.options.some((o) => o.quality === "weak")).toBe(true);
    }
  });
});
