import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { completeMission, ensureDay, saveCut, saveJourney } from "./journey-repo";
import { groupOf, loadGroup } from "./sync";

describe("journey storage", () => {
  beforeEach(async () => {
    await db().delete();
    await db().open();
  });

  it("creates a day once and keeps it", async () => {
    expect(await ensureDay("2026-11-09")).toEqual([]);
    await saveJourney({ startDate: "2026-11-09" });
    const first = await ensureDay("2026-11-09");
    expect(first).toHaveLength(3);
    await completeMission(first[0].id, "עשיתי");
    const again = await ensureDay("2026-11-09");
    expect(again.map((m) => m.id)).toEqual(first.map((m) => m.id));
    expect(again[0].status).toBe("done");
  });

  it("copies the new rows to the cloud in monthly groups", async () => {
    await saveJourney({ startDate: "2026-11-09" });
    const [m] = await ensureDay("2026-11-20");
    const cut = await saveCut({ date: "2026-11-20", client: "רון", price: 80, tip: 0, service: "haircut", isNew: true, source: "referral", rebooked: false, notes: "" });
    expect(groupOf("missions", m as never)).toBe("m.2026-11");
    expect(groupOf("cuts", cut as never)).toBe("bz.2026-11");
    expect(groupOf("journey", { id: "me" })).toBe("p");
    expect((await loadGroup(db(), "m.2026-11")).missions).toHaveLength(3);
    expect((await loadGroup(db(), "bz.2026-11")).cuts).toHaveLength(1);
    expect((await loadGroup(db(), "p")).journey).toHaveLength(1);
  });
});
