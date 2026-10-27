import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { BackupError, exportBackup, restoreBackup } from "./backup";
import { logBodyweight } from "./body-repo";
import { addProgressPhoto } from "./coach-repo";
import { getProfile } from "./repo";

beforeEach(async () => {
  await db().delete();
  await db().open();
});

describe("backup", () => {
  it("restores exactly what was exported, photos included", async () => {
    await logBodyweight(80, "2026-10-20");
    await addProgressPhoto("front", "data:image/jpeg;base64,AAAA", "2026-10-20");
    const file = await exportBackup();

    await logBodyweight(90, "2026-10-21");
    await restoreBackup(file);

    expect((await db().bodyMetrics.toArray()).map((r) => r.weightKg)).toEqual([80]);
    expect((await db().progressPhotos.toArray())[0].dataUrl).toBe("data:image/jpeg;base64,AAAA");
    expect((await getProfile()).bodyweightKg).toBe(80);
  });

  it("rejects a file that is not a backup and leaves the data alone", async () => {
    await logBodyweight(80, "2026-10-20");
    await expect(restoreBackup("not json")).rejects.toBeInstanceOf(BackupError);
    await expect(restoreBackup(JSON.stringify({ hello: 1 }))).rejects.toBeInstanceOf(BackupError);
    expect(await db().bodyMetrics.count()).toBe(1);
  });

  it("reads files exported before the format field existed", async () => {
    await logBodyweight(80, "2026-10-20");
    const { tables } = JSON.parse(await exportBackup());
    await db().bodyMetrics.clear();
    await restoreBackup(JSON.stringify({ exportedAt: "2026-10-01", ...tables }));
    expect(await db().bodyMetrics.count()).toBe(1);
  });
});
