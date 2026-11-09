import Dexie, { type Transaction } from "dexie";
import { useSyncExternalStore } from "react";
import { cap, type Collection, type Db } from "@/lib/runtime";
import { db, type LocalDb } from "./db";

// Cloud copy of the data for the artifact build: IndexedDB stays the working copy (fast, live
// queries, works offline), and every change is written to the Claude account's private store
// (data/users/<id>/…), so the data survives a cleared browser and appears on every device.
//
// Rows travel in groups, one document each, so a year of training stays a few hundred documents:
//   w.<workoutId>  a workout with its exercises and sets     f.<date>    a day of food
//   b.<year> / c.<year>  weigh-ins / cardio                  p           profile, targets, lessons read
//   t.<templateId> a template with its exercises             x.<n> / fo.<n>  exercises / own foods, hashed
//   mp.<id> / pp.<id>  one meal photo / one progress photo
//   m.<yyyy-mm> / ci.<yyyy-mm> / bz.<yyyy-mm>  a month of missions / check-ins / cuts
//   ss.<id> / cn.<id>  one sales practice / one coach note        (the journey row rides in p)
// A group is last-writer-wins by `rev` (ms). Library foods (id "seed:…") are not copied: every
// install has them.

type Row = Record<string, unknown> & { id: string };
type TableName =
  | "profile" | "exercises" | "templates" | "templateExercises" | "workouts" | "workoutExercises" | "sets"
  | "foods" | "foodLogs" | "mealPhotos" | "targets" | "bodyMetrics" | "cardio" | "progressPhotos" | "lessonReads"
  | "journey" | "missions" | "checkins" | "cuts" | "salesSessions" | "coachNotes";

const hash = (s: string, n: number) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
};

/** Which group a row belongs to, or null for rows that are not copied. */
export function groupOf(table: TableName, row: Row): string | null {
  switch (table) {
    case "workouts": return `w.${row.id}`;
    case "workoutExercises":
    case "sets": return `w.${row.workoutId}`;
    case "foodLogs": return `f.${row.logDate}`;
    case "mealPhotos": return `mp.${row.id}`;
    case "progressPhotos": return `pp.${row.id}`;
    case "bodyMetrics": return `b.${String(row.date).slice(0, 4)}`;
    case "cardio": return `c.${String(row.date).slice(0, 4)}`;
    case "templates": return `t.${row.id}`;
    case "templateExercises": return `t.${row.templateId}`;
    case "exercises": return `x.${hash(row.id, 4)}`;
    case "foods": return row.id.startsWith("seed:") ? null : `fo.${hash(row.id, 8)}`;
    case "missions": return `m.${String(row.date).slice(0, 7)}`;
    case "checkins": return `ci.${String(row.date).slice(0, 7)}`;
    case "cuts": return `bz.${String(row.date).slice(0, 7)}`;
    case "salesSessions": return `ss.${row.id}`;
    case "coachNotes": return `cn.${row.id}`;
    case "profile":
    case "targets":
    case "journey":
    case "lessonReads": return "p";
  }
}

const TABLES_OF: Record<string, TableName[]> = {
  w: ["workouts", "workoutExercises", "sets"],
  f: ["foodLogs"],
  mp: ["mealPhotos"],
  pp: ["progressPhotos"],
  b: ["bodyMetrics"],
  c: ["cardio"],
  t: ["templates", "templateExercises"],
  x: ["exercises"],
  fo: ["foods"],
  m: ["missions"],
  ci: ["checkins"],
  bz: ["cuts"],
  ss: ["salesSessions"],
  cn: ["coachNotes"],
  p: ["profile", "targets", "lessonReads", "journey"],
};
export const SYNCED_TABLES = [...new Set(Object.values(TABLES_OF).flat())];

const prefixOf = (group: string) => group.split(".")[0];
const argOf = (group: string) => group.slice(group.indexOf(".") + 1);

