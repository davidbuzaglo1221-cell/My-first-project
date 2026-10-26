"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Download, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Segmented, TextField } from "@/components/ui/field";
import { Panel, Skeleton } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { db } from "@/data/db";
import { updateProfile } from "@/data/repo";
import { useProfile } from "@/hooks/use-data";
import { getAppToken, setAppToken } from "@/lib/local-settings";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <span className="font-medium">{label}</span>
        {hint && <p className="text-sm text-text-subtle">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** S30: settings, data export and deletion. */
export default function ProfilePage() {
  const profile = useProfile();
  const toast = useToast();
  const [token, setToken] = useState(getAppToken);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const exportData = async () => {
    const d = db();
    const dump = Object.fromEntries(await Promise.all(d.tables.map(async (t) => [t.name, await t.toArray()] as const)));
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...dump }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell tab="profile" title="פרופיל">
      {!profile ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <Panel className="flex flex-col gap-6">
            <Row label="מראה">
              <Segmented
                label="מראה"
                value={profile.theme}
                onChange={(theme) => void updateProfile({ theme })}
                fullWidth
                options={[
                  { value: "light", label: "בהיר" },
                  { value: "dark", label: "כהה" },
                  { value: "system", label: "לפי המכשיר" },
                ]}
              />
            </Row>
            <Row label="יחידות משקל">
              <Segmented
                label="יחידות משקל"
                value={profile.units}
                onChange={(units) => void updateProfile({ units })}
                fullWidth
                options={[
                  { value: "kg", label: 'ק"ג' },
                  { value: "lb", label: "ליברות" },
                ]}
              />
            </Row>
            <Row label="השבוע מתחיל ביום">
              <Segmented
                label="תחילת השבוע"
                value={profile.weekStartsOn}
                onChange={(weekStartsOn) => void updateProfile({ weekStartsOn })}
                fullWidth
                options={[
                  { value: "sun", label: "ראשון" },
                  { value: "mon", label: "שני" },
                ]}
              />
            </Row>
          </Panel>

          <Panel className="flex flex-col gap-6">
            <Row label="מנוחה בין סטים" hint="אחרי סט חימום: דקה">
              <Segmented
                label="מנוחה בין סטים"
                value={String(profile.defaultRestSec)}
                onChange={(v) => void updateProfile({ defaultRestSec: Number(v) })}
                fullWidth
                options={["60", "90", "120", "180"].map((v) => ({ value: v, label: v === "60" ? "1:00" : v === "90" ? "1:30" : v === "120" ? "2:00" : "3:00" }))}
              />
            </Row>
            <Row label="טיימר מנוחה אוטומטי" hint="מתחיל לבד כשמסמנים סט">
              <Segmented
                label="טיימר מנוחה אוטומטי"
                value={profile.autoRestTimer ? "on" : "off"}
                onChange={(v) => void updateProfile({ autoRestTimer: v === "on" })}
                fullWidth
                options={[
                  { value: "on", label: "פעיל" },
                  { value: "off", label: "כבוי" },
                ]}
              />
            </Row>
          </Panel>

          <nav aria-label="יעדים" className="glass flex flex-col rounded-lg">
            <Link href="/nutrition/goals" className="flex items-center gap-3 px-4 py-4">
              <span className="flex-1 font-medium">יעדי תזונה</span>
              <ChevronLeft aria-hidden className="size-4 text-text-subtle" />
            </Link>
          </nav>

          <Panel className="flex flex-col gap-3">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setAppToken(token);
                toast({ tone: "success", message: "קוד הגישה נשמר" });
              }}
            >
              <TextField
                label="קוד גישה לזיהוי מתמונה"
                hint="רק אם הוגדר APP_ACCESS_TOKEN בשרת. נשמר בטלפון הזה בלבד."
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button type="submit" variant="secondary">
                שמירת הקוד
              </Button>
            </form>
          </Panel>

          <Panel className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">כל הנתונים שמורים כרגע בטלפון הזה בלבד. כדאי לייצא גיבוי מדי פעם.</p>
            <Button variant="secondary" icon={<Download aria-hidden className="size-4" />} onClick={() => void exportData()}>
              ייצוא כל הנתונים
            </Button>
            <Button variant="ghost" className="text-danger" icon={<Trash2 aria-hidden className="size-4" />} onClick={() => setConfirmDelete(true)}>
              מחיקת כל הנתונים
            </Button>
          </Panel>

          <BottomSheet
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title="למחוק את כל הנתונים?"
            description="כל האימונים, היומן, התמונות והיעדים יימחקו מהטלפון. אי אפשר לשחזר, אלא מקובץ ייצוא."
            footer={
              <div className="flex flex-col gap-2">
                <Button
                  variant="danger"
                  size="lg"
                  fullWidth
                  onClick={async () => {
                    await db().delete();
                    // A full reload on purpose: it reopens a fresh database and re-seeds the library.
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.assign("/");
                  }}
                >
                  מחיקת הכול
                </Button>
                <Button variant="ghost" fullWidth onClick={() => setConfirmDelete(false)}>
                  ביטול
                </Button>
              </div>
            }
          >
            <span />
          </BottomSheet>
        </>
      )}
    </AppShell>
  );
}
