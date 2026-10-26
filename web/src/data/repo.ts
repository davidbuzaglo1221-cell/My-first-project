import { db } from "./db";
import { estimateOneRepMax } from "@/lib/format";
import type {
  Equipment,
  Exercise,
  MuscleGroup,
  PreviousSet,
  Profile,
  TemplateExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutSummary,
  WorkoutTemplate,
} from "./types";

// The data layer every screen uses. Today it is backed by IndexedDB; the Supabase version
// keeps these exact signatures (see replica/architecture.md, "API"), so screens do not change.

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const USER = "me";

export class EmptyWorkoutError extends Error {
  constructor() {
    super("no completed sets");
  }
}
export class WorkoutAlreadyOpenError extends Error {
  constructor(public workoutId: string) {
    super("a workout is already open");
  }
}

// ---------- profile -----------------------------------------------------------

export async function getProfile(): Promise<Profile> {
  const p = await db().profile.get(USER);
  if (!p) throw new Error("profile missing");
  return p;
}

export async function updateProfile(patch: Partial<Omit<Profile, "id">>): Promise<void> {
  await db().profile.update(USER, patch);
}

// ---------- exercises ---------------------------------------------------------

/** Hebrew-friendly matching: ignores geresh/quotes, hyphens and spacing. */
export function normaliseHe(s: string): string {
  return s
    .toLowerCase()
    .replace(/["'׳״`\-־]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function listExercises(filter: {
  query?: string;
  muscles?: MuscleGroup[];
  equipment?: Equipment[];
} = {}): Promise<Exercise[]> {
  const all = await db().exercises.toArray();
  const q = filter.query ? normaliseHe(filter.query) : "";
  return all
    .filter((e) => e.userId === null || e.userId === USER)
    .filter((e) => !filter.muscles?.length || filter.muscles.includes(e.primaryMuscle))
    .filter((e) => !filter.equipment?.length || filter.equipment.includes(e.equipment))
    .filter((e) => !q || [e.nameHe, ...e.aliasesHe].some((n) => normaliseHe(n).includes(q)))
    .sort((a, b) => {
      // Names that start with the query first, then alphabetical in Hebrew.
      if (q) {
        const as = normaliseHe(a.nameHe).startsWith(q) ? 0 : 1;
        const bs = normaliseHe(b.nameHe).startsWith(q) ? 0 : 1;
        if (as !== bs) return as - bs;
      }
      return a.nameHe.localeCompare(b.nameHe, "he");
    });
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  return db().exercises.get(id);
}

export async function createCustomExercise(input: {
  nameHe: string;
  primaryMuscle: MuscleGroup;
  equipment: Equipment;
}): Promise<Exercise> {
  const exercise: Exercise = {
    id: uuid(),
    userId: USER,
    slug: null,
    nameHe: input.nameHe.trim(),
    aliasesHe: [],
    primaryMuscle: input.primaryMuscle,
    equipment: input.equipment,
    tracking: input.equipment === "bodyweight" ? "reps" : "weight_reps",
    isUnilateral: false,
    instructionsHe: null,
  };
  await db().exercises.add(exercise);
  return exercise;
}

// ---------- templates ---------------------------------------------------------

export type TemplateDetail = {
  template: WorkoutTemplate;
  items: { item: TemplateExercise; exercise: Exercise }[];
};

export async function listTemplates(): Promise<TemplateDetail[]> {
  const templates = await db().templates.orderBy("position").toArray();
  return Promise.all(templates.map((t) => getTemplateDetail(t.id) as Promise<TemplateDetail>));
}

export async function getTemplateDetail(id: string): Promise<TemplateDetail | undefined> {
  const template = await db().templates.get(id);
  if (!template) return undefined;
  const items = (await db().templateExercises.where("templateId").equals(id).toArray()).sort((a, b) => a.position - b.position);
  const exercises = await db().exercises.bulkGet(items.map((i) => i.exerciseId));
  return {
    template,
    items: items.map((item, i) => ({ item, exercise: exercises[i]! })).filter((x) => x.exercise),
  };
}

export async function saveWorkoutAsTemplate(workoutId: string, name: string): Promise<string> {
  const detail = await getWorkoutDetail(workoutId);
  if (!detail) throw new Error("workout not found");
  const templateId = uuid();
  const count = await db().templates.count();
  await db().transaction("rw", db().templates, db().templateExercises, async () => {
    await db().templates.add({ id: templateId, userId: USER, name: name.trim(), notes: null, position: count, createdAt: now() });
    await db().templateExercises.bulkAdd(
      detail.exercises.map(({ we, sets }, i) => {
        const work = sets.filter((s) => s.kind !== "warmup");
        const reps = work.map((s) => s.reps ?? 0).filter(Boolean);
        return {
          id: uuid(),
          templateId,
          exerciseId: we.exerciseId,
          position: i,
          supersetGroup: we.supersetGroup,
          targetSets: Math.max(1, work.length),
          targetRepsMin: reps.length ? Math.min(...reps) : null,
          targetRepsMax: reps.length ? Math.max(...reps) : null,
          targetRestSec: null,
        };
      }),
    );
  });
  return templateId;
}

// ---------- workouts: lifecycle ---------------------------------------------

export async function getOpenWorkout(): Promise<Workout | undefined> {
  return db().workouts.filter((w) => w.endedAt === null).first();
}

/** Opens a workout from a template, or an empty one. Only one can be open (schema: workouts_one_open). */
export async function startWorkout(opts: { templateId?: string } = {}): Promise<string> {
  const open = await getOpenWorkout();
  if (open) throw new WorkoutAlreadyOpenError(open.id);
  const profile = await getProfile();
  const id = uuid();
  const template = opts.templateId ? await getTemplateDetail(opts.templateId) : undefined;

  await db().transaction("rw", db().workouts, db().workoutExercises, db().sets, async () => {
    await db().workouts.add({
      id,
      userId: USER,
      templateId: template?.template.id ?? null,
      name: template?.template.name ?? null,
      startedAt: now(),
      endedAt: null,
      notes: null,
      rating: null,
      bodyweightKg: profile.bodyweightKg,
      restEndsAt: null,
      restTotalSec: null,
      updatedAt: now(),
    });
    for (const [i, { item }] of (template?.items ?? []).entries()) {
      const weId = uuid();
      await db().workoutExercises.add({ id: weId, workoutId: id, exerciseId: item.exerciseId, position: i, supersetGroup: item.supersetGroup, notes: null });
      await db().sets.bulkAdd(
        Array.from({ length: item.targetSets }, (_, p) => emptySet(id, weId, p)),
      );
    }
  });
  return id;
}

function emptySet(workoutId: string, workoutExerciseId: string, position: number): WorkoutSet {
  return { id: uuid(), workoutId, workoutExerciseId, position, kind: "work", weightKg: null, reps: null, completedAt: null, isPr: false, updatedAt: now() };
}

/** Closes the workout: drops sets that were never done, marks records, returns the summary. */
export async function finishWorkout(id: string, extra: { rating?: number | null; notes?: string | null } = {}): Promise<WorkoutSummary> {
  const workout = await db().workouts.get(id);
  if (!workout) throw new Error("workout not found");
  if (workout.endedAt) return (await getWorkoutSummary(id))!; // safe to call twice
  const sets = await db().sets.where("workoutId").equals(id).toArray();
  if (!sets.some((s) => s.completedAt)) throw new EmptyWorkoutError();

  await db().transaction("rw", db().workouts, db().workoutExercises, db().sets, async () => {
    await db().sets.bulkDelete(sets.filter((s) => !s.completedAt).map((s) => s.id));
    const wes = await db().workoutExercises.where("workoutId").equals(id).toArray();
    const remaining = new Set((await db().sets.where("workoutId").equals(id).toArray()).map((s) => s.workoutExerciseId));
    await db().workoutExercises.bulkDelete(wes.filter((we) => !remaining.has(we.id)).map((we) => we.id));
    await db().workouts.update(id, {
      endedAt: now(),
      restEndsAt: null,
      restTotalSec: null,
      rating: extra.rating ?? workout.rating,
      notes: extra.notes ?? workout.notes,
      updatedAt: now(),
    });
  });
  return (await getWorkoutSummary(id))!;
}

export async function discardWorkout(id: string): Promise<void> {
  await deleteWorkout(id);
}

export async function deleteWorkout(id: string): Promise<void> {
  await db().transaction("rw", db().workouts, db().workoutExercises, db().sets, async () => {
    await db().sets.where("workoutId").equals(id).delete();
    await db().workoutExercises.where("workoutId").equals(id).delete();
    await db().workouts.delete(id);
  });
}

export async function updateWorkout(id: string, patch: Partial<Pick<Workout, "name" | "notes" | "rating" | "restEndsAt" | "restTotalSec">>) {
  await db().workouts.update(id, { ...patch, updatedAt: now() });
}

// ---------- workouts: exercises and sets --------------------------------------

export async function addExerciseToWorkout(workoutId: string, exerciseId: string): Promise<string> {
  const position = await db().workoutExercises.where("workoutId").equals(workoutId).count();
  const prev = await previousSets(exerciseId, workoutId);
  const weId = uuid();
  const count = Math.max(1, prev.filter((s) => s.kind !== "warmup").length || 3);
  await db().transaction("rw", db().workoutExercises, db().sets, async () => {
    await db().workoutExercises.add({ id: weId, workoutId, exerciseId, position, supersetGroup: null, notes: null });
    await db().sets.bulkAdd(Array.from({ length: count }, (_, p) => emptySet(workoutId, weId, p)));
  });
  return weId;
}

export async function replaceExercise(workoutExerciseId: string, exerciseId: string): Promise<void> {
  const we = await db().workoutExercises.get(workoutExerciseId);
  if (!we) return;
  await db().transaction("rw", db().workoutExercises, db().sets, async () => {
    await db().workoutExercises.update(workoutExerciseId, { exerciseId });
    // Numbers from another exercise mean nothing here; keep the done ones, clear the planned ones.
    const sets = await db().sets.where("workoutExerciseId").equals(workoutExerciseId).toArray();
    await Promise.all(sets.filter((s) => !s.completedAt).map((s) => db().sets.update(s.id, { weightKg: null, reps: null, updatedAt: now() })));
  });
}

export async function removeWorkoutExercise(workoutExerciseId: string): Promise<void> {
  await db().transaction("rw", db().workoutExercises, db().sets, async () => {
    await db().sets.where("workoutExerciseId").equals(workoutExerciseId).delete();
    await db().workoutExercises.delete(workoutExerciseId);
  });
}

export async function addSet(workoutExerciseId: string): Promise<string> {
  const we = await db().workoutExercises.get(workoutExerciseId);
  if (!we) throw new Error("exercise not in workout");
  const sets = await db().sets.where("workoutExerciseId").equals(workoutExerciseId).toArray();
  const last = sets.sort((a, b) => a.position - b.position).at(-1);
  const s = emptySet(we.workoutId, workoutExerciseId, (last?.position ?? -1) + 1);
  await db().sets.add(s);
  return s.id;
}

export async function updateSet(id: string, patch: Partial<Pick<WorkoutSet, "weightKg" | "reps" | "kind">>): Promise<void> {
  await db().sets.update(id, { ...patch, updatedAt: now() });
}

export async function deleteSet(id: string): Promise<void> {
  await db().sets.delete(id);
}

/**
 * Marks a set done. Empty fields take the previous performance (the one-tap set).
 * Returns whether it beats every earlier estimated 1RM for this exercise.
 */
export async function completeSet(id: string, previous: PreviousSet | null): Promise<{ isPr: boolean; weightKg: number | null; reps: number | null }> {
  const set = await db().sets.get(id);
  if (!set) throw new Error("set not found");
  const we = await db().workoutExercises.get(set.workoutExerciseId);
  if (!we) throw new Error("exercise not in workout");
  const weightKg = set.weightKg ?? previous?.weightKg ?? null;
  const reps = set.reps ?? previous?.reps ?? null;

  let isPr = false;
  if (set.kind !== "warmup" && weightKg && reps) {
    const e1rm = estimateOneRepMax(weightKg, reps);
    const best = await bestE1rm(we.exerciseId, { excludeSetId: id });
    // A first-ever lift is not a record; there is nothing to beat yet.
    isPr = e1rm != null && best != null && e1rm > best + 0.01;
  }
  await db().sets.update(id, { weightKg, reps, completedAt: now(), isPr, updatedAt: now() });
  return { isPr, weightKg, reps };
}

export async function uncompleteSet(id: string): Promise<void> {
  await db().sets.update(id, { completedAt: null, isPr: false, updatedAt: now() });
}

// ---------- history and records -----------------------------------------------

/** The sets done for this exercise in the most recent finished workout (schema: previous_sets()). */
export async function previousSets(exerciseId: string, excludeWorkoutId?: string): Promise<PreviousSet[]> {
  const wes = await db().workoutExercises.where("exerciseId").equals(exerciseId).toArray();
  const workouts = (await db().workouts.bulkGet([...new Set(wes.map((w) => w.workoutId))]))
    .filter((w): w is Workout => !!w && !!w.endedAt && w.id !== excludeWorkoutId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const last = workouts[0];
  if (!last) return [];
  const weIds = wes.filter((we) => we.workoutId === last.id).map((we) => we.id);
  const sets = (await db().sets.where("workoutExerciseId").anyOf(weIds).toArray())
    .filter((s) => s.completedAt)
    .sort((a, b) => a.position - b.position);
  return sets.map((s, i) => ({ position: i, kind: s.kind, weightKg: s.weightKg, reps: s.reps }));
}

/** Best estimated 1RM so far, across finished and open workouts, ignoring warmups. */
export async function bestE1rm(exerciseId: string, opts: { excludeSetId?: string } = {}): Promise<number | null> {
  const weIds = (await db().workoutExercises.where("exerciseId").equals(exerciseId).toArray()).map((w) => w.id);
  if (!weIds.length) return null;
  const sets = await db().sets.where("workoutExerciseId").anyOf(weIds).toArray();
  let best: number | null = null;
  for (const s of sets) {
    if (s.id === opts.excludeSetId || !s.completedAt || s.kind === "warmup" || !s.weightKg || !s.reps) continue;
    const e = estimateOneRepMax(s.weightKg, s.reps);
    if (e != null && (best == null || e > best)) best = e;
  }
  return best;
}

export type WorkoutDetail = {
  workout: Workout;
  exercises: { we: WorkoutExercise; exercise: Exercise; sets: WorkoutSet[] }[];
};

export async function getWorkoutDetail(id: string): Promise<WorkoutDetail | undefined> {
  const workout = await db().workouts.get(id);
  if (!workout) return undefined;
  const wes = (await db().workoutExercises.where("workoutId").equals(id).toArray()).sort((a, b) => a.position - b.position);
  const sets = await db().sets.where("workoutId").equals(id).toArray();
  const exercises = await db().exercises.bulkGet(wes.map((w) => w.exerciseId));
  return {
    workout,
    exercises: wes
      .map((we, i) => ({
        we,
        exercise: exercises[i]!,
        sets: sets.filter((s) => s.workoutExerciseId === we.id).sort((a, b) => a.position - b.position),
      }))
      .filter((x) => x.exercise),
  };
}

function volumeOf(sets: WorkoutSet[]): number {
  return sets.reduce((v, s) => (s.completedAt && s.kind !== "warmup" && s.weightKg && s.reps ? v + s.weightKg * s.reps : v), 0);
}

export async function getWorkoutSummary(id: string): Promise<WorkoutSummary | undefined> {
  const detail = await getWorkoutDetail(id);
  if (!detail) return undefined;
  const { workout, exercises } = detail;
  const done = exercises.flatMap((x) => x.sets.filter((s) => s.completedAt));
  const end = workout.endedAt ? new Date(workout.endedAt) : new Date();
  const volumeKg = volumeOf(done);

  const records = exercises.flatMap(({ exercise, sets }) => {
    const best = sets
      .filter((s) => s.isPr && s.weightKg && s.reps)
      .map((s) => ({ s, e: estimateOneRepMax(s.weightKg!, s.reps!) ?? 0 }))
      .sort((a, b) => b.e - a.e)[0];
    return best ? [{ exerciseId: exercise.id, exerciseName: exercise.nameHe, weightKg: best.s.weightKg!, reps: best.s.reps!, e1rm: best.e }] : [];
  });

  let vsPrevious: WorkoutSummary["vsPrevious"] = null;
  if (workout.templateId) {
    const prior = (await db().workouts.where("templateId").equals(workout.templateId).toArray())
      .filter((w) => w.id !== id && w.endedAt && w.startedAt < workout.startedAt)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (prior) {
      const priorSets = await db().sets.where("workoutId").equals(prior.id).toArray();
      vsPrevious = { volumeDeltaKg: volumeKg - volumeOf(priorSets) };
    }
  }

  return {
    workout,
    durationSec: Math.max(0, Math.round((end.getTime() - new Date(workout.startedAt).getTime()) / 1000)),
    setCount: done.filter((s) => s.kind !== "warmup").length,
    exerciseCount: exercises.filter((x) => x.sets.some((s) => s.completedAt)).length,
    volumeKg,
    records,
    vsPrevious,
  };
}

export async function listFinishedWorkouts(): Promise<WorkoutSummary[]> {
  const workouts = (await db().workouts.toArray())
    .filter((w) => w.endedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return (await Promise.all(workouts.map((w) => getWorkoutSummary(w.id)))).filter((x): x is WorkoutSummary => !!x);
}

export async function exerciseHistory(exerciseId: string): Promise<{ workout: Workout; sets: WorkoutSet[]; bestE1rm: number | null }[]> {
  const wes = await db().workoutExercises.where("exerciseId").equals(exerciseId).toArray();
  const rows = await Promise.all(
    wes.map(async (we) => {
      const workout = await db().workouts.get(we.workoutId);
      const sets = (await db().sets.where("workoutExerciseId").equals(we.id).toArray())
        .filter((s) => s.completedAt)
        .sort((a, b) => a.position - b.position);
      const best = sets.reduce<number | null>((m, s) => {
        if (s.kind === "warmup" || !s.weightKg || !s.reps) return m;
        const e = estimateOneRepMax(s.weightKg, s.reps);
        return e != null && (m == null || e > m) ? e : m;
      }, null);
      return workout?.endedAt ? { workout, sets, bestE1rm: best } : null;
    }),
  );
  return rows.filter((r): r is NonNullable<typeof r> => !!r).sort((a, b) => b.workout.startedAt.localeCompare(a.workout.startedAt));
}
