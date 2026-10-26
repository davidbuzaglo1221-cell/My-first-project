"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Activity, Award, BookOpen, ChevronLeft, Image as ImageIcon, LineChart as LineIcon, Scale } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState, Panel, Skeleton, Stat } from "@/components/ui/surface";
import { BarChart } from "@/components/progress/charts";
import { StrengthPanel } from "@/components/progress/strength-panel";
import { getWeekMarks } from "@/data/nutrition-repo";
import { exerciseHistory, listExercises, listFinishedWorkouts } from "@/data/repo";
import { useProfile } from "@/hooks/use-data";
import { localDateKey } from "@/lib/nutrition";
import { formatNumber, formatWeight, startOfWeek, toDisplayWeight, unitLabel } from "@/lib/format";

const shortDate = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric" });
const weekday = new Intl.DateTimeFormat("he-IL", { weekday: "narrow" });

/** S18: training per week, this week's eating, and the best lifts. */
export default function ProgressPage() {
  const profile = useProfile();
  const units = profile?.units ?? "kg";
  const data = useLiveQuery(async () => {
    if (!profile) return null;
    const history = await listFinishedWorkouts();
    const thisWeek = startOfWeek(new Date(), profile.weekStartsOn);
    // The last 8 weeks, oldest first.
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const start = new Date(thisWeek);
      start.setDate(start.getDate() - (7 - i) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const inWeek = history.filter((h) => new Date(h.workout.startedAt) >= start && new Date(h.workout.startedAt) < end);
      return { start, count: inWeek.length, volume: inWeek.reduce((n, h) => n + h.volumeKg, 0) };
    });
    const marks = await getWeekMarks(localDateKey(thisWeek));
    const exercises = await listExercises();
    const lifts = (
      await Promise.all(
        exercises.map(async (e) => {
          const h = await exerciseHistory(e.id);
          const best = h.reduce<number | null>((m, x) => (x.bestE1rm != null && (m == null || x.bestE1rm > m) ? x.bestE1rm : m), null);
          return best != null ? { exercise: e, best, sessions: h.length } : null;
        }),
      )
    )
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.sessions - a.sessions || b.best - a.best)
      .slice(0, 6);
    return { history, weeks, marks, lifts };
  }, [profile]);

  if (!data) {
    return (
      <AppShell tab="progress" title="התקדמות">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </AppShell>
    );
  }

  const logged = data.marks.filter((m) => m.logged);
  const avgKcal = logged.length ? logged.reduce((n, m) => n + m.kcal, 0) / logged.length : 0;

  return (
    <AppShell tab="progress" title="התקדמות">
      {data.history.length === 0 && logged.length === 0 ? (
        <EmptyState
          icon={<LineIcon aria-hidden className="size-6" />}
          title="הנתונים יופיעו כאן"
          body="אחרי כמה אימונים וימים של רישום אוכל, כאן רואים את המגמה: אימונים בשבוע, נפח, קלוריות והתרגילים החזקים שלך."
          action={
            <Link href="/workouts" className="font-semibold">
              להתחלת אימון
            </Link>
          }
        />
      ) : (
        <>
          <StrengthPanel units={units} />
          <nav aria-label="עוד מעקב" className="grid grid-cols-5 gap-2">
            {[
              { href: "/body", label: "משקל", Icon: Scale },
              { href: "/cardio", label: "קרדיו", Icon: Activity },
              { href: "/photos", label: "תמונות", Icon: ImageIcon },
              { href: "/achievements", label: "הישגים", Icon: Award },
              { href: "/learn", label: "ללמוד", Icon: BookOpen },
            ].map(({ href, label, Icon }) => (
              <Link key={href} href={href} className="glass flex flex-col items-center gap-1.5 rounded-lg py-3 text-xs font-medium">
                <Icon aria-hidden className="size-5" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="אימונים בסך הכול" value={data.history.length} />
            <Stat label="השבוע" value={data.weeks.at(-1)!.count} hint="אימונים" />
            <Stat label="ממוצע יומי" value={avgKcal ? formatNumber(Math.round(avgKcal), 0) : "—"} hint="קלוריות השבוע" />
          </div>

          <Panel className="flex flex-col gap-3">
            <h2 className="text-lg">אימונים בשבוע</h2>
            <BarChart label="אימונים בשבוע, 8 שבועות" bars={data.weeks.map((w, i) => ({ label: shortDate.format(w.start), value: w.count, highlight: i === data.weeks.length - 1 }))} />
          </Panel>

          <Panel className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg">קלוריות השבוע</h2>
              <Link href="/nutrition" className="text-sm text-text-muted">
                ליומן
              </Link>
            </div>
            <BarChart
              label="קלוריות לפי יום השבוע"
              bars={data.marks.map((m) => ({ label: weekday.format(new Date(`${m.date}T12:00:00`)), value: m.kcal, highlight: m.onTarget }))}
            />
            <p className="text-xs text-text-subtle">עמודה כהה: יום בטווח של 10% מהיעד.</p>
          </Panel>

          {data.lifts.length > 0 && (
            <section aria-labelledby="lifts" className="flex flex-col gap-2">
              <h2 id="lifts" className="px-1 text-lg">
                התרגילים שלך
              </h2>
              <ul className="glass flex flex-col rounded-lg">
                {data.lifts.map((l, i) => (
                  <li key={l.exercise.id}>
                    {i > 0 && <span aria-hidden className="mx-4 block h-px bg-border" />}
                    <Link href={`/exercises/view?id=${l.exercise.id}`} className="flex items-center gap-3 px-4 py-3.5">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{l.exercise.nameHe}</span>
                        <span className="text-sm text-text-subtle">{l.sessions} אימונים</span>
                      </span>
                      <span className="shrink-0 text-end">
                        <span className="figure block text-lg leading-none">
                          {formatWeight(l.best, units)}
                          <span className="ms-1 text-xs font-normal text-text-subtle">{unitLabel(units)}</span>
                        </span>
                        <span className="text-xs text-text-subtle">1RM משוער</span>
                      </span>
                      <ChevronLeft aria-hidden className="size-4 shrink-0 text-text-subtle" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="px-1 text-xs text-text-subtle">
            נפח ב-8 השבועות: {formatNumber(Math.round(toDisplayWeight(data.weeks.reduce((n, w) => n + w.volume, 0), units)), 0)} {unitLabel(units)}.
          </p>
        </>
      )}
    </AppShell>
  );
}
