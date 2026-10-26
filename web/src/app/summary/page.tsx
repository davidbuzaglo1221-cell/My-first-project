"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Award, Check, Flame, Trophy } from "lucide-react";
import { getWorkoutCelebration } from "@/data/coach-repo";
import { listFinishedWorkouts } from "@/data/repo";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Panel, Skeleton, Stat } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { getWorkoutSummary, saveWorkoutAsTemplate, updateWorkout } from "@/data/repo";
import { useProfile } from "@/hooks/use-data";
import { formatDurationWords, formatNumber, formatWeight, toDisplayWeight, unitLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

const FEELINGS = [
  { v: 1, label: "קשה מאוד" },
  { v: 2, label: "קשה" },
  { v: 3, label: "בסדר" },
  { v: 4, label: "טוב" },
  { v: 5, label: "מצוין" },
];

function Summary() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const toast = useToast();
  const profile = useProfile();
  const units = profile?.units ?? "kg";
  const summary = useLiveQuery(async () => (await getWorkoutSummary(id)) ?? null, [id]);
  const party = useLiveQuery(async () => {
    const [c, all] = await Promise.all([getWorkoutCelebration(id), listFinishedWorkouts()]);
    const n = all.length - all.findIndex((w) => w.workout.id === id);
    return { ...c, number: n };
  }, [id]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

  if (summary === undefined) return <Skeleton className="h-96 rounded-lg" />;
  if (!summary) {
    return (
      <p className="text-text-muted">
        האימון לא נמצא. <Link href="/history" className="text-accent">להיסטוריה</Link>
      </p>
    );
  }

  const { workout } = summary;
  return (
    <>
      {/* The one moment of ceremony in the app. */}
      {party && (
        <section aria-label="סיכום" className="flex flex-col items-center gap-4 rounded-xl bg-accent px-5 py-7 text-center text-on-accent shadow-pop">
          <span className="flex size-16 items-center justify-center rounded-pill bg-success animate-[pr-pop_var(--motion-slow)_var(--ease-out)]">
            <Check aria-hidden className="size-8 text-on-accent" strokeWidth={3} />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-on-accent/70">אימון מספר</span>
            <span className="figure text-[3.5rem] leading-none">{party.number}</span>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Flame aria-hidden className="size-4 text-pr-soft" />
            {party.thisWeek >= party.weekGoal
              ? party.weekStreak > 1
                ? `${party.weekStreak} שבועות ברצף ביעד`
                : "היעד השבועי הושג"
              : `${party.thisWeek} מתוך ${party.weekGoal} אימונים השבוע`}
          </span>
          {party.unlocked.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2" aria-label="הישגים חדשים">
              {party.unlocked.map((a) => (
                <li key={a.id} className="flex items-center gap-1.5 rounded-pill bg-pr-soft px-3 py-1.5 text-sm font-semibold text-pr">
                  <Award aria-hidden className="size-4" />
                  {a.title}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Records, engraved in brass. */}
      {summary.records.length > 0 && (
        <Panel className="flex flex-col gap-4 border-pr/30">
          <div className="flex items-center gap-2 text-pr">
            <Trophy aria-hidden className="size-5" />
            <h2 className="text-lg">{summary.records.length === 1 ? "שיא אישי חדש" : `${summary.records.length} שיאים אישיים חדשים`}</h2>
          </div>
          <ul className="flex flex-col gap-3">
            {summary.records.map((r) => (
              <li key={r.exerciseId} className="flex items-baseline justify-between gap-3">
                <span className="truncate">{r.exerciseName}</span>
                <span className="figure shrink-0 text-2xl text-pr">
                  <bdi dir="ltr">
                    {formatWeight(r.weightKg, units)} × {r.reps}
                  </bdi>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat label="משך" value={formatDurationWords(summary.durationSec)} />
        <Stat label="סטים" value={summary.setCount} hint={`${summary.exerciseCount} תרגילים`} />
        <Stat
          label="נפח"
          value={formatNumber(Math.round(toDisplayWeight(summary.volumeKg, units)), 0)}
          unit={unitLabel(units)}
          hint={
            summary.vsPrevious ? (
              <span className={cn(summary.vsPrevious.volumeDeltaKg >= 0 ? "text-success" : "text-text-muted")}>
                <bdi dir="ltr">
                  {summary.vsPrevious.volumeDeltaKg >= 0 ? "+" : "−"}
                  {formatNumber(Math.abs(Math.round(toDisplayWeight(summary.vsPrevious.volumeDeltaKg, units))), 0)}
                </bdi>{" "}
                מהפעם הקודמת
              </span>
            ) : undefined
          }
        />
      </div>

      <Panel className="flex flex-col gap-3">
        <h2 id="feel" className="text-lg">
          איך היה?
        </h2>
        <div role="radiogroup" aria-labelledby="feel" className="grid grid-cols-5 gap-1.5">
          {FEELINGS.map((f) => (
            <button
              key={f.v}
              type="button"
              role="radio"
              aria-checked={workout.rating === f.v}
              onClick={() => void updateWorkout(workout.id, { rating: f.v })}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 rounded-md text-xs transition-colors duration-(--motion-fast)",
                workout.rating === f.v ? "bg-accent text-on-accent" : "well text-text-muted hover:text-text",
              )}
            >
              <span className="figure text-xl leading-none">{f.v}</span>
              {f.label}
            </button>
          ))}
        </div>
      </Panel>

      <div className="flex flex-col gap-2">
        <Button size="lg" fullWidth onClick={() => router.push("/")}>
          סיום
        </Button>
        {!workout.templateId && (
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setTemplateName(workout.name ?? "");
              setSaveOpen(true);
            }}
          >
            שמירה כתבנית
          </Button>
        )}
        <Link href={`/history/view?id=${workout.id}`} className="py-2 text-center text-sm text-accent">
          לכל הסטים של האימון
        </Link>
      </div>

      <BottomSheet
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="שמירה כתבנית"
        description="בפעם הבאה אפשר להתחיל ממנה, עם אותם תרגילים ומספר סטים."
        footer={
          <Button
            size="lg"
            fullWidth
            disabled={!templateName.trim()}
            onClick={async () => {
              await saveWorkoutAsTemplate(workout.id, templateName);
              setSaveOpen(false);
              toast({ tone: "success", message: `התבנית „${templateName.trim()}” נשמרה` });
            }}
          >
            שמירת התבנית
          </Button>
        }
      >
        <div className="px-2 pt-1 pb-2">
          <TextField label="שם התבנית" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="למשל: רגליים וגב" maxLength={80} />
        </div>
      </BottomSheet>
    </>
  );
}

export default function SummaryPage() {
  return (
    <AppShell title="כל הכבוד" subtitle="האימון נשמר" bottomSpace={false}>
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <Summary />
      </Suspense>
    </AppShell>
  );
}
