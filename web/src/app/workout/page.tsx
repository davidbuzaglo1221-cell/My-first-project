"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Dumbbell, Plus, Replace, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { EmptyState, Skeleton, Tag } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { ExerciseCard } from "@/components/logger/exercise-card";
import { ExercisePicker } from "@/components/logger/exercise-picker";
import { NumericKeypad } from "@/components/logger/numeric-keypad";
import { RestTimer } from "@/components/logger/rest-timer";
import { SET_KINDS, SetHeader, SetRow, type SetField } from "@/components/logger/set-row";
import {
  EmptyWorkoutError,
  addExerciseToWorkout,
  addSet,
  completeSet,
  discardWorkout,
  finishWorkout,
  getWorkoutDetail,
  previousSets,
  removeWorkoutExercise,
  replaceExercise,
  uncompleteSet,
  updateSet,
  updateWorkout,
} from "@/data/repo";
import type { PreviousSet, WorkoutSet } from "@/data/types";
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from "@/data/types";
import { useOpenWorkout, useProfile } from "@/hooks/use-data";
import { useNow } from "@/hooks/use-now";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { chime, unlockAudio } from "@/lib/chime";
import { formatDuration, formatWeight, fromDisplayWeight, toDisplayWeight, unitLabel } from "@/lib/format";

type Editing = { setId: string; field: SetField; order: string[] };

