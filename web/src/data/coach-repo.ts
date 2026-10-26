import { db } from "./db";
import { getProfile, listFinishedWorkouts } from "./repo";
import { bodyweightOn } from "./body-repo";
import { achievements, foodStreak, newlyUnlocked, weeklyStreak, type Achievement, type LiftFact, type WorkoutFact } from "@/lib/achievements";
import { lessonOfTheDay, type Lesson } from "@/lib/lessons";
import { localDateKey } from "@/lib/nutrition";
import type { CardioKind, CardioSession, Pose, ProgressPhoto, WorkoutSummary } from "./types";

// Streaks, achievements, lessons, cardio, progress photos and supersets.

const uuid = () => crypto.randomUUID();

async function liftFacts(excludeWorkoutId?: string): Promise<LiftFact[]> {
  const [exercises, wes, sets, workouts] = await Promise.all([db().exercises.toArray(), db().workoutExercises.toArray(), db().sets.toArray(), db().workouts.toArray()]);
  const finished = new Set(workouts.filter((w) => w.endedAt && w.id !== excludeWorkoutId).map((w) => w.id));
  const slugOf = new Map(exercises.map((e) => [e.id, e.slug]));
  const weEx = new Map(wes.map((w) => [w.id, w.exerciseId]));
  const best = new Map<string, number>();
  for (const s of sets) {
    if (!finished.has(s.workoutId) || !s.completedAt || s.kind === "warmup" || !s.weightKg || !s.reps) continue;
    const slug = slugOf.get(weEx.get(s.workoutExerciseId) ?? "");
    if (slug) best.set(slug, Math.max(best.get(slug) ?? 0, s.weightKg));
  }
  return [...best].map(([slug, heaviestKg]) => ({ slug, heaviestKg }));
}

const facts = (ws: WorkoutSummary[]): WorkoutFact[] => ws.map((w) => ({ startedAt: w.workout.startedAt, volumeKg: w.volumeKg, records: w.records.length }));

export type CoachSummary = {
  weekGoal: number;
  thisWeek: number;
  weekStreak: number;
  foodStreak: number;
  achievements: Achievement[];
  lesson: Lesson;
};

export async function getCoachSummary(now = new Date()): Promise<CoachSummary> {
  const [profile, history, logs, reads] = await Promise.all([getProfile(), listFinishedWorkouts(), db().foodLogs.toArray(), db().lessonReads.toArray()]);
  const goal = profile.daysPerWeek ?? 3;
  const streak = weeklyStreak(facts(history), goal, profile.weekStartsOn, now);
  const food = foodStreak(new Set(logs.map((l) => l.logDate)), now);
  const bw = await bodyweightOn(localDateKey(now));
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  return {
    weekGoal: goal,
    thisWeek: streak.thisWeek,
    weekStreak: streak.weeks,
    foodStreak: food,
    achievements: achievements({ workouts: facts(history), lifts: await liftFacts(), bodyweightKg: bw, weekStreak: streak.weeks, foodStreak: food }),
    lesson: lessonOfTheDay(new Set(reads.map((r) => r.id)), dayIndex),
  };
}

/** What this workout unlocked, and the streak it leaves you on. For the celebration screen. */
export async function getWorkoutCelebration(workoutId: string): Promise<{ unlocked: Achievement[]; weekStreak: number; thisWeek: number; weekGoal: number }> {
  const [profile, history] = await Promise.all([getProfile(), listFinishedWorkouts()]);
  const goal = profile.daysPerWeek ?? 3;
  const target = history.find((h) => h.workout.id === workoutId);
  const when = target ? new Date(target.workout.startedAt) : new Date();
  const without = history.filter((h) => h.workout.id !== workoutId);
  const bw = await bodyweightOn(localDateKey(when));
  const sAfter = weeklyStreak(facts(history), goal, profile.weekStartsOn, when);
  const sBefore = weeklyStreak(facts(without), goal, profile.weekStartsOn, when);
  const before = achievements({ workouts: facts(without), lifts: await liftFacts(workoutId), bodyweightKg: bw, weekStreak: sBefore.weeks, foodStreak: 0 });
  const after = achievements({ workouts: facts(history), lifts: await liftFacts(), bodyweightKg: bw, weekStreak: sAfter.weeks, foodStreak: 0 });
  return { unlocked: newlyUnlocked(before, after), weekStreak: sAfter.weeks, thisWeek: sAfter.thisWeek, weekGoal: goal };
}

