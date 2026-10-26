import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import {
  EmptyWorkoutError,
  WorkoutAlreadyOpenError,
  addExerciseToWorkout,
  addSet,
  applyPlan,
  completeSet,
  deleteTemplate,
  deleteWorkout,
  editPastSet,
  getTemplateDetail,
  saveTemplate,
  finishWorkout,
  getOpenWorkout,
  getWorkoutDetail,
  listExercises,
  listFinishedWorkouts,
  listTemplates,
  previousSets,
  saveWorkoutAsTemplate,
  startWorkout,
  updateSet,
} from "./repo";
import { generatePlan } from "@/lib/plans";

async function squatId() {
  return (await listExercises({ query: "סקוואט עם מוט" }))[0].id;
}

/** Logs one finished workout of squats with the given sets. */
async function loggedSquats(sets: [number, number][]) {
  const id = await startWorkout();
  const weId = await addExerciseToWorkout(id, await squatId());
  const planned = (await getWorkoutDetail(id))!.exercises[0].sets;
  for (const [i, [w, r]] of sets.entries()) {
    const setId = planned[i]?.id ?? (await addSet(weId));
    await updateSet(setId, { weightKg: w, reps: r });
    await completeSet(setId, null);
  }
  await finishWorkout(id);
  return id;
}

beforeEach(async () => {
  await db().delete();
  await db().open();
});

describe("seed", () => {
  it("has a Hebrew library and two starting templates", async () => {
    expect((await listExercises()).length).toBeGreaterThan(30);
    const templates = await listTemplates();
    expect(templates.map((t) => t.template.name)).toEqual(["גוף מלא A", "גוף מלא B"]);
    expect(templates[0].items[0].exercise.nameHe).toBe("סקוואט עם מוט");
  });

  it("finds exercises by alias and ignores geresh", async () => {
    expect((await listExercises({ query: "בנץ" })).map((e) => e.slug)).toContain("bench-press");
    expect((await listExercises({ query: "לאנגים" })).map((e) => e.slug)).toContain("walking-lunge");
    expect((await listExercises({ muscles: ["arms"] })).every((e) => e.primaryMuscle === "arms")).toBe(true);
  });
});

describe("workout lifecycle", () => {
  it("starts from a template with planned sets", async () => {
    const [a] = await listTemplates();
    const id = await startWorkout({ templateId: a.template.id });
    const detail = (await getWorkoutDetail(id))!;
    expect(detail.workout.name).toBe("גוף מלא A");
    expect(detail.exercises.map((x) => x.sets.length)).toEqual([3, 3, 3, 2]);
  });

  it("allows one open workout at a time", async () => {
    await startWorkout();
    await expect(startWorkout()).rejects.toBeInstanceOf(WorkoutAlreadyOpenError);
  });

  it("refuses to finish a workout with nothing done", async () => {
    const id = await startWorkout();
    await addExerciseToWorkout(id, await squatId());
    await expect(finishWorkout(id)).rejects.toBeInstanceOf(EmptyWorkoutError);
  });

  it("drops sets that were never done and is safe to finish twice", async () => {
    const id = await startWorkout();
    await addExerciseToWorkout(id, await squatId());
    const [first] = (await getWorkoutDetail(id))!.exercises[0].sets;
    await updateSet(first.id, { weightKg: 100, reps: 5 });
    await completeSet(first.id, null);
    const summary = await finishWorkout(id);
    expect(summary.setCount).toBe(1);
    expect(summary.volumeKg).toBe(500);
    expect((await finishWorkout(id)).setCount).toBe(1);
    expect(await getOpenWorkout()).toBeUndefined();
  });
});

describe("previous performance and records", () => {
  it("returns last time's sets, and the one-tap set copies them", async () => {
    await loggedSquats([[100, 5], [100, 5], [100, 4]]);
    const prev = await previousSets(await squatId());
    expect(prev.map((p) => [p.weightKg, p.reps])).toEqual([[100, 5], [100, 5], [100, 4]]);

    const id = await startWorkout();
    await addExerciseToWorkout(id, await squatId());
    const sets = (await getWorkoutDetail(id))!.exercises[0].sets;
    expect(sets).toHaveLength(3); // as many work sets as last time
    const r = await completeSet(sets[0].id, prev[0]);
    expect([r.weightKg, r.reps]).toEqual([100, 5]);
    expect(r.isPr).toBe(false); // equal is not a record
  });

  it("a heavier set is a record, the first ever lift is not", async () => {
    const firstId = await loggedSquats([[100, 5]]);
    expect((await getWorkoutDetail(firstId))!.exercises[0].sets[0].isPr).toBe(false);

    const id = await startWorkout();
    await addExerciseToWorkout(id, await squatId());
    const [s] = (await getWorkoutDetail(id))!.exercises[0].sets;
    await updateSet(s.id, { weightKg: 105, reps: 5 });
    expect((await completeSet(s.id, null)).isPr).toBe(true);
    const summary = await finishWorkout(id);
    expect(summary.records).toEqual([expect.objectContaining({ exerciseName: "סקוואט עם מוט", weightKg: 105, reps: 5 })]);
  });

  it("warmups never count as records", async () => {
    await loggedSquats([[100, 5]]);
    const id = await startWorkout();
    await addExerciseToWorkout(id, await squatId());
    const [s] = (await getWorkoutDetail(id))!.exercises[0].sets;
    await updateSet(s.id, { weightKg: 140, reps: 5, kind: "warmup" });
    expect((await completeSet(s.id, null)).isPr).toBe(false);
  });
});

