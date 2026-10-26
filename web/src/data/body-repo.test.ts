import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { bodyweightOn, getStrengthReport, listBodyweight, logBodyweight } from "./body-repo";
import { addExerciseToWorkout, completeSet, finishWorkout, getProfile, getWorkoutDetail, listExercises, startWorkout, updateSet } from "./repo";

beforeEach(async () => {
  await db().delete();
  await db().open();
});

const kg = (n: number) => `${n} ק"ג`;

describe("bodyweight", () => {
  it("keeps one weigh-in per day and updates the profile", async () => {
    await logBodyweight(81, "2026-10-20");
    await logBodyweight(80.4, "2026-10-20");
    await logBodyweight(80, "2026-10-25");
    expect((await listBodyweight()).map((r) => r.weightKg)).toEqual([80.4, 80]);
    expect((await getProfile()).bodyweightKg).toBe(80);
    expect(await bodyweightOn("2026-10-22")).toBe(80.4);
  });
});

describe("strength report", () => {
  it("asks for a bodyweight first, then scores a finished workout", async () => {
    expect(await getStrengthReport(kg)).toBe("no_bodyweight");
    await logBodyweight(80);
    expect(await getStrengthReport(kg)).toBeNull(); // no scoring lift yet

    const id = await startWorkout();
    const squat = (await listExercises({ query: "סקוואט עם מוט" }))[0];
    await addExerciseToWorkout(id, squat.id);
    const [s] = (await getWorkoutDetail(id))!.exercises[0].sets;
    await updateSet(s.id, { weightKg: 100, reps: 6 });
    await completeSet(s.id, null);
    await finishWorkout(id);

    const r = await getStrengthReport(kg);
    expect(r && r !== "no_bodyweight" && r.now.total).toBe(300);
  });
});
