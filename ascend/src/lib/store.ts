import { useSyncExternalStore } from "react";
import type { AppState, DayLog, Profile, LessonProgress } from "./types";
import { isDateKey } from "./dates";

export const STORAGE_KEY = "ascend:v1";

export function emptyState(): AppState {
  return {
    version: 1,
    profile: null,
    days: {},
    habits: [],
    lessons: {},
    sims: [],
    offers: [],
    weeklyReviews: [],
    coachMessages: [],
    lastLessonId: null,
  };
}

const GOALS = ["confidence", "discipline", "stress", "sleep", "health", "relationships", "communication", "sales", "business", "finance"];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v.slice(0, 2000) : fallback);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const scale = (v: unknown) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5 ? (v as 1 | 2 | 3 | 4 | 5) : 3);

function sanitizeProfile(v: unknown): Profile | null {
  if (!isObj(v)) return null;
  const name = str(v.name).trim();
  if (!name) return null;
  const goals = Array.isArray(v.goals) ? v.goals.filter((g): g is Profile["goals"][number] => typeof g === "string" && GOALS.includes(g)) : [];
  const timeMode = v.timeMode === 20 || v.timeMode === 30 ? v.timeMode : 10;
  const workStatus = ["employee", "self-employed", "business-owner", "student", "other"].includes(v.workStatus as string)
    ? (v.workStatus as Profile["workStatus"]) : "other";
  const salesExperience = ["none", "some", "experienced"].includes(v.salesExperience as string)
    ? (v.salesExperience as Profile["salesExperience"]) : "none";
  return {
    name,
    goals,
    timeMode,
    sleepTarget: Math.min(12, Math.max(4, num(v.sleepTarget, 7.5))),
    workStatus,
    salesExperience,
    obstacles: str(v.obstacles),
    createdAt: str(v.createdAt, new Date().toISOString()),
  };
}

function sanitizeDays(v: unknown): Record<string, DayLog> {
  const out: Record<string, DayLog> = {};
  if (!isObj(v)) return out;
  for (const [key, raw] of Object.entries(v)) {
    if (!isDateKey(key) || !isObj(raw)) continue;
    const day: DayLog = {
      actions: Array.isArray(raw.actions) ? raw.actions.filter((a): a is string => typeof a === "string") : [],
      habits: Array.isArray(raw.habits) ? raw.habits.filter((a): a is string => typeof a === "string") : [],
    };
    if (isObj(raw.checkIn)) {
      const c = raw.checkIn;
      day.checkIn = {
        sleepHours: Math.min(24, Math.max(0, num(c.sleepHours, 0))),
        sleepQuality: scale(c.sleepQuality),
        energy: scale(c.energy),
        stress: scale(c.stress),
        mood: scale(c.mood),
        exercised: c.exercised === true,
        learningMinutes: Math.max(0, num(c.learningMinutes, 0)),
        savedAt: str(c.savedAt),
      };
    }
    if (isObj(raw.review)) {
      day.review = {
        wentWell: str(raw.review.wentWell),
        challenged: str(raw.review.challenged),
        learned: str(raw.review.learned),
        tomorrow: str(raw.review.tomorrow),
        savedAt: str(raw.review.savedAt),
      };
    }
    if (typeof raw.weight === "number" && raw.weight > 0) day.weight = raw.weight;
    out[key] = day;
  }
  return out;
}

