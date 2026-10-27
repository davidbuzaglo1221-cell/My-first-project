import { db } from "./db";

// A backup is one JSON file with every table, photos included (they are stored as data URLs).
// Restoring replaces everything on this phone, in one transaction: a bad file changes nothing.

export const BACKUP_FORMAT = "training-backup";

export async function exportBackup(): Promise<string> {
  const d = db();
  const tables = Object.fromEntries(await Promise.all(d.tables.map(async (t) => [t.name, await t.toArray()] as const)));
  return JSON.stringify({ format: BACKUP_FORMAT, version: d.verno, exportedAt: new Date().toISOString(), tables });
}

export class BackupError extends Error {}

export async function restoreBackup(text: string): Promise<{ rows: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError("הקובץ אינו קובץ גיבוי של האפליקציה.");
  }
  const d = db();
  const known = new Set(d.tables.map((t) => t.name));
  // Files from before the format field had the tables at the top level.
  const p = parsed as { format?: string; tables?: Record<string, unknown> } & Record<string, unknown>;
  const tables = p?.format === BACKUP_FORMAT ? p.tables : p;
  if (!tables || typeof tables !== "object" || !Array.isArray((tables as Record<string, unknown>).profile)) {
    throw new BackupError("הקובץ אינו קובץ גיבוי של האפליקציה.");
  }
  const entries = Object.entries(tables).filter(([name, rows]) => known.has(name) && Array.isArray(rows)) as [string, object[]][];
  let rows = 0;
  await d.transaction("rw", d.tables, async () => {
    for (const t of d.tables) await t.clear();
    for (const [name, list] of entries) {
      await d.table(name).bulkPut(list);
      rows += list.length;
    }
  });
  return { rows };
}

/** Asks the browser not to clear this site's storage when space runs low (Safari does, after a while). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}