describe("history", () => {
  it("lists finished workouts newest first and can delete one", async () => {
    const a = await loggedSquats([[100, 5]]);
    const b = await loggedSquats([[102.5, 5]]);
    expect((await listFinishedWorkouts()).map((w) => w.workout.id)).toEqual([b, a]);
    await deleteWorkout(b);
    expect((await listFinishedWorkouts()).map((w) => w.workout.id)).toEqual([a]);
    expect((await previousSets(await squatId()))[0].weightKg).toBe(100);
  });

  it("saves a finished workout as a template", async () => {
    const id = await loggedSquats([[100, 5], [100, 8]]);
    const tid = await saveWorkoutAsTemplate(id, "רגליים שלי");
    const t = (await listTemplates()).find((x) => x.template.id === tid)!;
    expect(t.items[0].item).toMatchObject({ targetSets: 2, targetRepsMin: 5, targetRepsMax: 8 });
  });
});

describe("editing history and templates", () => {
  it("fixing a typo removes the false record and promotes the real one", async () => {
    await loggedSquats([[100, 5]]);
    const typo = await loggedSquats([[1000, 5]]); // meant 100
    const later = await loggedSquats([[105, 5]]);
    const typoSet = (await getWorkoutDetail(typo))!.exercises[0].sets[0];
    expect(typoSet.isPr).toBe(true);
    expect((await getWorkoutDetail(later))!.exercises[0].sets[0].isPr).toBe(false);

    await editPastSet(typoSet.id, { weightKg: 100 });
    expect((await getWorkoutDetail(typo))!.exercises[0].sets[0].isPr).toBe(false);
    expect((await getWorkoutDetail(later))!.exercises[0].sets[0].isPr).toBe(true);
  });

  it("deleting a workout re-marks the records after it", async () => {
    await loggedSquats([[100, 5]]);
    const big = await loggedSquats([[120, 5]]);
    const mid = await loggedSquats([[110, 5]]);
    expect((await getWorkoutDetail(mid))!.exercises[0].sets[0].isPr).toBe(false);
    await deleteWorkout(big);
    expect((await getWorkoutDetail(mid))!.exercises[0].sets[0].isPr).toBe(true);
  });

  it("saves, reorders and deletes a template; its rest reaches the workout", async () => {
    const squat = await squatId();
    const bench = (await listExercises({ query: "לחיצת חזה במוט" }))[0].id;
    const id = await saveTemplate({
      name: "שלי",
      items: [
        { exerciseId: squat, targetSets: 4, targetRepsMin: 5, targetRepsMax: 3, targetRestSec: 180 },
        { exerciseId: bench, targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetRestSec: 120 },
      ],
    });
    let t = (await getTemplateDetail(id))!;
    expect(t.items.map((i) => i.exercise.id)).toEqual([squat, bench]);
    expect(t.items[0].item.targetRepsMax).toBe(5); // max never below min
    await saveTemplate({ id, name: "שלי", items: [t.items[1], t.items[0]].map(({ item }) => ({ ...item })) });
    t = (await getTemplateDetail(id))!;
    expect(t.items.map((i) => i.exercise.id)).toEqual([bench, squat]);

    const w = await startWorkout({ templateId: id });
    expect((await getWorkoutDetail(w))!.exercises.map((x) => x.we.restSec)).toEqual([120, 180]);
    await deleteWorkout(w);
    await deleteTemplate(id);
    expect(await getTemplateDetail(id)).toBeUndefined();
  });

  it("the library has 80+ exercises", async () => {
    expect((await listExercises()).length).toBeGreaterThanOrEqual(80);
  });
});

describe("onboarding plan", () => {
  it("replaces the starter templates and keeps the user's own", async () => {
    const mine = await saveTemplate({ name: "שלי", items: [{ exerciseId: await squatId(), targetSets: 3, targetRepsMin: 5, targetRepsMax: 8, targetRestSec: 120 }] });
    const plan = generatePlan({ days: 4, equipment: "gym", experience: "intermediate", goal: "build_muscle" });
    await applyPlan(plan.templates);
    const names = (await listTemplates()).map((t) => t.template.name);
    expect(names).toEqual(expect.arrayContaining(["שלי", "עליון A", "תחתון A", "עליון B", "תחתון B"]));
    expect(names).not.toContain("גוף מלא A");
    expect((await listTemplates()).find((t) => t.template.name === "עליון A")!.items).toHaveLength(6);
    expect(await getTemplateDetail(mine)).toBeDefined();
  });
});
