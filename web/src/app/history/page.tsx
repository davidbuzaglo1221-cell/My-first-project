"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, History } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState, Skeleton } from "@/components/ui/surface";
import { listFinishedWorkouts } from "@/data/repo";
import { useProfile } from "@/hooks/use-data";
import { formatDurationWords, formatNumber, formatRelativeDay, toDisplayWeight, unitLabel } from "@/lib/format";

const monthFmt = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" });

/** S20: every finished workout, grouped by month. */
export default function HistoryPage() {
  const profile = useProfile();
  const units = profile?.units ?? "kg";
  const history = useLiveQuery(() => listFinishedWorkouts(), []);

  const groups = new Map<string, NonNullable<typeof history>>();
  for (const w of history ?? []) {
    const key = monthFmt.format(new Date(w.workout.startedAt));
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }

  return (
    <AppShell tab="workouts" title="היסטוריה" back={{ href: "/workouts", label: "אימונים" }}>
      {!history ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <EmptyState
          icon={<History aria-hidden className="size-6" />}
          title="עוד אין אימונים"
          body="כל אימון שמסתיים נשמר כאן, עם הסטים, המשקלים והשיאים."
          action={
            <Link href="/workouts" className="font-semibold">
              להתחלת אימון
            </Link>
          }
        />
      ) : (
        [...groups.entries()].map(([month, items]) => (
          <section key={month} aria-label={month} className="flex flex-col gap-2">
            <h2 className="px-1 text-sm text-text-muted">{month}</h2>
            <ul className="glass flex flex-col rounded-lg">
              {items.map((w, i) => (
                <li key={w.workout.id}>
                  {i > 0 && <span aria-hidden className="mx-4 block h-px bg-border" />}
                  <Link href={`/history/view?id=${w.workout.id}`} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-medium">{w.workout.name ?? "אימון חופשי"}</span>
                      <span className="text-sm text-text-subtle">
                        {formatRelativeDay(w.workout.startedAt)}, {formatDurationWords(w.durationSec)}, {w.setCount} סטים
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="figure text-lg leading-none">
                        {formatNumber(Math.round(toDisplayWeight(w.volumeKg, units)), 0)}
                        <span className="ms-1 text-xs font-normal text-text-subtle">{unitLabel(units)}</span>
                      </span>
                      {w.records.length > 0 && <span className="text-xs text-pr">{w.records.length === 1 ? "שיא" : `${w.records.length} שיאים`}</span>}
                    </div>
                    <ChevronLeft aria-hidden className="size-4 shrink-0 text-text-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </AppShell>
  );
}