function sanitizeArray<T>(v: unknown, fn: (x: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    if (!isObj(item)) continue;
    const parsed = fn(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

function sanitizeLessons(v: unknown): Record<string, LessonProgress> {
  const out: Record<string, LessonProgress> = {};
  if (!isObj(v)) return out;
  for (const [id, raw] of Object.entries(v)) {
    if (!isObj(raw)) continue;
    const quizAnswers: Record<string, number> = {};
    if (isObj(raw.quizAnswers)) {
      for (const [q, a] of Object.entries(raw.quizAnswers)) if (typeof a === "number") quizAnswers[q] = a;
    }
    out[id] = {
      completed: raw.completed === true,
      bookmarked: raw.bookmarked === true,
      notes: str(raw.notes),
      quizAnswers,
      reflection: str(raw.reflection),
      assignmentDone: raw.assignmentDone === true,
      lastOpenedAt: typeof raw.lastOpenedAt === "string" ? raw.lastOpenedAt : undefined,
    };
  }
  return out;
}

/** Turns any stored value (missing, old, or malformed) into a valid AppState. */
export function sanitizeState(raw: unknown): AppState {
  const base = emptyState();
  if (!isObj(raw)) return base;
  return {
    version: 1,
    profile: sanitizeProfile(raw.profile),
    days: sanitizeDays(raw.days),
    habits: sanitizeArray(raw.habits, (h) =>
      typeof h.id === "string" && typeof h.name === "string" && h.name.trim()
        ? { id: h.id, name: str(h.name).trim(), area: (["body", "mind", "work"].includes(h.area as string) ? h.area : "mind") as "body" | "mind" | "work", createdAt: str(h.createdAt), archived: h.archived === true }
        : null),
    lessons: sanitizeLessons(raw.lessons),
    sims: sanitizeArray(raw.sims, (s) =>
      typeof s.id === "string" && (s.kind === "sales" || s.kind === "relationship")
        ? { id: s.id, kind: s.kind, scenarioId: str(s.scenarioId), difficulty: ["easy", "medium", "hard"].includes(s.difficulty as string) ? (s.difficulty as "easy") : undefined, score: num(s.score, 0), summary: str(s.summary), createdAt: str(s.createdAt) }
        : null),
    offers: sanitizeArray(raw.offers, (o) =>
      typeof o.id === "string"
        ? { id: o.id, name: str(o.name), product: str(o.product), customer: str(o.customer), problem: str(o.problem), price: str(o.price), desiredResult: str(o.desiredResult), createdAt: str(o.createdAt), plan: Array.isArray(o.plan) ? o.plan.filter((p): p is string => typeof p === "string") : [] }
        : null),
    weeklyReviews: sanitizeArray(raw.weeklyReviews, (w) =>
      isDateKey(w.weekStart)
        ? { weekStart: w.weekStart, wins: str(w.wins), blockers: str(w.blockers), nextWeek: str(w.nextWeek), savedAt: str(w.savedAt) }
        : null),
    coachMessages: sanitizeArray(raw.coachMessages, (m) =>
      typeof m.id === "string" && (m.role === "user" || m.role === "coach")
        ? { id: m.id, role: m.role as "user" | "coach", text: str(m.text), at: str(m.at), source: (m.source === "ai" ? "ai" : "basic") as "ai" | "basic" }
        : null).slice(-60),
    lastLessonId: typeof raw.lastLessonId === "string" ? raw.lastLessonId : null,
  };
}

export function loadState(storage: Pick<Storage, "getItem"> | undefined = safeLocalStorage()): AppState {
  if (!storage) return emptyState();
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return emptyState();
    return sanitizeState(JSON.parse(text));
  } catch {
    // Malformed JSON: keep the app usable. The raw value is left in place so it can be recovered manually.
    return emptyState();
  }
}

export function safeLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

type Listener = () => void;
let current: AppState = loadState();
const listeners = new Set<Listener>();

export function getState(): AppState {
  return current;
}

export function setState(updater: (s: AppState) => AppState): void {
  const next = updater(current);
  if (next === current) return;
  current = next;
  try {
    safeLocalStorage()?.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage full or blocked (private mode). The in-memory state still works for this session.
  }
  listeners.forEach((l) => l());
}

export function replaceState(next: AppState): void {
  setState(() => sanitizeState(next));
}

export function resetState(): void {
  setState(() => emptyState());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function updateDay(state: AppState, date: string, fn: (d: DayLog) => DayLog): AppState {
  const existing: DayLog = state.days[date] ?? { actions: [], habits: [] };
  return { ...state, days: { ...state.days, [date]: fn(existing) } };
}
