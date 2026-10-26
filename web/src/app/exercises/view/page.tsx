"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AppShell } from "@/components/app/app-shell";
import { Panel, Skeleton, Stat, Tag } from "@/components/ui/surface";
import { LineChart } from "@/components/progress/charts";
import { exerciseHistory, getExercise } from "@/data/repo";
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from "@/data/types";
import { useProfile } from "@/hooks/use-data";
import { formatNumber, formatRelativeDay, formatWeight, toDisplayWeight, unitLabel } from "@/lib/format";

const shortDate = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric" });

/** S10: how to do it, and how you have done it: best estimated 1RM over time, every session. */
function ExerciseDetail() {
  const id = useSearchParams().get("id") ?? "";
  const profile = useProfile();
  const units = profile?.units ?? "kg";
  const data = useLiveQuery(async () => {
    const exercise = await getExercise(id);
    return exercise ? { exercise, history: await exerciseHistory(id) } : null;
  }, [id]);

  if (data === undefined) return <Skeleton className="h-96 rounded-lg" />;
  if (!data) return <p className="text-text-muted">התרגיל לא נמצא.</p>;
  const { exercise, history } = data;
  const withBest = history.filter((h) => h.bestE1rm != null);
  const best = withBest.reduce<number | null>((m, h) => (m == null || h.bestE1rm! > m ? h.bestE1rm : m), null);
  const heaviest = history.flatMap((h) => h.sets).reduce<number | null>((m, s) => (s.weightKg != null && (m == null || s.weightKg > m) ? s.weightKg : m), null);
  const points = [...withBest].reverse().map((h) => ({
    x: new Date(h.workout.startedAt).getTime(),
    y: Math.round(toDisplayWeight(h.bestE1rm!, units) * 10) / 10,
    label: shortDate.format(new Date(h.workout.startedAt)),
  }));

  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className="text-[2rem] leading-[1.15] font-bold tracking-tight">{exercise.nameHe}</h1>
        <div className="flex flex-wrap gap-1.5">
          <Tag>{MUSCLE_LABEL[exercise.primaryMuscle]}</Tag>
          <Tag>{EQUIPMENT_LABEL[exercise.equipment]}</Tag>
          {exercise.isUnilateral && <Tag>משקל לכל צד</Tag>}
        </div>
        {exercise.instructionsHe && <p className="text-text-muted">{exercise.instructionsHe}</p>}
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="1RM משוער" value={best != null ? formatWeight(best, units) : "—"} unit={best != null ? unitLabel(units) : undefined} />
        <Stat label="הכי כבד" value={heaviest != null ? formatWeight(heaviest, units) : "—"} unit={heaviest != null ? unitLabel(units) : undefined} />
        <Stat label="אימונים" value={history.length} />
      </div>

      <Panel className="flex flex-col gap-3">
        <h2 className="text-lg">1RM משוער לאורך זמן</h2>
        <LineChart points={points} label="1RM משוער" unit={unitLabel(units)} />
        <p className="text-xs text-text-subtle">לפי נוסחת Epley: משקל × (1 + חזרות ÷ 30), מסטים של 1 עד 12 חזרות, בלי חימום.</p>
      </Panel>

      {history.length > 0 ? (
        <section aria-labelledby="sessions" className="flex flex-col gap-2">
          <h2 id="sessions" className="px-1 text-lg">
            כל הפעמים
          </h2>
          <ul className="glass flex flex-col rounded-lg">
            {history.map((h, i) => (
              <li key={h.workout.id}>
                {i > 0 && <span aria-hidden className="mx-4 block h-px bg-border" />}
                <Link href={`/history/view?id=${h.workout.id}`} className="flex items-baseline gap-3 px-4 py-3">
                  <span className="w-20 shrink-0 text-sm text-text-muted">{formatRelativeDay(h.workout.startedAt)}</span>
                  <span className="num flex-1 text-sm">
                    <bdi dir="ltr">{h.sets.map((s) => `${s.weightKg != null ? formatWeight(s.weightKg, units) : "—"}×${s.reps ?? "—"}`).join("  ")}</bdi>
                  </span>
                  {h.bestE1rm != null && <span className="figure shrink-0 text-sm">{formatNumber(Math.round(toDisplayWeight(h.bestE1rm, units)), 0)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-text-subtle">עוד לא ביצעת את התרגיל הזה. אחרי הפעם הראשונה יופיעו כאן המשקלים.</p>
      )}
    </>
  );
}

export default function ExerciseDetailPage() {
  return (
    <AppShell tab="workouts" back={{ href: "/exercises", label: "ספריית תרגילים" }}>
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <ExerciseDetail />
      </Suspense>
    </AppShell>
  );
}
