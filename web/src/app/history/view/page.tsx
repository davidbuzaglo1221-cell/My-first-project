"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2, Trophy } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Panel, Skeleton, Stat } from "@/components/ui/surface";
import { deletePastSet, deleteWorkout, editPastSet, getWorkoutDetail, getWorkoutSummary } from "@/data/repo";
import { TextField } from "@/components/ui/field";
import type { WorkoutSet } from "@/data/types";
import { useProfile } from "@/hooks/use-data";
import { formatDurationWords, formatFullDate, formatNumber, formatTime, formatWeight, fromDisplayWeight, toDisplayWeight, unitLabel, type Units } from "@/lib/format";
import { cn } from "@/lib/cn";

const KIND_LABEL = { warmup: "חימום", work: "", drop: "ירידה", failure: "כשל" } as const;

/** S21: one finished workout, every set, with delete. */
function Detail() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const profile = useProfile();
  const units = profile?.units ?? "kg";
  const data = useLiveQuery(async () => {
    const [detail, summary] = await Promise.all([getWorkoutDetail(id), getWorkoutSummary(id)]);
    return detail && summary ? { detail, summary } : null;
  }, [id]);
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState<{ set: WorkoutSet; name: string } | null>(null);

  if (data === undefined) return <Skeleton className="h-96 rounded-lg" />;
  if (!data) {
    return (
      <p className="text-text-muted">
        האימון לא נמצא, אולי נמחק.{" "}
        <Link href="/history" className="font-semibold text-text">
          להיסטוריה
        </Link>
      </p>
    );
  }
  const { detail, summary } = data;

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[2rem] leading-[1.15] font-bold tracking-tight">{detail.workout.name ?? "אימון חופשי"}</h1>
        <p className="text-sm text-text-muted">
          {formatFullDate(detail.workout.startedAt)}, <bdi dir="ltr">{formatTime(detail.workout.startedAt)}</bdi>
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="משך" value={formatDurationWords(summary.durationSec)} />
        <Stat label="סטים" value={summary.setCount} />
        <Stat label="נפח" value={formatNumber(Math.round(toDisplayWeight(summary.volumeKg, units)), 0)} unit={unitLabel(units)} />
      </div>

      {detail.exercises.map(({ we, exercise, sets }) => {
        let n = 0;
        return (
          <Panel key={we.id} className="flex flex-col gap-3">
            <Link href={`/exercises/view?id=${exercise.id}`} className="text-lg font-semibold">
              {exercise.nameHe}
            </Link>
            <ol className="flex flex-col gap-1">
              {sets.map((s) => {
                if (s.kind !== "warmup") n += 1;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setEditing({ set: s, name: exercise.nameHe })}
                      aria-label={`עריכת סט ${s.kind === "warmup" ? "חימום" : n} ב${exercise.nameHe}`}
                      className={cn("flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-start hover:bg-surface-2", s.isPr && "bg-pr-soft")}
                    >
                    <span className="num w-6 text-center text-sm text-text-subtle">{s.kind === "warmup" ? "ח" : n}</span>
                    <span className="figure flex-1 text-lg">
                      <bdi dir="ltr">
                        {s.weightKg != null ? formatWeight(s.weightKg, units) : "—"} × {s.reps ?? "—"}
                      </bdi>
                    </span>
                    {KIND_LABEL[s.kind] && <span className="text-xs text-text-subtle">{KIND_LABEL[s.kind]}</span>}
                    {s.isPr && (
                      <span className="flex items-center gap-1 text-xs font-medium text-pr">
                        <Trophy aria-hidden className="size-3.5" />
                        שיא
                      </span>
                    )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </Panel>
        );
      })}

      <p className="text-center text-xs text-text-subtle">נגיעה בסט פותחת עריכה. השיאים מתעדכנים לבד.</p>
      <EditSetSheet editing={editing} units={units} onClose={() => setEditing(null)} />

      <Button variant="ghost" icon={<Trash2 aria-hidden className="size-4" />} className="self-center text-danger" onClick={() => setConfirm(true)}>
        מחיקת האימון
      </Button>

      <BottomSheet
        open={confirm}
        onOpenChange={setConfirm}
        title="למחוק את האימון?"
        description="הסטים והשיאים מהאימון הזה יימחקו. אי אפשר לשחזר."
        footer={
          <div className="flex flex-col gap-2">
            <Button
              variant="danger"
              size="lg"
              fullWidth
              onClick={async () => {
                await deleteWorkout(id);
                router.replace("/history");
              }}
            >
              מחיקה
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setConfirm(false)}>
              השארה
            </Button>
          </div>
        }
      >
        <span />
      </BottomSheet>
    </>
  );
}

function EditSetSheet({ editing, units, onClose }: { editing: { set: WorkoutSet; name: string } | null; units: Units; onClose: () => void }) {
  return (
    <BottomSheet open={!!editing} onOpenChange={(o) => !o && onClose()} title={editing ? `תיקון סט: ${editing.name}` : ""}>
      {editing && <EditSetBody key={editing.set.id} set={editing.set} units={units} onClose={onClose} />}
    </BottomSheet>
  );
}

function EditSetBody({ set, units, onClose }: { set: WorkoutSet; units: Units; onClose: () => void }) {
  const [weight, setWeight] = useState(set.weightKg != null ? String(Number(toDisplayWeight(set.weightKg, units).toFixed(2))) : "");
  const [reps, setReps] = useState(set.reps != null ? String(set.reps) : "");
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  return (
    <form
      className="flex flex-col gap-4 px-2 pb-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const w = num(weight);
        await editPastSet(set.id, { weightKg: w == null ? null : fromDisplayWeight(w, units), reps: num(reps) == null ? null : Math.round(num(reps)!) });
        onClose();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <TextField label={`משקל (${unitLabel(units)})`} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ""))} />
        <TextField label="חזרות" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value.replace(/\D/g, ""))} />
      </div>
      <Button type="submit" size="lg" fullWidth>
        שמירת התיקון
      </Button>
      <Button
        variant="ghost"
        fullWidth
        className="text-danger"
        onClick={async () => {
          await deletePastSet(set.id);
          onClose();
        }}
      >
        מחיקת הסט
      </Button>
    </form>
  );
}

export default function WorkoutDetailPage() {
  return (
    <AppShell tab="workouts" back={{ href: "/history", label: "היסטוריה" }}>
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <Detail />
      </Suspense>
    </AppShell>
  );
}
