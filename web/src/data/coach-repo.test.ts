import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { addExerciseToWorkout, completeSet, finishWorkout, getWorkoutDetail, listExercises, startWorkout, updateProfile, updateSet } from "./repo";
import { estimateCardioKcal, getCoachSummary, getWorkoutCelebration, linkWithNext, listCardio, logCardio, markLessonRead, unlinkSuperset } from "./coach-repo";
import { logBodyweight } from "./body-repo";
import { LESSONS } from "@/lib/lessons";

beforeEach(async () => {
  await db().delete();
  await db().open();
});

async function oneWorkout(weight = 100) {
  const id = await startWorkout();
  const squat = (await listExercises({ query: "סקוואט עם מוט" }))[0];
  await addExerciseToWorkout(id, squat.id);
  const [s] = (await getWorkoutDetail(id))!.exercises[0].sets;
  await updateSet(s.id, { weightKg: weight, reps: 5 });
  await completeSet(s.id, null);
  await finishWorkout(id);
  return id;
}

describe("coach", () => {
  it("the first workout unlocks its badge, the streak counts the week at goal", async () => {
    await updateProfile({ daysPerWeek: 1 });
    await logBodyweight(80);
    const id = await oneWorkout(100);
    const c = await getWorkoutCelebration(id);
    expect(c.unlocked.map((a) => a.id)).toEqual(expect.arrayContaining(["first-workout", "squat-100"]));
    expect(c.weekStreak).toBe(1);
    const s = await getCoachSummary();
    expect(s.thisWeek).toBe(1);
    expect(s.achievements.find((a) => a.id === "workouts-10")!.progress).toBeCloseTo(0.1);
  });

  it("lesson of the day moves on once read", async () => {
    expect((await getCoachSummary()).lesson.id).toBe(LESSONS[0].id);
    await markLessonRead(LESSONS[0].id);
    expect((await getCoachSummary()).lesson.id).toBe(LESSONS[1].id);
  });
});

describe("cardio", () => {
  it("estimates calories from MET, bodyweight and time", async () => {
    expect(estimateCardioKcal("run", 30, 80)).toBe(392); // 9.8 × 80 × 0.5
    await logBodyweight(80);
    await logCardio({ kind: "walk", minutes: 60 });
    expect((await listCardio())[0].kcal).toBe(280);
  });
});

describe("supersets", () => {
  it("links with the next exercise and unlinks back to singles", async () => {
    const id = await startWorkout();
    const [a, b, c] = (await listExercises()).slice(0, 3);
    for (const e of [a, b, c]) await addExerciseToWorkout(id, e.id);
    let wes = (await getWorkoutDetail(id))!.exercises.map((x) => x.we);
    await linkWithNext(wes[0].id);
    await linkWithNext(wes[1].id);
    wes = (await getWorkoutDetail(id))!.exercises.map((x) => x.we);
    expect(new Set(wes.map((w) => w.supersetGroup)).size).toBe(1);
    await unlinkSuperset(wes[2].id);
    await unlinkSuperset(wes[1].id);
    wes = (await getWorkoutDetail(id))!.exercises.map((x) => x.we);
    expect(wes.map((w) => w.supersetGroup)).toEqual([null, null, null]);
  });
});
