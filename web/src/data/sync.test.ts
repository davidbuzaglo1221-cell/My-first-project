import { beforeEach, describe, expect, it } from "vitest";
import type { Collection, DocSnap, Query, QuerySnap } from "@/lib/runtime";
import { db } from "./db";
import { addExerciseToWorkout, addSet, completeSet, deleteWorkout, finishWorkout, listExercises, listTemplates, startWorkout, updateSet } from "./repo";
import { logBodyweight } from "./body-repo";
import { dirtyForTests, flush, installHooks, pullForTests, resetSyncForTests } from "./sync";

// An in-memory stand-in for the artifact's document store: the calls the sync makes.
function fakeCollection() {
  const docs = new Map<string, Record<string, unknown>>();
  const snap = (rows: [string, Record<string, unknown>][]): QuerySnap => ({
    docs: rows.map(([id, d]): DocSnap => ({ id, exists: true, data: () => structuredClone(d) })),
    docChanges: () => [],
  });
  const query = (filters: ((d: Record<string, unknown>) => boolean)[], order: string | null, n: number): Query => ({
    where: (f, op, v) => query([...filters, (d) => (op === ">" ? String(d[f]) > String(v) : d[f] === v)], order, n),
    orderBy: (f) => query(filters, f, n),
    limit: (k) => query(filters, order, k),
    get: async () => {
      let rows = [...docs].filter(([, d]) => filters.every((f) => f(d)));
      if (order) rows = rows.sort(([, a], [, b]) => String(a[order]).localeCompare(String(b[order])));
      return snap(rows.slice(0, n));
    },
    onSnapshot: () => () => {},
  });
  const c: Collection = Object.assign(query([], null, 1000), {
    doc: (id: string) => ({
      get: async () => ({ id, exists: docs.has(id), data: () => docs.get(id) }),
      set: async (d: Record<string, unknown>) => {
        if (JSON.stringify(d).length > 256 * 1024) throw { code: "invalid_argument", message: "too big" };
        docs.set(id, structuredClone(d));
      },
      delete: async () => void docs.delete(id),
    }),
  });
  return { c, docs };
}

async function freshPhone() {
  await db().delete();
  await db().open();
}

beforeEach(async () => {
  installHooks(db());
  await freshPhone();
  resetSyncForTests(null);
});

describe("cloud sync", () => {
  it("leaves the starter data alone until there is a cloud to send it to", async () => {
    expect(dirtyForTests.size).toBe(0);
  });

  it("copies a first phone up, then a second phone takes it whole, ids and all", async () => {
    const remote = fakeCollection();
    const [bench] = await listExercises({ query: "לחיצת חזה" });
    const w = await startWorkout();
    const we = await addExerciseToWorkout(w, bench.id);
    const s = await addSet(we);
    await updateSet(s, { weightKg: 80, reps: 5 });
    await completeSet(s, null);
    await finishWorkout(w);
    await logBodyweight(81, "2026-10-20");

    // First phone: the cloud is empty, so everything goes up.
    resetSyncForTests(remote.c);
    await pullForTests(db(), remote.c);
    await flush();
    expect(remote.docs.has(`w.${w}`)).toBe(true);
    expect(remote.docs.has("b.2026")).toBe(true);
    expect(remote.docs.has("p")).toBe(true);
    const templatesUp = (await listTemplates()).length;

    // Second phone: fresh starter data with new ids, then the pull replaces it.
    await freshPhone();
    resetSyncForTests(remote.c);
    await pullForTests(db(), remote.c);
    const sets = await db().sets.where("workoutId").equals(w).toArray();
    expect(sets.map((x) => [x.weightKg, x.reps])).toEqual([[80, 5]]);
    expect((await db().exercises.get(bench.id))?.nameHe).toBe(bench.nameHe);
    expect((await listTemplates()).length).toBe(templatesUp);
    expect(dirtyForTests.size).toBe(0);
  });

  it("sends a change as the group it belongs to, and a deletion as a delete", async () => {
    const remote = fakeCollection();
    resetSyncForTests(remote.c);
    await pullForTests(db(), remote.c);
    await flush();
    const w = await startWorkout();
    expect(dirtyForTests.has(`w.${w}`)).toBe(true);
    await flush();
    expect(remote.docs.has(`w.${w}`)).toBe(true);
    await deleteWorkout(w);
    await flush();
    expect(remote.docs.has(`w.${w}`)).toBe(false);
  });

  it("applies a newer copy from another device without echoing it back", async () => {
    const remote = fakeCollection();
    resetSyncForTests(remote.c);
    await pullForTests(db(), remote.c);
    await flush();
    await logBodyweight(80, "2026-10-21");
    await flush();
    const doc = remote.docs.get("b.2026") as { rows: { bodyMetrics: { weightKg: number }[] }; rev: number };
    doc.rows.bodyMetrics[0].weightKg = 79;
    doc.rev += 1000;
    await pullForTests(db(), remote.c);
    expect((await db().bodyMetrics.toArray())[0].weightKg).toBe(79);
    expect(dirtyForTests.size).toBe(0);
  });

  it("removes a group another device deleted", async () => {
    const remote = fakeCollection();
    resetSyncForTests(remote.c);
    await pullForTests(db(), remote.c);
    await flush();
    const w = await startWorkout();
    await flush();
    remote.docs.delete(`w.${w}`);
    await pullForTests(db(), remote.c);
    expect(await db().workouts.get(w)).toBeUndefined();
  });
});

describe("flush", () => {
  it("settles when called with nothing waiting, and still sends later changes", async () => {
    const remote = fakeCollection();
    resetSyncForTests(remote.c);
    await pullForTests(db(), remote.c);
    await flush();
    await flush(); // nothing waiting
    await Promise.all([flush(), flush()]);
    const w = await startWorkout();
    await flush();
    expect(remote.docs.has(`w.${w}`)).toBe(true);
  });
});
