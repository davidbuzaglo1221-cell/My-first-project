"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Activity, Barcode, Camera, ChevronLeft, Dumbbell, Plus, Scale, Search } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { Panel, Skeleton } from "@/components/ui/surface";
import { CalorieArc, MacroTrio, WeekStrip } from "@/components/nutrition/visuals";
import { getDayLog, getWeekMarks } from "@/data/nutrition-repo";
import { listFinishedWorkouts, listTemplates } from "@/data/repo";
import { useOpenWorkout, useProfile } from "@/hooks/use-data";
import { useNow } from "@/hooks/use-now";
import { useStartWorkout } from "@/hooks/use-start-workout";
import { localDateKey } from "@/lib/nutrition";
import { formatDuration, formatDurationWords, formatFullDate, formatRelativeDay, greeting, startOfWeek } from "@/lib/format";

/** S04: today at a glance. Eating (the arc) and training (the next workout) on one screen. */
export default function HomePage() {
  const router = useRouter();
  const profile = useProfile();
  const open = useOpenWorkout();
  const now = useNow(1000);
  const { start, pending } = useStartWorkout();
  const [sheet, setSheet] = useState(false);
  const today = localDateKey();
  const weekStart = profile ? localDateKey(startOfWeek(new Date(), profile.weekStartsOn)) : null;

  const day = useLiveQuery(() => getDayLog(today), [today]);
  const marks = useLiveQuery(async () => (weekStart ? getWeekMarks(weekStart) : null), [weekStart]);
  const training = useLiveQuery(async () => {
    const [templates, history] = await Promise.all([listTemplates(), listFinishedWorkouts()]);
    // Suggest the template that has waited longest since it was last done.
    const next = templates
      .map((t) => ({ t, last: history.find((h) => h.workout.templateId === t.template.id)?.workout.startedAt ?? "" }))
      .sort((a, b) => a.last.localeCompare(b.last) || a.t.template.position - b.t.template.position)[0]?.t;
    return { next, last: history[0] };
  }, []);

  return (
    <AppShell tab="home" title={now ? greeting(new Date(now)) : " "} subtitle={now ? formatFullDate(new Date(now)) : " "}>
      {marks ? (
        <WeekStrip days={marks} selected={today} today={today} onSelect={(d) => router.push(d === today ? "/nutrition" : `/nutrition?date=${d}`)} />
      ) : (
        <Skeleton className="h-16 rounded-pill" />
      )}

      <Link href="/nutrition" aria-label="ליומן התזונה של היום" className="block">
        <Panel className="flex flex-col gap-6 rounded-xl px-5 pt-6 pb-6">
          {day ? (
            <>
              <CalorieArc value={day.totals.kcal} target={day.targets.calories} size={240} />
              <MacroTrio
                values={{ protein: day.totals.protein, carbs: day.totals.carbs, fat: day.totals.fat }}
                targets={{ protein: day.targets.protein, carbs: day.targets.carbs, fat: day.targets.fat }}
              />
            </>
          ) : (
            <Skeleton className="h-64" />
          )}
        </Panel>
      </Link>

      <div className="grid grid-cols-4 gap-2">
        {[
          { href: `/nutrition/photo?date=${today}`, label: "צילום", Icon: Camera },
          { href: `/nutrition/add?date=${today}`, label: "חיפוש", Icon: Search },
          { href: `/nutrition/barcode?date=${today}`, label: "ברקוד", Icon: Barcode },
        ].map(({ href, label, Icon }) => (
          <Link key={label} href={href} className="glass flex flex-col items-center gap-2 rounded-lg py-3.5 text-sm font-medium">
            <Icon aria-hidden className="size-5" />
            {label}
          </Link>
        ))}
        <button type="button" onClick={() => setSheet(true)} className="glass flex flex-col items-center gap-2 rounded-lg py-3.5 text-sm font-medium">
          <Plus aria-hidden className="size-5" />
          עוד
        </button>
      </div>

      {open === undefined || !training ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : open ? (
        <Panel className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-muted">אימון בתהליך</span>
            <span className="figure text-2xl">
              <bdi dir="ltr">{now ? formatDuration((now - new Date(open.startedAt).getTime()) / 1000) : ""}</bdi>
            </span>
          </div>
          <h2 className="text-xl">{open.name ?? "אימון חופשי"}</h2>
          <Button size="lg" fullWidth onClick={() => void start()}>
            חזרה לאימון
          </Button>
        </Panel>
      ) : (
        <Panel className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-text-muted">האימון הבא</span>
              <h2 className="text-xl">{training.next?.template.name ?? "אימון חופשי"}</h2>
            </div>
            <Link href="/workouts" className="text-sm text-text-muted">
              כל התבניות
            </Link>
          </div>
          {training.next && <p className="text-sm leading-relaxed text-text-muted">{training.next.items.map((i) => i.exercise.nameHe).join(", ")}</p>}
          <Button size="lg" fullWidth loading={pending} onClick={() => void start(training.next?.template.id)}>
            התחלת אימון
          </Button>
        </Panel>
      )}

      {training?.last && (
        <Link href={`/history/view?id=${training.last.workout.id}`} className="glass flex items-center gap-4 rounded-lg p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm text-text-muted">האימון האחרון</span>
            <span className="font-medium">{training.last.workout.name ?? "אימון חופשי"}</span>
            <span className="text-sm text-text-subtle">
              {formatRelativeDay(training.last.workout.startedAt)}, {formatDurationWords(training.last.durationSec)}, {training.last.setCount} סטים
              {training.last.records.length > 0 && <span className="text-pr">, {training.last.records.length === 1 ? "שיא חדש" : `${training.last.records.length} שיאים`}</span>}
            </span>
          </div>
          <ChevronLeft aria-hidden className="size-5 shrink-0 text-text-subtle" />
        </Link>
      )}

      <BottomSheet open={sheet} onOpenChange={setSheet} title="מה להוסיף?">
        <SheetAction icon={<Camera aria-hidden className="size-5" />} label="צילום ארוחה" hint="זיהוי קלוריות מתמונה" onClick={() => router.push(`/nutrition/photo?date=${today}`)} />
        <SheetAction icon={<Search aria-hidden className="size-5" />} label="מזון מהמאגר" onClick={() => router.push(`/nutrition/add?date=${today}`)} />
        <SheetAction
          icon={<Dumbbell aria-hidden className="size-5" />}
          label={open ? "חזרה לאימון" : "אימון כוח"}
          hint={open ? undefined : "מתבנית או חופשי"}
          onClick={() => (open ? void start() : router.push("/workouts"))}
        />
        <SheetAction icon={<Activity aria-hidden className="size-5" />} label="קרדיו" hint="בשלב הבא" disabled />
        <SheetAction icon={<Scale aria-hidden className="size-5" />} label="שקילה" hint="בשלב הבא" disabled />
      </BottomSheet>
    </AppShell>
  );
}
