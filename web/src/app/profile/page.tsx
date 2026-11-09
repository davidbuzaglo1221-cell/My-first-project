"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronLeft, Download, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Segmented, TextField } from "@/components/ui/field";
import { Panel, Skeleton } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { db } from "@/data/db";
import { BackupError, exportBackup, restoreBackup } from "@/data/backup";
import { useSyncStatus, wipeCloud } from "@/data/sync";
import { saveFile } from "@/lib/food-ai";
import { IS_ARTIFACT } from "@/lib/runtime";
import { cn } from "@/lib/cn";
import { updateProfile } from "@/data/repo";
import { useProfile } from "@/hooks/use-data";
import { getAppToken, setAppToken } from "@/lib/local-settings";

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
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

const SYNC_TEXT = {
  synced: {
    dot: "bg-success",
    text: "הנתונים שמורים בחשבון Claude שלך, ומופיעים בכל מכשיר שבו פותחים את האפליקציה.",
  },
  saving: {
    dot: "bg-warning",
    text: "שומרים את השינויים האחרונים בחשבון Claude…",
  },
  connecting: { dot: "bg-warning", text: "מתחברים לחשבון Claude…" },
  offline: {
    dot: "bg-danger",
    text: "אין כרגע חיבור לחשבון. השינויים שמורים במכשיר ויישלחו כשהחיבור יחזור.",
  },
  full: {
    dot: "bg-danger",
    text: "המקום בחשבון התמלא. כדאי למחוק תמונות התקדמות ישנות.",
  },
  local: {
    dot: "bg-text-subtle",
    text: "הנתונים שמורים במכשיר הזה בלבד. כדאי לשמור גיבוי פעם בשבוע, למשל ב-iCloud או ב-Google Drive.",
  },
} as const;

function StorageNote() {
  const status = useSyncStatus();
  const s = SYNC_TEXT[IS_ARTIFACT ? status : "local"];
  return (
    <p
      className="flex items-start gap-2.5 text-sm text-text-muted"
      role="status"
    >
      <span
        aria-hidden
        className={cn("mt-1.5 size-2 shrink-0 rounded-pill", s.dot)}
      />
      {s.text}
    </p>
  );
}

/** S30: settings, data export and deletion. */
export default function ProfilePage() {
  const profile = useProfile();
  const toast = useToast();
  const [token, setToken] = useState(getAppToken);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [restoreText, setRestoreText] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    const ok = await saveFile(
      `training-backup-${new Date().toISOString().slice(0, 10)}.json`,
      await exportBackup(),
    );
    if (!ok) toast({ tone: "danger", message: "שמירת הקובץ לא אושרה" });
  };

  const restore = async () => {
    if (restoreText == null) return;
    try {
      await restoreBackup(restoreText);
      setRestoreText(null);
      toast({ tone: "success", message: "הגיבוי שוחזר" });
    } catch (e) {
      setRestoreText(null);
      toast({
        tone: "danger",
        message:
          e instanceof BackupError
            ? e.message
            : "השחזור נכשל. הנתונים לא השתנו.",
      });
    }
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
                onChange={(weekStartsOn) =>
                  void updateProfile({ weekStartsOn })
                }
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
                onChange={(v) =>
                  void updateProfile({ defaultRestSec: Number(v) })
                }
                fullWidth
                options={["60", "90", "120", "180"].map((v) => ({
                  value: v,
                  label:
                    v === "60"
                      ? "1:00"
                      : v === "90"
                        ? "1:30"
                        : v === "120"
                          ? "2:00"
                          : "3:00",
                }))}
              />
            </Row>
            <Row label="טיימר מנוחה אוטומטי" hint="מתחיל לבד כשמסמנים סט">
              <Segmented
                label="טיימר מנוחה אוטומטי"
                value={profile.autoRestTimer ? "on" : "off"}
                onChange={(v) =>
                  void updateProfile({ autoRestTimer: v === "on" })
                }
                fullWidth
                options={[
                  { value: "on", label: "פעיל" },
                  { value: "off", label: "כבוי" },
                ]}
              />
            </Row>
          </Panel>

          <nav aria-label="יעדים" className="glass flex flex-col rounded-lg">
            <Link
              href="/nutrition/goals"
              className="flex items-center gap-3 px-4 py-4"
            >
              <span className="flex-1 font-medium">יעדי תזונה</span>
              <ChevronLeft aria-hidden className="size-4 text-text-subtle" />
            </Link>
            <Link href="/journey/start?edit=1" className="flex items-center gap-3 border-t border-border px-4 py-4">
              <span className="flex-1 font-medium">המסע והפרופיל האישי</span>
              <ChevronLeft aria-hidden className="size-4 text-text-subtle" />
            </Link>
            <Link href="/business/money" className="flex items-center gap-3 border-t border-border px-4 py-4">
              <span className="flex-1 font-medium">כסף: חסכונות, הוצאות ויעדים</span>
              <ChevronLeft aria-hidden className="size-4 text-text-subtle" />
            </Link>
          </nav>

          {!IS_ARTIFACT && (
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
          )}

          <Panel className="flex flex-col gap-3">
            <StorageNote />
            <Button
              variant="secondary"
              icon={<Download aria-hidden className="size-4" />}
              onClick={() => void exportData()}
            >
              שמירת גיבוי לקובץ
            </Button>
            <Button
              variant="secondary"
              icon={<Upload aria-hidden className="size-4" />}
              onClick={() => fileRef.current?.click()}
            >
              שחזור מגיבוי
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-hidden
              tabIndex={-1}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) setRestoreText(await file.text());
              }}
            />
            <Button
              variant="ghost"
              className="text-danger"
              icon={<Trash2 aria-hidden className="size-4" />}
              onClick={() => setConfirmDelete(true)}
            >
              מחיקת כל הנתונים
            </Button>
          </Panel>

          <BottomSheet
            open={restoreText != null}
            onOpenChange={(o) => !o && setRestoreText(null)}
            title="לשחזר מהגיבוי?"
            description="הנתונים הנוכחיים יוחלפו בנתונים מהקובץ."
            footer={
              <div className="flex flex-col gap-2">
                <Button size="lg" fullWidth onClick={() => void restore()}>
                  שחזור
                </Button>
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => setRestoreText(null)}
                >
                  ביטול
                </Button>
              </div>
            }
          >
            <span />
          </BottomSheet>

          <BottomSheet
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title="למחוק את כל הנתונים?"
            description={
              IS_ARTIFACT
                ? "כל האימונים, היומן, התמונות והיעדים יימחקו מהמכשיר ומהחשבון. אי אפשר לשחזר, אלא מקובץ גיבוי."
                : "כל האימונים, היומן, התמונות והיעדים יימחקו מהטלפון. אי אפשר לשחזר, אלא מקובץ ייצוא."
            }
            footer={
              <div className="flex flex-col gap-2">
                <Button
                  variant="danger"
                  size="lg"
                  fullWidth
                  onClick={async () => {
                    await wipeCloud();
                    await db().delete();
                    // A full reload on purpose: it reopens a fresh database and re-seeds the library.
                    if (IS_ARTIFACT) window.location.reload();
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    else window.location.assign("/");
                  }}
                >
                  מחיקת הכול
                </Button>
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => setConfirmDelete(false)}
                >
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
