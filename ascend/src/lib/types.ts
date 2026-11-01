export type Goal =
  | "confidence"
  | "discipline"
  | "stress"
  | "sleep"
  | "health"
  | "relationships"
  | "communication"
  | "sales"
  | "business"
  | "finance";

export type TimeMode = 10 | 20 | 30;
export type Area = "body" | "mind" | "work";
export type TrackId = "A" | "B" | "C" | "D" | "E" | "F";
export type Scale = 1 | 2 | 3 | 4 | 5;

export interface Profile {
  name: string;
  goals: Goal[];
  timeMode: TimeMode;
  sleepTarget: number;
  workStatus: "employee" | "self-employed" | "business-owner" | "student" | "other";
  salesExperience: "none" | "some" | "experienced";
  obstacles: string;
  createdAt: string;
}

export interface CheckIn {
  sleepHours: number;
  sleepQuality: Scale;
  energy: Scale;
  stress: Scale;
  mood: Scale;
  exercised: boolean;
  learningMinutes: number;
  savedAt: string;
}

export interface Review {
  wentWell: string;
  challenged: string;
  learned: string;
  tomorrow: string;
  savedAt: string;
}

export interface DayLog {
  actions: string[];
  checkIn?: CheckIn;
  review?: Review;
  habits: string[];
  weight?: number;
}

export interface Habit {
  id: string;
  name: string;
  area: Area;
  createdAt: string;
  archived: boolean;
}

export interface LessonProgress {
  completed: boolean;
  bookmarked: boolean;
  notes: string;
  quizAnswers: Record<string, number>;
  reflection: string;
  assignmentDone: boolean;
  lastOpenedAt?: string;
}

export interface SimRecord {
  id: string;
  kind: "sales" | "relationship";
  scenarioId: string;
  difficulty?: "easy" | "medium" | "hard";
  score: number;
  summary: string;
  createdAt: string;
}

export interface Offer {
  id: string;
  name: string;
  product: string;
  customer: string;
  problem: string;
  price: string;
  desiredResult: string;
  createdAt: string;
  plan: string[];
}

export interface WeeklyReview {
  weekStart: string;
  wins: string;
  blockers: string;
  nextWeek: string;
  savedAt: string;
}

export interface CoachMessage {
  id: string;
  role: "user" | "coach";
  text: string;
  at: string;
  source: "ai" | "basic";
}

export interface AppState {
  version: 1;
  profile: Profile | null;
  days: Record<string, DayLog>;
  habits: Habit[];
  lessons: Record<string, LessonProgress>;
  sims: SimRecord[];
  offers: Offer[];
  weeklyReviews: WeeklyReview[];
  coachMessages: CoachMessage[];
  lastLessonId: string | null;
}