/** The rows of one group, read from IndexedDB. */
export async function loadGroup(d: LocalDb, group: string): Promise<Partial<Record<TableName, Row[]>>> {
  const a = argOf(group);
  const t = (n: TableName) => d.table<Row, string>(n);
  const one = async (n: TableName) => {
    const r = await t(n).get(a);
    return r ? [r] : [];
  };
  const byGroup = async (n: TableName) => (await t(n).toArray()).filter((r) => groupOf(n, r) === group);
  switch (prefixOf(group)) {
    case "w":
      return {
        workouts: await one("workouts"),
        workoutExercises: await t("workoutExercises").where("workoutId").equals(a).toArray(),
        sets: await t("sets").where("workoutId").equals(a).toArray(),
      };
    case "f": return { foodLogs: await t("foodLogs").where("logDate").equals(a).toArray() };
    case "mp": return { mealPhotos: await one("mealPhotos") };
    case "pp": return { progressPhotos: await one("progressPhotos") };
    case "b": return { bodyMetrics: await t("bodyMetrics").where("date").startsWith(a).toArray() };
    case "c": return { cardio: await t("cardio").where("date").startsWith(a).toArray() };
    case "t": return { templates: await one("templates"), templateExercises: await t("templateExercises").where("templateId").equals(a).toArray() };
    case "x": return { exercises: await byGroup("exercises") };
    case "fo": return { foods: await byGroup("foods") };
    case "m": return { missions: await t("missions").where("date").startsWith(a).toArray() };
    case "ci": return { checkins: await t("checkins").where("date").startsWith(a).toArray() };
    case "bz": return { cuts: await t("cuts").where("date").startsWith(a).toArray() };
    case "ss": return { salesSessions: await one("salesSessions") };
    case "cn": return { coachNotes: await one("coachNotes") };
    case "p": return { profile: await t("profile").toArray(), targets: await t("targets").toArray(), lessonReads: await t("lessonReads").toArray(), journey: await t("journey").toArray() };
    default: return {};
  }
}

const isEmpty = (rows: Partial<Record<TableName, Row[]>>) => Object.values(rows).every((l) => !l?.length);

// ---- state ----------------------------------------------------------------------------------

export type SyncStatus = "local" | "connecting" | "synced" | "saving" | "offline" | "full";
let status: SyncStatus = "local";
const statusListeners = new Set<() => void>();
function setStatus(s: SyncStatus) {
  if (s === status) return;
  status = s;
  for (const l of statusListeners) l();
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => (statusListeners.add(l), () => statusListeners.delete(l)),
    () => status,
    () => status,
  );
}

const DIRTY_KEY = "sync-dirty";
const DEVICE = Math.random().toString(36).slice(2, 10); // per page load: tells our own echoes apart
const dirty = new Set<string>(readDirty());
const syncTx = new WeakSet<Transaction>();
let col: Collection | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let flushing: Promise<void> | null = null;
let hooked = false;

function readDirty(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DIRTY_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveDirty() {
  try {
    localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty]));
  } catch {
    // Storage blocked: the set is still flushed from memory.
  }
}

function mark(group: string | null) {
  if (!group) return;
  dirty.add(group);
  saveDirty();
  if (!col) return;
  setStatus("saving");
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), 1200);
}

/** Watches every write to the copied tables, except the sync's own and the database's set-up. */
export function installHooks(d: LocalDb) {
  if (hooked) return;
  hooked = true;
  // A sync write can run as a sub-transaction of the pull's; its parent then carries the mark.
  const skip = (tx: Transaction | undefined) => {
    for (let t = tx as (Transaction & { parent?: Transaction; mode?: string }) | undefined; t; t = t.parent) {
      if (syncTx.has(t) || t.mode === "versionchange") return true;
    }
    return !tx;
  };
  for (const name of SYNCED_TABLES) {
    const table = d.table<Row, string>(name);
    table.hook("creating", (_k, obj, tx) => {
      if (!skip(tx)) mark(groupOf(name, obj));
    });
    table.hook("updating", (mods, _k, obj, tx) => {
      if (skip(tx)) return;
      mark(groupOf(name, obj));
      mark(groupOf(name, { ...obj, ...(mods as Partial<Row>) }));
    });
    table.hook("deleting", (_k, obj, tx) => {
      if (!skip(tx)) mark(groupOf(name, obj));
    });
  }
}

