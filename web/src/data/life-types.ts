// The 90-day journey: the person, the daily missions, the check-ins, the barber business,
// sales practice and the coach's notes. Rows are plain JSON, stored in IndexedDB and copied to
// the Claude account by sync.ts like every other table.

/** The nine areas a mission can train. */
export type Domain =
  | "discipline"
  | "fitness"
  | "charisma"
  | "sales"
  | "mind"
  | "courage"
  | "business"
  | "relationships"
  | "learning";

export type Difficulty = 1 | 2 | 3;

export interface MonthlyCosts {
  rent: number;
  bills: number;
  food: number;
  other: number;
}

/** One row, id "me": who is on the journey and the money picture. */
export interface Journey {
  id: "me";
  /** Day 1, as a local date key (YYYY-MM-DD). */
  startDate: string;
  name: string | null;
  /** The person in their own words: the life profile the coach reads. */
  about: string;
  /** Up to three areas that get more missions. */
  focus: Domain[];
  savings: number | null;
  monthly: MonthlyCosts;
  /** Income the business should reach per month. */
  incomeGoal: number | null;
  /** The price per cut being worked towards. */
  priceTarget: number | null;
  /** -1 easier, 0 as planned, +1 harder: set by the weekly report or by hand. */
  difficultyBias: -1 | 0 | 1;
  createdAt: string;
}

export type MissionKind = "check" | "timer" | "count";
export type MissionSlot = "main" | "side1" | "side2" | "coach";
export type MissionStatus = "open" | "done" | "skipped";

/** A mission as it was given on one day. Materialised when the day opens, so it never changes under you. */
export interface Mission {
  /** `${date}:${slot}` */
  id: string;
  date: string;
  slot: MissionSlot;
  templateId: string;
  domain: Domain;
  title: string;
  objective: string;
  why: string;
  steps: string[];
  kind: MissionKind;
  /** Minutes for a timer, how many for a count; 1 for a check. */
  target: number;
  difficulty: Difficulty;
  /** The level's closing test. */
  boss: boolean;
  /** "library" (the built-in set) or "coach" (written by the AI coach for this person). */
  source: "library" | "coach";
  /** A question to answer when it is done: completing means saying what happened. */
  prompt: string;
  status: MissionStatus;
  progress: number;
  reflection: string | null;
  completedAt: string | null;
  xp: number;
}

export interface CheckIn {
  /** The date key. */
  id: string;
  date: string;
  sleepHours: number | null;
  /** 1..5 */
  energy: number | null;
  mood: number | null;
  screenHours: number | null;
  trained: boolean;
  win: string;
  lesson: string;
  updatedAt: string;
}

export type CutService = "haircut" | "beard" | "combo" | "other";
export type ClientSource = "returning" | "referral" | "instagram" | "tiktok" | "walkin" | "other";

/** One paid service in the chair. */
export interface Cut {
  id: string;
  date: string;
  at: string;
  client: string;
  price: number;
  tip: number;
  service: CutService;
  isNew: boolean;
  source: ClientSource;
  /** Booked the next visit before leaving. */
  rebooked: boolean;
  notes: string;
}

export type Turn = { role: "client" | "me"; text: string };

export interface SalesReview {
  score: number;
  summary: string;
  strengths: string[];
  fixes: string[];
  betterLine: string;
}

export interface SalesSession {
  id: string;
  at: string;
  scenarioId: string;
  turns: Turn[];
  review: SalesReview | null;
}

export interface WeeklyReport {
  headline: string;
  wins: string[];
  gaps: string[];
  pattern: string;
  priorities: string[];
  difficulty: "down" | "same" | "up";
}

export interface CoachAnswer {
  answer: string;
  actions: string[];
}

export interface CoachNote {
  id: string;
  at: string;
  kind: "report" | "answer";
  /** For a report: the week it covers (its first day). */
  weekStart: string | null;
  question: string | null;
  report: WeeklyReport | null;
  answer: CoachAnswer | null;
}
