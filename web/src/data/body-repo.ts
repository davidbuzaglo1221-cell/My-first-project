import { db } from "./db";
import { localDateKey } from "@/lib/nutrition";
import { computeStrength, explainChange, type StrengthChange, type StrengthResult } from "@/lib/strength";
import { getProfile, updateProfile } from "./repo";
import type { BodyMetric } from "./types";

// Bodyweight log and the Strength Score that depends on it.

/** One weigh-in per day: a second one on the same day replaces the first. Also keeps the profile current. */
export async function logBodyweight(weightKg: number, date = localDateKey()): Promise<void> {
  await db().transaction("rw", db().bodyMetrics, db().profile, async () => {
    const existing = await db().bodyMetrics.where("date").equals(date).first();
    const row: BodyMetric = { id: existing?.id ?? crypto.randomUUID(), date, measuredAt: new Date().toISOString(), weightKg };
    await db().bodyMetrics.put(row);
    const latest = (await db().bodyMetrics.orderBy("date").last())!;
    await updateProfile({ bodyweightKg: latest.weightKg });
  });
}

export async function deleteBodyweight(id: string): Promise<void> {
  await db().bodyMetrics.delete(id);
}

export async function listBodyweight(): Promise<BodyMetric[]> {
  return db().bodyMetrics.orderBy("date").toArray();
}

/** Bodyweight in effect on `date`: the latest weigh-in on or before it, else the profile's. */
export async function bodyweightOn(date: string): Promise<number | null> {
  const row = (await db().bodyMetrics.where("date").belowOrEqual(date).sortBy("date")).at(-1);
  if (row) return row.weightKg;
  return (await getProfile()).bodyweightKg;
}

export type StrengthReport = {
  now: StrengthResult;
  change: StrengthChange;
  bodyweightKg: number;
  sexKnown: boolean;
};

/** The score today and its change from 7 days ago, explained. Null until there is a scoring lift and a bodyweight. */
export async function getStrengthReport(formatWeight: (kg: number) => string, asOf = new Date()): Promise<StrengthReport | null | "no_bodyweight"> {
  const [profile, exercises, sets, workouts] = await Promise.all([
    getProfile(),
    db().exercises.toArray(),
    db().sets.toArray(),
    db().workouts.toArray(),
  ]);
  const wes = await db().workoutExercises.toArray();
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const weById = new Map(wes.map((w) => [w.id, w]));
  const finished = new Set(workouts.filter((w) => w.endedAt).map((w) => w.id));
  const scored = sets
    .filter((s) => finished.has(s.workoutId))
    .map((s) => {
      const ex = exById.get(weById.get(s.workoutExerciseId)?.exerciseId ?? "");
      return { slug: ex?.slug ?? null, exerciseName: ex?.nameHe ?? "", weightKg: s.weightKg, reps: s.reps, kind: s.kind, completedAt: s.completedAt };
    });

  const weekAgo = new Date(asOf.getTime() - 7 * 86_400_000);
  const bwNow = await bodyweightOn(localDateKey(asOf));
  if (!bwNow) return "no_bodyweight";
  const bwBefore = (await bodyweightOn(localDateKey(weekAgo))) ?? bwNow;
  const sex = profile.sex ?? "male";
  const now = computeStrength(scored, { bodyweightKg: bwNow, sex, asOf });
  if (!now) return null;
  const before = computeStrength(scored, { bodyweightKg: bwBefore, sex, asOf: weekAgo });
  return { now, change: explainChange(now, before, { now: bwNow, before: bwBefore }, formatWeight), bodyweightKg: bwNow, sexKnown: !!profile.sex };
}