/** Writes one group's rows inside a transaction the hooks ignore. */
async function writeLocal(d: LocalDb, group: string, rows: Partial<Record<TableName, Row[]>>, rev: number) {
  const tables = TABLES_OF[prefixOf(group)];
  if (!tables) return;
  await d.transaction("rw", [...tables.map((n) => d.table(n)), d._sync], async () => {
    syncTx.add(Dexie.currentTransaction);
    const existing = await loadGroup(d, group);
    for (const n of tables) {
      const keep = new Set((rows[n] ?? []).map((r) => r.id));
      const gone = (existing[n] ?? []).map((r) => r.id).filter((id) => !keep.has(id));
      if (gone.length) await d.table(n).bulkDelete(gone);
      if (rows[n]?.length) await d.table(n).bulkPut(rows[n]!);
    }
    if (rev) await d._sync.put({ id: group, rev });
    else await d._sync.delete(group);
  });
}

type Remote = { k: string; rev: number; dev?: string; rows: Partial<Record<TableName, Row[]>> };
const asRemote = (data: Record<string, unknown> | undefined): Remote | null =>
  data && typeof data.k === "string" && typeof data.rev === "number" && data.rows && typeof data.rows === "object" ? (data as Remote) : null;

async function listRemote(c: Collection): Promise<Remote[]> {
  const out: Remote[] = [];
  let after = "";
  for (;;) {
    const snap = await c.where("k", ">", after).orderBy("k").limit(500).get();
    const page = snap.docs.map((s) => asRemote(s.data())).filter((r): r is Remote => !!r);
    out.push(...page);
    if (snap.docs.length < 500) return out;
    after = page[page.length - 1].k;
  }
}

const MAX_DOC = 250_000;

async function pushGroup(d: LocalDb, c: Collection, group: string) {
  const rows = await loadGroup(d, group);
  if (isEmpty(rows)) {
    await c.doc(group).delete();
    await d._sync.delete(group);
    return;
  }
  const body: Remote = { k: group, rev: Date.now(), dev: DEVICE, rows };
  if (JSON.stringify(body).length > MAX_DOC) throw { code: "too_large", message: group };
  await c.doc(group).set(body as unknown as Record<string, unknown>);
  await d._sync.put({ id: group, rev: body.rev });
}

/** Sends every changed group, one write at a time. */
export function flush(): Promise<void> {
  // While a flush runs, later calls wait for it; it picks up anything marked meanwhile.
  if (flushing) return flushing;
  const c = col;
  if (!c || !dirty.size) return Promise.resolve();
  const d = db();
  const run = (async () => {
    let failed = false;
    while (dirty.size && !failed) {
      const group = [...dirty][0];
      dirty.delete(group);
      try {
        await pushGroup(d, c, group);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "too_large" || code === "invalid_argument") continue; // cannot succeed; the rest still can
        dirty.add(group);
        failed = true;
        setStatus(code === "quota_exceeded" ? "full" : "offline");
      }
      saveDirty();
    }
    if (failed) {
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), 15000);
    } else setStatus("synced");
  })().finally(() => {
    if (flushing === run) flushing = null;
  });
  flushing = run;
  return run;
}

/** Every group that has rows on this phone. */
async function allLocalGroups(d: LocalDb): Promise<Set<string>> {
  const out = new Set<string>();
  for (const n of SYNCED_TABLES) for (const r of await d.table<Row, string>(n).toArray()) {
    const g = groupOf(n, r);
    if (g) out.add(g);
  }
  return out;
}

