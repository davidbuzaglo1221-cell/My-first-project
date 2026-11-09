import { db } from "./db";
import type { CheckIn, CoachNote, Cut, Journey, Mission, SalesSession } from "./life-types";
import { planDay } from "@/lib/journey/engine";
import { localDateKey } from "@/lib/nutrition";

// Reads and writes for the journey. Screens call these; the rules live in lib/journey.

export const getJourney = async (): Promise<Journey | null> => (await db().journey.get("me")) ?? null;

export function newJourney(partial: Partial<Journey> = {}): Journey {
  return {
    id: "me",
    startDate: localDateKey(),
    name: null,
    about: "",
    focus: [],
    savings: null,
    monthly: { rent: 0, bills: 0, food: 0, other: 0 },
    incomeGoal: null,
    priceTarget: null,
    difficultyBias: 0,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export async function saveJourney(patch: Partial<Journey>): Promise<Journey> {
  const current = (await getJourney()) ?? newJourney();
  const next = { ...current, ...patch, id: "me" as const };
  await db().journey.put(next);
  return next;
}

/** The day's missions, created the first time the day is opened. */
export async function ensureDay(date: string): Promise<Mission[]> {
  const d = db();
  const journey = await getJourney();
  if (!journey || date < journey.startDate) return [];
  return d.transaction("rw", d.missions, async () => {
    const have = await d.missions.where("date").equals(date).toArray();
    if (have.some((m) => m.slot === "main")) return have.sort(bySlot);
    const history = await d.missions.where("date").below(date).toArray();
    const plan = planDay(journey, date, history).filter((m) => !have.some((h) => h.id === m.id));
    await d.missions.bulkAdd(plan);
    return [...have, ...plan].sort(bySlot);
  });
}

const ORDER = { main: 0, coach: 1, side1: 2, side2: 3 } as const;
const bySlot = (a: Mission, b: Mission) => ORDER[a.slot] - ORDER[b.slot];

export const listMissions = () => db().missions.toArray();
export const missionsOn = async (date: string) => (await db().missions.where("date").equals(date).toArray()).sort(bySlot);
export const getMission = async (id: string) => (await db().missions.get(id)) ?? null;

export async function setProgress(id: string, progress: number) {
  await db().missions.update(id, { progress: Math.max(0, progress) });
}

export async function completeMission(id: string, reflection: string) {
  await db().missions.update(id, { status: "done", reflection: reflection.trim() || null, completedAt: new Date().toISOString() });
}

export async function skipMission(id: string, reason: string) {
  await db().missions.update(id, { status: "skipped", reflection: reason.trim() || null, completedAt: new Date().toISOString() });
}

export async function reopenMission(id: string) {
  await db().missions.update(id, { status: "open", completedAt: null });
}

/** A mission the coach wrote for today: one per day, replacing an earlier one that is still open. */
export async function putCoachMission(m: Omit<Mission, "id" | "slot" | "status" | "progress" | "reflection" | "completedAt" | "source">) {
  const id = `${m.date}:coach`;
  const existing = await db().missions.get(id);
  if (existing && existing.status !== "open") throw new Error("done");
  const row: Mission = { ...m, id, slot: "coach", source: "coach", status: "open", progress: 0, reflection: null, completedAt: null };
  await db().missions.put(row);
  return row;
}

// ---- check-ins -----------------------------------------------------------------------------

export const getCheckIn = async (date: string) => (await db().checkins.get(date)) ?? null;
export const listCheckIns = () => db().checkins.orderBy("date").toArray();

export async function saveCheckIn(c: Omit<CheckIn, "id" | "updatedAt">) {
  await db().checkins.put({ ...c, id: c.date, updatedAt: new Date().toISOString() });
}

// ---- business ------------------------------------------------------------------------------

export const listCuts = () => db().cuts.orderBy("date").reverse().toArray();
export const getCut = async (id: string) => (await db().cuts.get(id)) ?? null;

export async function saveCut(c: Omit<Cut, "id" | "at"> & { id?: string; at?: string }) {
  const row: Cut = { ...c, id: c.id ?? crypto.randomUUID(), at: c.at ?? new Date().toISOString(), client: c.client.trim(), notes: c.notes.trim() };
  await db().cuts.put(row);
  return row;
}

export const deleteCut = (id: string) => db().cuts.delete(id);

/** Has this name been in the chair before (another row than `exceptId`)? */
export async function knownClient(name: string, exceptId?: string) {
  const key = name.trim().toLowerCase();
  if (!key) return false;
  return (await db().cuts.toArray()).some((c) => c.id !== exceptId && c.client.trim().toLowerCase() === key);
}

// ---- sales and coach -----------------------------------------------------------------------

export const listSales = () => db().salesSessions.orderBy("at").reverse().toArray();
export const getSales = async (id: string) => (await db().salesSessions.get(id)) ?? null;
export const saveSales = (s: SalesSession) => db().salesSessions.put(s);
export const deleteSales = (id: string) => db().salesSessions.delete(id);

export const listNotes = () => db().coachNotes.orderBy("at").reverse().toArray();
export const saveNote = (n: CoachNote) => db().coachNotes.put(n);
export const deleteNote = (id: string) => db().coachNotes.delete(id);
