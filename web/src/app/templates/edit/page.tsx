"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Minus, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TextField } from "@/components/ui/field";
import { Panel, Skeleton } from "@/components/ui/surface";
import { ExercisePicker } from "@/components/logger/exercise-picker";
import { deleteTemplate, getExercise, getTemplateDetail, saveTemplate } from "@/data/repo";
import { formatDuration } from "@/lib/format";

type Row = { key: string; exerciseId: string; name: string; sets: number; repsMin: number; repsMax: number; rest: number };

const REST_STEPS = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

/** Small − value + control. */
function Num({ label, value, onChange, min, max, display }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; display?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-text-subtle">{label}</span>
      <div className="well flex h-10 items-center rounded-pill" role="group" aria-label={label}>
        <button type="button" aria-label={`פחות ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="flex size-10 items-center justify-center disabled:opacity-30">
          <Minus aria-hidden className="size-4" />
        </button>
        <span className="figure min-w-9 text-center" aria-live="polite">
          {display ?? value}
        </span>
        <button type="button" aria-label={`עוד ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="flex size-10 items-center justify-center disabled:opacity-30">
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Editor() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [loaded, setLoaded] = useState(!id);
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [picker, setPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    void getTemplateDetail(id).then((d) => {
      if (!alive || !d) return;
      setName(d.template.name);
      setRows(
        d.items.map(({ item, exercise }) => ({
          key: item.id,
          exerciseId: exercise.id,
          name: exercise.nameHe,
          sets: item.targetSets,
          repsMin: item.targetRepsMin ?? 8,
          repsMax: item.targetRepsMax ?? 12,
          rest: item.targetRestSec ?? 90,
        })),
      );
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const update = (key: string, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((all) => {
      const next = [...all];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  if (!loaded) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <>
      <TextField label="שם התבנית" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: רגליים וגב" maxLength={80} />

      {rows.length === 0 && <p className="py-4 text-center text-sm text-text-muted">עוד אין תרגילים. מוסיפים אחד ובוחרים כמה סטים וחזרות.</p>}

      <ol className="flex flex-col gap-3" aria-label="תרגילים בתבנית">
        {rows.map((r, i) => (
          <li key={r.key}>
            <Panel className="flex flex-col gap-4 p-4">
              <div className="flex items-center gap-2">
                <span className="num w-6 text-sm text-text-subtle">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                <button type="button" aria-label={`הזזת ${r.name} למעלה`} disabled={i === 0} onClick={() => move(i, -1)} className="flex size-9 items-center justify-center rounded-pill text-text-muted disabled:opacity-25">
                  <ArrowUp aria-hidden className="size-4" />
                </button>
                <button type="button" aria-label={`הזזת ${r.name} למטה`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="flex size-9 items-center justify-center rounded-pill text-text-muted disabled:opacity-25">
                  <ArrowDown aria-hidden className="size-4" />
                </button>
                <button type="button" aria-label={`הסרת ${r.name}`} onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))} className="flex size-9 items-center justify-center rounded-pill text-text-subtle hover:text-danger">
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-4">
                <Num label="סטים" value={r.sets} min={1} max={10} onChange={(n) => update(r.key, { sets: n })} />
                <Num label="מנוחה" value={REST_STEPS.indexOf(r.rest) < 0 ? 4 : REST_STEPS.indexOf(r.rest)} min={0} max={REST_STEPS.length - 1} display={formatDuration(r.rest)} onChange={(n) => update(r.key, { rest: REST_STEPS[n] })} />
                <Num label="חזרות מ-" value={r.repsMin} min={1} max={30} onChange={(n) => update(r.key, { repsMin: n, repsMax: Math.max(n, r.repsMax) })} />
                <Num label="עד" value={r.repsMax} min={r.repsMin} max={50} onChange={(n) => update(r.key, { repsMax: n })} />
              </div>
            </Panel>
          </li>
        ))}
      </ol>

      <Button variant="secondary" size="lg" fullWidth icon={<Plus aria-hidden className="size-5" />} onClick={() => setPicker(true)}>
        הוספת תרגיל
      </Button>

      <div className="flex flex-col gap-2 pt-2">
        <Button
          size="lg"
          fullWidth
          loading={saving}
          disabled={!name.trim() || rows.length === 0}
          onClick={async () => {
            setSaving(true);
            await saveTemplate({
              id: id ?? undefined,
              name,
              items: rows.map((r) => ({ exerciseId: r.exerciseId, targetSets: r.sets, targetRepsMin: r.repsMin, targetRepsMax: r.repsMax, targetRestSec: r.rest })),
            });
            router.replace("/workouts");
          }}
        >
          שמירת התבנית
        </Button>
        {id && (
          <Button variant="ghost" fullWidth className="text-danger" onClick={() => setConfirmDelete(true)}>
            מחיקת התבנית
          </Button>
        )}
      </div>

      <BottomSheet open={picker} onOpenChange={setPicker} title="הוספת תרגיל">
        <ExercisePicker
          excludeIds={rows.map((r) => r.exerciseId)}
          onPick={async (exerciseId) => {
            const e = await getExercise(exerciseId);
            if (e) setRows((all) => [...all, { key: crypto.randomUUID(), exerciseId, name: e.nameHe, sets: 3, repsMin: 8, repsMax: 12, rest: 90 }]);
            setPicker(false);
          }}
        />
      </BottomSheet>

      <BottomSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="למחוק את התבנית?"
        description="האימונים שכבר עשית ממנה יישארו בהיסטוריה."
        footer={
          <div className="flex flex-col gap-2">
            <Button
              variant="danger"
              size="lg"
              fullWidth
              onClick={async () => {
                await deleteTemplate(id!);
                router.replace("/workouts");
              }}
            >
              מחיקה
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setConfirmDelete(false)}>
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

function Title() {
  const id = useSearchParams().get("id");
  return <>{id ? "עריכת תבנית" : "תבנית חדשה"}</>;
}

export default function TemplateEditPage() {
  return (
    <AppShell
      title={undefined}
      back={{ href: "/workouts", label: "אימונים" }}
      bottomSpace={false}
    >
      <h1 className="text-[2rem] leading-[1.15] font-bold tracking-tight">
        <Suspense fallback="תבנית">
          <Title />
        </Suspense>
      </h1>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Editor />
      </Suspense>
    </AppShell>
  );
}