// ---------- lessons ------------------------------------------------------------

export async function markLessonRead(id: string): Promise<void> {
  await db().lessonReads.put({ id, readAt: new Date().toISOString() });
}

export async function readLessonIds(): Promise<Set<string>> {
  return new Set((await db().lessonReads.toArray()).map((r) => r.id));
}

// ---------- cardio -------------------------------------------------------------

/** Metabolic equivalents for a moderate effort (Compendium of Physical Activities, rounded). */
export const MET: Record<CardioKind, number> = { walk: 3.5, run: 9.8, bike: 7.5, row: 7, elliptical: 5, swim: 7, hiit: 8, other: 5 };

export const CARDIO_LABEL: Record<CardioKind, string> = {
  walk: "הליכה",
  run: "ריצה",
  bike: "אופניים",
  row: "חתירה",
  elliptical: "אליפטיקל",
  swim: "שחייה",
  hiit: "אינטרוולים",
  other: "אחר",
};

export function estimateCardioKcal(kind: CardioKind, minutes: number, bodyweightKg: number): number {
  return Math.round(MET[kind] * bodyweightKg * (minutes / 60));
}

export async function logCardio(input: { kind: CardioKind; minutes: number; distanceKm?: number | null; kcal?: number | null; date?: string; notes?: string | null }): Promise<string> {
  const date = input.date ?? localDateKey();
  const bw = (await bodyweightOn(date)) ?? 75;
  const row: CardioSession = {
    id: uuid(),
    date,
    startedAt: new Date().toISOString(),
    kind: input.kind,
    minutes: input.minutes,
    distanceKm: input.distanceKm ?? null,
    kcal: input.kcal ?? estimateCardioKcal(input.kind, input.minutes, bw),
    notes: input.notes ?? null,
  };
  await db().cardio.add(row);
  return row.id;
}

export async function listCardio(): Promise<CardioSession[]> {
  return (await db().cardio.orderBy("startedAt").reverse().toArray());
}

export async function deleteCardio(id: string): Promise<void> {
  await db().cardio.delete(id);
}

// ---------- progress photos -------------------------------------------------------

export async function addProgressPhoto(pose: Pose, dataUrl: string, date = localDateKey()): Promise<string> {
  const id = uuid();
  await db().progressPhotos.add({ id, date, pose, dataUrl, createdAt: new Date().toISOString() });
  return id;
}

export async function listProgressPhotos(): Promise<ProgressPhoto[]> {
  return (await db().progressPhotos.toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function deleteProgressPhoto(id: string): Promise<void> {
  await db().progressPhotos.delete(id);
}

// ---------- supersets ------------------------------------------------------------

/** Joins this exercise with the next one in the workout (or adds the next one to its superset). */
export async function linkWithNext(workoutExerciseId: string): Promise<void> {
  const we = await db().workoutExercises.get(workoutExerciseId);
  if (!we) return;
  const all = (await db().workoutExercises.where("workoutId").equals(we.workoutId).toArray()).sort((a, b) => a.position - b.position);
  const i = all.findIndex((x) => x.id === we.id);
  const next = all[i + 1];
  if (!next) return;
  const group = we.supersetGroup ?? next.supersetGroup ?? Math.max(0, ...all.map((x) => x.supersetGroup ?? 0)) + 1;
  await db().transaction("rw", db().workoutExercises, async () => {
    await db().workoutExercises.update(we.id, { supersetGroup: group });
    // A next exercise already in another superset brings its whole group along.
    const absorb = next.supersetGroup && next.supersetGroup !== group ? all.filter((x) => x.supersetGroup === next.supersetGroup) : [next];
    for (const x of absorb) await db().workoutExercises.update(x.id, { supersetGroup: group });
  });
}

export async function unlinkSuperset(workoutExerciseId: string): Promise<void> {
  const we = await db().workoutExercises.get(workoutExerciseId);
  if (!we?.supersetGroup) return;
  await db().workoutExercises.update(we.id, { supersetGroup: null });
  // A group of one is not a superset.
  const rest = await db().workoutExercises.where("workoutId").equals(we.workoutId).filter((x) => x.supersetGroup === we.supersetGroup).toArray();
  if (rest.length === 1) await db().workoutExercises.update(rest[0].id, { supersetGroup: null });
}