/** Brings the cloud copy into IndexedDB. A phone that has never synced takes the cloud copy whole. */
async function pull(d: LocalDb, c: Collection) {
  const remote = await listRemote(c);
  const known = new Map((await d._sync.toArray()).map((m) => [m.id, m.rev]));
  if (!remote.length) {
    if (!known.size) for (const g of await allLocalGroups(d)) mark(g);
    return;
  }
  // One transaction for the whole pull: the screens never see a half-loaded state.
  await d.transaction("rw", [...SYNCED_TABLES.map((n) => d.table(n)), d._sync], async () => {
    syncTx.add(Dexie.currentTransaction);
    if (!known.size) {
      // First time on this phone: drop the starter data (fresh ids) so it cannot duplicate the cloud's.
      for (const n of SYNCED_TABLES) {
        if (n === "foods") await d.foods.filter((f) => !f.id.startsWith("seed:")).delete();
        else await d.table(n).clear();
      }
      dirty.clear();
      saveDirty();
    }
    const ids = new Set<string>();
    for (const r of remote) {
      ids.add(r.k);
      if (r.rev > (known.get(r.k) ?? 0) && !dirty.has(r.k)) await writeLocal(d, r.k, r.rows, r.rev);
    }
    // Groups this phone had synced that are gone from the cloud were deleted on another device.
    for (const [g, rev] of known) if (rev > 0 && !ids.has(g) && !dirty.has(g)) await writeLocal(d, g, {}, 0);
  });
}

let started: Promise<void> | null = null;

/** Connects to the Claude account. Resolves once the phone holds the latest data (or right away
 * when this phone has synced before; the pull then finishes in the background). */
export function startSync(): Promise<void> {
  if (started) return started;
  started = (async () => {
    const d = db();
    installHooks(d);
    const store: Db | null = await cap("db");
    const user = await cap("user");
    const uid = user ? await user.id().catch(() => null) : null;
    if (!store || !uid) {
      setStatus("local");
      return;
    }
    setStatus("connecting");
    const c = store.collection(`data/users/${uid}`);
    const firstTime = (await d._sync.count()) === 0;
    const connect = async () => {
      try {
        await pull(d, c);
      } catch {
        setStatus("offline");
        return;
      }
      col = c;
      setStatus(dirty.size ? "saving" : "synced");
      if (dirty.size) void flush();
      // Changes from other devices, live. Deletions arrive with the next load.
      c.orderBy("rev", "desc").limit(50).onSnapshot(
        (snap) => {
          void (async () => {
            for (const ch of snap.docChanges()) {
              if (ch.type === "removed") continue;
              const r = asRemote(ch.doc.data());
              if (!r || r.dev === DEVICE || dirty.has(r.k)) continue;
              const local = await d._sync.get(r.k);
              if (r.rev > (local?.rev ?? 0)) await writeLocal(d, r.k, r.rows, r.rev);
            }
          })();
        },
        () => setStatus("offline"),
      );
    };
    if (firstTime) await connect();
    else void connect();
    // Leaving the page: send what is waiting.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && dirty.size) void flush();
    });
  })();
  return started;
}

/** After a restore replaced every table: the cloud copy becomes exactly this phone's data. */
export async function afterLocalReplace() {
  const c = col;
  if (!c) return;
  const d = db();
  const local = await allLocalGroups(d);
  for (const r of await listRemote(c)) if (!local.has(r.k)) dirty.add(r.k); // pushes as a delete
  for (const g of local) dirty.add(g);
  saveDirty();
  await flush();
}

/** Deletes the cloud copy (before the local database is deleted). */
export async function wipeCloud() {
  const c = col;
  dirty.clear();
  saveDirty();
  if (!c) return;
  for (const r of await listRemote(c)) await c.doc(r.k).delete();
}

/** For tests: forget the connection and the hooks' state. */
export function resetSyncForTests(c: Collection | null) {
  col = c;
  dirty.clear();
  started = null;
  status = "local";
}
export { pull as pullForTests, dirty as dirtyForTests };