export default function WorkoutPage() {
  const router = useRouter();
  const toast = useToast();
  const profile = useProfile();
  const open = useOpenWorkout();
  const now = useNow(1000);
  useWakeLock(!!open);

  const detail = useLiveQuery(async () => (open ? (await getWorkoutDetail(open.id)) ?? null : null), [open?.id]);
  // Last time's sets, per exercise in this workout.
  const previous = useLiveQuery(async () => {
    if (!detail) return new Map<string, PreviousSet[]>();
    const ids = [...new Set(detail.exercises.map((x) => x.exercise.id))];
    const lists = await Promise.all(ids.map((id) => previousSets(id, detail.workout.id)));
    return new Map(ids.map((id, i) => [id, lists[i]]));
  }, [detail]);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState("");
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "replace"; weId: string } | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const units = profile?.units ?? "kg";
  const allSets = detail?.exercises.flatMap((x) => x.sets) ?? [];
  const doneCount = allSets.filter((s) => s.completedAt).length;
  const plannedCount = allSets.length - doneCount;

  const startRest = useCallback(
    (sec: number) => {
      if (!open) return;
      void updateWorkout(open.id, { restEndsAt: Date.now() + sec * 1000, restTotalSec: sec });
    },
    [open],
  );

  if (open === undefined || (open && detail === undefined)) {
    return (
      <main className="mx-auto flex max-w-(--layout-max-width) flex-col gap-4 px-4 pt-6">
        <Skeleton className="h-14" />
        <Skeleton className="h-72 rounded-lg" />
      </main>
    );
  }

  if (!open || !detail) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-(--layout-max-width) flex-col justify-center px-4">
        <EmptyState
          icon={<Dumbbell aria-hidden className="size-6" />}
          title="אין אימון פתוח"
          body="אפשר להתחיל אימון מתבנית או אימון חופשי."
          action={
            <Link href="/workouts" className="font-semibold text-accent">
              לאימונים
            </Link>
          }
        />
      </main>
    );
  }

  const prevFor = (exerciseId: string, rowIndex: number): PreviousSet | null => {
    const list = previous?.get(exerciseId) ?? [];
    return list[rowIndex] ?? list.at(-1) ?? null;
  };

  const editingSet: WorkoutSet | undefined = editing ? allSets.find((s) => s.id === editing.setId) : undefined;

  const openField = (set: WorkoutSet, field: SetField, order: string[]) => {
    const v = field === "weight" ? set.weightKg : set.reps;
    setDraft(v == null ? "" : field === "weight" ? String(Number(toDisplayWeight(v, units).toFixed(2))) : String(v));
    setEditing({ setId: set.id, field, order });
  };

  const onDraft = (raw: string) => {
    setDraft(raw);
    if (!editing) return;
    const n = raw === "" ? null : Number(raw);
    if (editing.field === "weight") void updateSet(editing.setId, { weightKg: n == null ? null : fromDisplayWeight(n, units) });
    else void updateSet(editing.setId, { reps: n == null ? null : Math.round(n) });
  };

  // "הבא": weight → reps → next set's weight in the same exercise → close.
  const onNext = () => {
    if (!editing || !editingSet) return setEditing(null);
    if (editing.field === "weight") return openField(editingSet, "reps", editing.order);
    const i = editing.order.indexOf(editing.setId);
    const nextId = editing.order[i + 1];
    const next = nextId ? allSets.find((s) => s.id === nextId) : undefined;
    if (next && !next.completedAt) return openField(next, "weight", editing.order);
    setEditing(null);
  };

  const toggleDone = async (set: WorkoutSet, prev: PreviousSet | null, restSec: number | null | undefined) => {
    unlockAudio();
    setEditing(null);
    if (set.completedAt) return uncompleteSet(set.id);
    if (set.weightKg == null && set.reps == null && !prev) {
      toast({ tone: "danger", message: "צריך להזין משקל וחזרות לפני הסימון" });
      return;
    }
    const r = await completeSet(set.id, prev);
    if (r.isPr && r.weightKg && r.reps) {
      toast({ tone: "pr", message: `שיא אישי חדש: ${formatWeight(r.weightKg, units)} × ${r.reps}` });
    }
    if (profile?.autoRestTimer !== false) startRest(set.kind === "warmup" ? 60 : (restSec ?? profile?.defaultRestSec ?? 120));
  };

  const finish = async () => {
    setFinishing(true);
    try {
      await finishWorkout(open.id);
      router.replace(`/summary?id=${open.id}`);
    } catch (e) {
      setFinishing(false);
      setFinishOpen(false);
      if (e instanceof EmptyWorkoutError) toast({ tone: "danger", message: "עוד לא סימנת אף סט. אפשר לבטל את האימון מהתפריט" });
      else throw e;
    }
  };

  const elapsed = now ? formatDuration((now - new Date(detail.workout.startedAt).getTime()) / 1000) : "";
  const menuExercise = detail.exercises.find((x) => x.we.id === menuFor);

  return (
    <>
      {/* Sticky glass header: name, running clock, finish. */}
      <header className="glass-raised sticky top-0 z-30 rounded-b-xl border-t-0 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
        <div className="mx-auto flex max-w-(--layout-max-width) items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm text-text-muted">{detail.workout.name ?? "אימון חופשי"}</span>
            <span className="figure text-2xl leading-tight" role="timer" aria-label={`זמן אימון ${elapsed}`}>
              <bdi dir="ltr">{elapsed}</bdi>
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setDiscardOpen(true)}>
            ביטול
          </Button>
          <Button size="sm" onClick={() => (doneCount ? setFinishOpen(true) : finish())}>
            סיום
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-(--layout-max-width) flex-col gap-4 px-4 pt-4 pb-[calc(22rem+env(safe-area-inset-bottom))]">
        <RestTimer
          endsAt={detail.workout.restEndsAt ?? null}
          totalSec={detail.workout.restTotalSec ?? 0}
          onAdjust={(d) =>
            void updateWorkout(open.id, {
              restEndsAt: Math.max(Date.now(), (detail.workout.restEndsAt ?? Date.now()) + d * 1000),
              restTotalSec: Math.max(0, (detail.workout.restTotalSec ?? 0) + d),
            })
          }
          onSkip={() => void updateWorkout(open.id, { restEndsAt: null, restTotalSec: null })}
          onDone={chime}
        />

        {detail.exercises.length === 0 && (
          <EmptyState
            icon={<Dumbbell aria-hidden className="size-6" />}
            title="אימון חופשי"
            body="מוסיפים תרגיל, ואם עשית אותו בעבר, המשקלים מהפעם הקודמת כבר יחכו."
            action={<Button onClick={() => setPicker({ mode: "add" })}>הוספת תרגיל</Button>}
          />
        )}

        {detail.exercises.map(({ we, exercise, sets }) => {
          const order = sets.map((s) => s.id);
          let workNo = 0;
          return (
            <ExerciseCard
              key={we.id}
              name={exercise.nameHe}
              tags={[MUSCLE_LABEL[exercise.primaryMuscle], EQUIPMENT_LABEL[exercise.equipment]]}
              note={exercise.instructionsHe ?? undefined}
              doneCount={sets.filter((s) => s.completedAt).length}
              totalCount={sets.length}
              onAddSet={() => void addSet(we.id)}
              onMenu={() => setMenuFor(we.id)}
            >
              <SetHeader units={units} />
              {sets.map((s, i) => {
                if (s.kind !== "warmup") workNo += 1;
                const prev = prevFor(exercise.id, i);
                return (
                  <SetRow
                    key={s.id}
                    number={workNo}
                    kind={s.kind}
                    previous={prev}
                    values={{ weightKg: s.weightKg, reps: s.reps }}
                    done={!!s.completedAt}
                    isPr={s.isPr}
                    units={units}
                    activeField={editing?.setId === s.id ? editing.field : null}
                    onFieldFocus={(f) => openField(s, f, order)}
                    onToggleDone={() => void toggleDone(s, prev, we.restSec)}
                    onCycleKind={() => void updateSet(s.id, { kind: SET_KINDS[(SET_KINDS.indexOf(s.kind) + 1) % SET_KINDS.length] })}
                  />
                );
              })}
            </ExerciseCard>
          );
        })}

        {detail.exercises.length > 0 && (
          <Button variant="secondary" size="lg" fullWidth icon={<Plus aria-hidden className="size-5" />} onClick={() => setPicker({ mode: "add" })}>
            הוספת תרגיל
          </Button>
        )}
      </main>

      {editing && editingSet && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-(--layout-max-width)">
          <NumericKeypad
            key={`${editing.setId}-${editing.field}`}
            label={editing.field === "weight" ? `משקל (${unitLabel(units)})` : "חזרות"}
            value={draft}
            onChange={onDraft}
            step={editing.field === "weight" ? (units === "kg" ? 2.5 : 5) : 1}
            allowDecimal={editing.field === "weight"}
            onNext={onNext}
            onDone={() => setEditing(null)}
          />
        </div>
      )}

      <BottomSheet
        open={!!picker}
        onOpenChange={(o) => !o && setPicker(null)}
        title={picker?.mode === "replace" ? "החלפת תרגיל" : "הוספת תרגיל"}
      >
        <ExercisePicker
          excludeIds={detail.exercises.map((x) => x.exercise.id)}
          onPick={async (exerciseId) => {
            if (picker?.mode === "replace") await replaceExercise(picker.weId, exerciseId);
            else await addExerciseToWorkout(open.id, exerciseId);
            setPicker(null);
          }}
        />
      </BottomSheet>

      <BottomSheet open={!!menuFor} onOpenChange={(o) => !o && setMenuFor(null)} title={menuExercise?.exercise.nameHe ?? ""}>
        <SheetAction
          icon={<Replace aria-hidden className="size-5" />}
          label="החלפה בתרגיל אחר"
          hint="למשל כשהמכשיר תפוס"
          onClick={() => {
            const weId = menuFor!;
            setMenuFor(null);
            setPicker({ mode: "replace", weId });
          }}
        />
        <SheetAction
          icon={<Trash2 aria-hidden className="size-5" />}
          label="הסרה מהאימון"
          hint="כולל הסטים שסומנו"
          onClick={async () => {
            const weId = menuFor!;
            setMenuFor(null);
            await removeWorkoutExercise(weId);
          }}
        />
      </BottomSheet>

      <BottomSheet
        open={finishOpen}
        onOpenChange={setFinishOpen}
        title="לסיים את האימון?"
        description={
          plannedCount > 0
            ? `${doneCount} סטים סומנו. ${plannedCount === 1 ? "סט אחד שלא סומן יימחק" : `${plannedCount} סטים שלא סומנו יימחקו`}.`
            : `כל ${doneCount} הסטים סומנו.`
        }
        footer={
          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth loading={finishing} onClick={() => void finish()}>
              סיום ושמירה
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setFinishOpen(false)}>
              המשך באימון
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-1.5 px-2 pb-2">
          {detail.exercises.map(({ we, exercise, sets }) => (
            <Tag key={we.id}>
              {exercise.nameHe}: {sets.filter((s) => s.completedAt).length}
            </Tag>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="לבטל את האימון?"
        description="האימון והסטים שלו יימחקו, ולא יופיעו בהיסטוריה."
        footer={
          <div className="flex flex-col gap-2">
            <Button
              variant="danger"
              size="lg"
              fullWidth
              onClick={async () => {
                await discardWorkout(open.id);
                router.replace("/");
              }}
            >
              ביטול ומחיקה
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setDiscardOpen(false)}>
              חזרה לאימון
            </Button>
          </div>
        }
      >
        <span />
      </BottomSheet>
    </>
  );
}
