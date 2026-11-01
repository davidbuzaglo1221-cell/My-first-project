import { describe, expect, it } from "vitest";
import { emptyState, sanitizeState, loadState } from "./store";
import { currentStreak, longestStreak, habitRate, checkInAverages } from "./stats";
import { buildDailyPlan } from "./plan";
import { evaluateReply, objectionsFor, buildReport } from "./sales-engine";
import { basicCoachReply, detectTopic } from "./coach";
import { buildOffer } from "./offer";
import { addDays, lastNDays, weekStartKey } from "./dates";
import type { AppState, Profile } from "./types";
import { SALES_SCENARIOS } from "../content/sales";

const profile = (over: Partial<Profile> = {}): Profile => ({
  name: "דנה",
  goals: ["sales", "sleep", "discipline"],
  timeMode: 10,
  sleepTarget: 7.5,
  workStatus: "self-employed",
  salesExperience: "none",
  obstacles: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("storage sanitizing", () => {
  it("returns an empty state for garbage and missing input", () => {
    expect(sanitizeState(null)).toEqual(emptyState());
    expect(sanitizeState("nope")).toEqual(emptyState());
    expect(sanitizeState([1, 2])).toEqual(emptyState());
  });

  it("drops malformed entries but keeps valid ones", () => {
    const s = sanitizeState({
      profile: { name: "  יעל  ", goals: ["sales", "unknown"], timeMode: 15 },
      days: {
        "2026-02-03": { actions: ["b-walk", 5], checkIn: { sleepHours: 99, energy: 9, stress: "x" } },
        "bad-key": { actions: [] },
      },
      habits: [{ id: "h1", name: "" }, { id: "h2", name: "קריאה", area: "weird" }],
      coachMessages: [{ id: "m", role: "system", text: "x" }],
    });
    expect(s.profile?.name).toBe("יעל");
    expect(s.profile?.goals).toEqual(["sales"]);
    expect(s.profile?.timeMode).toBe(10);
    expect(Object.keys(s.days)).toEqual(["2026-02-03"]);
    expect(s.days["2026-02-03"].actions).toEqual(["b-walk"]);
    expect(s.days["2026-02-03"].checkIn?.sleepHours).toBe(24);
    expect(s.days["2026-02-03"].checkIn?.energy).toBe(3);
    expect(s.habits).toHaveLength(1);
    expect(s.habits[0].area).toBe("mind");
    expect(s.coachMessages).toHaveLength(0);
  });

  it("returns an empty state when stored JSON is corrupt", () => {
    const storage = { getItem: () => "{not json" } as unknown as Storage;
    expect(loadState(storage)).toEqual(emptyState());
  });

  it("rejects a profile with no name", () => {
    expect(sanitizeState({ profile: { name: "   " } }).profile).toBeNull();
  });
});

describe("streaks and stats", () => {
  const today = "2026-03-10";
  const state = (dates: string[]): AppState => {
    const s = emptyState();
    for (const d of dates) s.days[d] = { actions: ["b-walk"], habits: [] };
    return s;
  };

  it("counts consecutive active days ending today", () => {
    expect(currentStreak(state(["2026-03-08", "2026-03-09", "2026-03-10"]), today)).toBe(3);
  });

  it("does not break the streak before today has any entry", () => {
    expect(currentStreak(state(["2026-03-08", "2026-03-09"]), today)).toBe(2);
  });

  it("breaks on a gap", () => {
    expect(currentStreak(state(["2026-03-07", "2026-03-09", "2026-03-10"]), today)).toBe(2);
  });

  it("computes the longest run across gaps", () => {
    expect(longestStreak(state(["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-09", "2026-03-10"]))).toBe(3);
  });

  it("habit rate uses only the window and real logs", () => {
    const s = emptyState();
    s.habits = [{ id: "h", name: "x", area: "body", createdAt: "", archived: false }];
    s.days[today] = { actions: [], habits: ["h"] };
    s.days[addDays(today, -1)] = { actions: [], habits: ["h"] };
    expect(habitRate(s, s.habits[0], 7, today)).toBe(29);
  });

  it("check-in averages ignore days without check-ins", () => {
    const s = emptyState();
    s.days[today] = { actions: [], habits: [], checkIn: { sleepHours: 6, sleepQuality: 3, energy: 4, stress: 2, mood: 4, exercised: true, learningMinutes: 10, savedAt: "" } };
    const avg = checkInAverages(s, 7, today);
    expect(avg.count).toBe(1);
    expect(avg.sleepHours).toBe(6);
    expect(avg.exercisedDays).toBe(1);
  });

  it("date helpers stay correct across month boundaries", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(lastNDays(3, "2026-03-02")).toEqual(["2026-02-28", "2026-03-01", "2026-03-02"]);
    expect(weekStartKey("2026-03-11")).toBe("2026-03-08");
  });
});

describe("daily plan", () => {
  it.each([10, 20, 30] as const)("never exceeds the %i minute budget", (mode) => {
    for (let day = 1; day <= 60; day++) {
      const key = addDays("2026-01-01", day);
      const plan = buildDailyPlan(profile({ timeMode: mode, goals: ["stress", "sales", "finance", "health"] }), key);
      expect(plan.totalMinutes).toBeLessThanOrEqual(mode);
      expect(plan.actions.reduce((s, a) => s + a.minutes, 0)).toBe(plan.totalMinutes);
    }
  });

  it("at most one action per area", () => {
    const plan = buildDailyPlan(profile({ timeMode: 30 }), "2026-05-05");
    const areas = plan.actions.map((a) => a.area);
    expect(new Set(areas).size).toBe(areas.length);
  });

  it("is deterministic for the same date and profile", () => {
    const p = profile({ timeMode: 20 });
    expect(buildDailyPlan(p, "2026-06-01")).toEqual(buildDailyPlan(p, "2026-06-01"));
  });

  it("prefers actions that match the user's goals", () => {
    const plan = buildDailyPlan(profile({ timeMode: 30, goals: ["sales"] }), "2026-06-02");
    const work = plan.actions.find((a) => a.area === "work");
    expect(work?.goals).toContain("sales");
  });

  it("reports areas that do not fit instead of overfilling", () => {
    const plan = buildDailyPlan(profile({ timeMode: 10, goals: ["business"] }), "2026-06-03");
    expect(plan.totalMinutes).toBeLessThanOrEqual(10);
    expect(plan.actions.length + plan.skippedAreas.length).toBe(3);
  });
});

describe("sales engine", () => {
  const scenario = SALES_SCENARIOS[1];
  const priceObj = scenario.objections.find((o) => o.kind === "price")!;

  it("flags an early discount when answering a price objection", () => {
    const ev = evaluateReply("אוקיי, נוריד לך 1,000 ₪ עכשיו.", priceObj, false);
    expect(ev.discountEarly).toBe(true);
    expect(ev.flags.objections).toBe(false);
    expect(ev.weaknesses.join(" ")).toContain("הנחה");
  });

  it("accepts a question that explores value before discussing price", () => {
    const ev = evaluateReply("אם הבנתי נכון, התקציב הוא האילוץ. מה המספר שהיה נראה לך סביר?", priceObj, false);
    expect(ev.flags.objections).toBe(true);
    expect(ev.flags.discovery).toBe(true);
    expect(ev.flags.listening).toBe(true);
    expect(ev.weak).toBe(false);
  });

  it("flags manufactured pressure as an ethics issue", () => {
    const ev = evaluateReply("זו ההזדמנות האחרונה, תחליט עכשיו כי המחיר יעלה.", priceObj, false);
    expect(ev.flags.ethics).toBe(false);
    expect(ev.weak).toBe(true);
  });

  it("requires a next step on the closing turn", () => {
    const noStep = evaluateReply("תודה על הזמן, היה נעים.", undefined, true);
    expect(noStep.flags.nextStep).toBe(false);
    expect(noStep.weaknesses.join(" ")).toContain("צעד הבא");
    const withStep = evaluateReply("אם מתאים לך, נקבע שיחה של 15 דקות השבוע.", undefined, true);
    expect(withStep.flags.nextStep).toBe(true);
  });

  it("easy level omits objections marked hard", () => {
    const easy = objectionsFor(scenario, "easy");
    expect(easy.every((o) => !o.hard)).toBe(true);
    expect(objectionsFor(scenario, "hard").length).toBe(Math.min(4, scenario.objections.length));
  });

  it("a repeated reply is not credited as a new answer", () => {
    const text = "מה המצב היום? אם הבנתי נכון התוצאה חשובה לך, מה נוח לך?";
    const first = evaluateReply(text, priceObj, false);
    expect(first.weak).toBe(false);
    const repeat = evaluateReply(text, priceObj, false, text);
    expect(repeat.flags.objections).toBe(false);
    expect(repeat.flags.listening).toBe(false);
    expect(repeat.weaknesses.join(" ")).toContain("אותה תשובה");
  });

  it("scores stay within 1 to 5", () => {
    const turns = [
      { objection: priceObj, reply: "מה חשוב לך בהשקעה הזו? אם הבנתי נכון, התוצאה היא חיסכון בשעות.", evaluation: evaluateReply("מה חשוב לך בהשקעה הזו? אם הבנתי נכון, התוצאה היא חיסכון בשעות.", priceObj, true) },
    ];
    const r = buildReport(turns);
    for (const v of Object.values(r.scores)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe("basic coach", () => {
  it("asks a clarifying question for a short message", () => {
    const reply = basicCoachReply("אני עייף", "sleep", profile(), []);
    expect(reply).toContain("שאלה אחת");
  });

  it("gives principle and two actions once there is enough detail", () => {
    const history = [{ id: "1", role: "coach" as const, text: "q", at: "", source: "basic" as const }];
    const reply = basicCoachReply("אני מתקשה להירדם בלילה ומתעורר מוקדם מדי, וזה קורה כמעט כל יום השבוע האחרון.", "sleep", profile(), history);
    expect(reply).toContain("עיקרון");
    expect(reply).toContain("1.");
    expect(reply).toContain("2.");
  });

  it("points to a professional for medical or financial risk", () => {
    const reply = basicCoachReply("יש לי מחשבות על פגיעה עצמית", "general", profile(), []);
    expect(reply).toContain("איש מקצוע");
  });

  it("detects topics from Hebrew keywords", () => {
    expect(detectTopic("אני צריך לסגור עסקה")).toBe("sales");
    expect(detectTopic("הבת זוג שלי ואני")).toBe("relationship");
    expect(detectTopic("משהו אחר לגמרי")).toBe("general");
  });
});

describe("offer builder", () => {
  it("produces a draft without revenue promises", () => {
    const o = buildOffer({ product: "ליווי", customer: "צלמים", problem: "אין לקוחות קבועים", price: "1,000 ₪", desiredResult: "שלושה לקוחות בחודש" });
    const text = JSON.stringify(o);
    expect(text).not.toMatch(/מובטח|guarantee|בטוח שתרוויח|תרוויח/i);
    expect(o.caveat).toContain("אין כאן תחזית");
    expect(o.acquisitionPlan).toHaveLength(4);
    expect(o.contentIdeas.length).toBeGreaterThanOrEqual(5);
  });
});
