"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Activity, Award, Barcode, BookOpen, Camera, ChevronLeft, Dumbbell, Flame, Image as ImageIcon, Plus, Scale, Search } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { Panel, Skeleton } from "@/components/ui/surface";
import { CalorieArc, MacroTrio, WeekRing, WeekStrip } from "@/components/nutrition/visuals";
import { getDayLog, getWeekMarks } from "@/data/nutrition-repo";
import { getCoachSummary } from "@/data/coach-repo";
import { listFinishedWorkouts, listTemplates } from "@/data/repo";
import { useOpenWorkout, useProfile } from "@/hooks/use-data";
import { useNow } from "@/hooks/use-now";
import { useStartWorkout } from "@/hooks/use-start-workout";
import { localDateKey } from "@/lib/nutrition";
import { TOPIC_LABEL } from "@/lib/lessons";
import { formatDuration, formatDurationWords, formatFullDate, formatRelativeDay, greeting, startOfWeek } from "@/lib/format";
import { IS_ARTIFACT } from "@/lib/runtime";

/**
 * S04: today at a glance. One ink card carries the day's training (the week's goal, the streak,
 * the next workout); below it, eating, a one-minute lesson, and the next achievement within reach.
 */
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
  const coach = useLiveQuery(() => getCoachSummary(), []);
  const training = useLiveQuery(async () => {
    const [templates, history] = await Promise.all([listTemplates(), listFinishedWorkouts()]);
    // Suggest the template that has waited longest since it was last done.
    const next = templates
      .map((t) => ({ t, last: history.find((h) => h.workout.templateId === t.template.id)?.workout.startedAt ?? "" }))
      .sort((a, b) => a.last.localeCompare(b.last) || a.t.template.position - b.t.template.position)[0]?.t;
    return { next, last: history[0] };
  }, []);

  // First visit: the short setup. Anyone who already trained is never sent there.
  useEffect(() => {
    if (profile && !profile.onboardedAt && training && !training.last) router.replace("/welcome");
  }, [profile, training, router]);

  const nextBadge = coach?.achievements.filter((a) => !a.unlocked).sort((a, b) => b.progress - a.progress)[0];

  return (
    <AppShell tab="home" title={now ? greeting(new Date(now)) : " "} subtitle={now ? formatFullDate(new Date(now)) : " "}>
      {/* The ink card: the one dark, bold element on the screen. */}
      {open === undefined || !training || !coach ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : (
        <section aria-label="האימון של היום" className="flex flex-col gap-5 rounded-xl bg-accent p-5 text-on-accent shadow-pop">
          <div className="flex items-center gap-4">
            <WeekRing done={coach.thisWeek} goal={coach.weekGoal} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm text-on-accent/70">{coach.thisWeek >= coach.weekGoal
                  ? "היעד השבועי הושג"
                  : coach.weekGoal - coach.thisWeek === 1
                    ? "עוד אימון אחד ליעד השבועי"
                    : `עוד ${coach.weekGoal - coach.thisWeek} אימונים ליעד השבועי`}</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Flame aria-hidden className="size-4 text-pr-soft" />
                {coach.weekStreak > 0 ? `${coach.weekStreak} ${coach.weekStreak === 1 ? "שבוע" : "שבועות"} ברצף` : "רצף חדש מתחיל השבוע"}
              </span>
            </div>
          </div>
          <span aria-hidden className="h-px bg-on-accent/12" />
          {open ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[1.625rem] leading-tight font-bold tracking-tight">{open.name ?? "אימון חופשי"}</h2>
                <span className="figure text-2xl">
                  <bdi dir="ltr">{now ? formatDuration((now - new Date(open.startedAt).getTime()) / 1000) : ""}</bdi>
                </span>
              </div>
              <Button variant="inverse" size="lg" fullWidth onClick={() => void start()}>
                חזרה לאימון
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-on-accent/70">האימון הבא</span>
                <h2 className="text-[1.625rem] leading-tight font-bold tracking-tight">{training.next?.template.name ?? "אימון חופשי"}</h2>
                {training.next && <p className="line-clamp-2 text-sm leading-relaxed text-on-accent/70">{training.next.items.map((i) => i.exercise.nameHe).join(", ")}</p>}
              </div>
              <Button variant="inverse" size="lg" fullWidth loading={pending} onClick={() => void start(training.next?.template.id)}>
                התחלת אימון
              </Button>
            </div>
          )}
        </section>
      )}

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

      {coach && (
        <Link href={`/learn/read?id=${coach.lesson.id}`} className="glass flex flex-col gap-2 rounded-lg p-5">
          <span className="flex items-center gap-2 text-sm text-text-muted">
            <BookOpen aria-hidden className="size-4" />
            שיעור של דקה, {TOPIC_LABEL[coach.lesson.topic]}
          </span>
          <span className="text-lg font-semibold">{coach.lesson.title}</span>
          <span className="line-clamp-2 text-sm leading-relaxed text-text-muted">{coach.lesson.body[0]}</span>
        </Link>
      )}

      {nextBadge && (
        <Link href="/achievements" className="glass flex items-center gap-4 rounded-lg p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-pr-soft text-pr">
            <Award aria-hidden className="size-6" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-sm text-text-muted">ההישג הבא</span>
            <span className="font-semibold">{nextBadge.title}</span>
            <span className="well block h-1.5 overflow-hidden rounded-pill" role="progressbar" aria-label={nextBadge.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(nextBadge.progress * 100)}>
              <span className="block h-full rounded-pill bg-pr" style={{ width: `${Math.max(4, nextBadge.progress * 100)}%` }} />
            </span>
          </span>
          <ChevronLeft aria-hidden className="size-5 shrink-0 text-text-subtle" />
        </Link>
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
        <SheetAction icon={<Activity aria-hidden className="size-5" />} label="קרדיו" hint="הליכה, ריצה, אופניים" onClick={() => router.push("/cardio")} />
        <SheetAction icon={<Scale aria-hidden className="size-5" />} label="שקילה" onClick={() => router.push("/body")} />
        <SheetAction icon={<ImageIcon aria-hidden className="size-5" />} label="תמונת התקדמות" hint={IS_ARTIFACT ? "פרטית, גלויה רק לך" : "פרטית, נשמרת רק בטלפון"} onClick={() => router.push("/photos")} />
      </BottomSheet>
    </AppShell>
  );
}
