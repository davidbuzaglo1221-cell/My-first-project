"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, History, Library } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Banner, Panel, Skeleton } from "@/components/ui/surface";
import { listFinishedWorkouts, listTemplates } from "@/data/repo";
import { useOpenWorkout } from "@/hooks/use-data";
import { useStartWorkout } from "@/hooks/use-start-workout";
import { formatRelativeDay } from "@/lib/format";

export default function WorkoutsPage() {
  const open = useOpenWorkout();
  const { start, pending } = useStartWorkout();
  const data = useLiveQuery(async () => ({ templates: await listTemplates(), history: await listFinishedWorkouts() }), []);

  return (
    <AppShell tab="workouts" title="אימונים">
      {open && (
        <Banner
          tone="success"
          action={
            <button type="button" onClick={() => void start()} className="text-sm font-semibold text-accent">
              חזרה
            </button>
          }
        >
          יש אימון פתוח: {open.name ?? "אימון חופשי"}
        </Banner>
      )}

      <section aria-labelledby="templates" className="flex flex-col gap-3">
        <h2 id="templates" className="text-lg">
          התבניות שלי
        </h2>
        {!data ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : (
          data.templates.map(({ template, items }) => {
            const last = data.history.find((h) => h.workout.templateId === template.id);
            return (
              <Panel key={template.id} className="flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-xl font-bold">{template.name}</h3>
                  <span className="shrink-0 text-xs text-text-subtle">
                    {last ? `לאחרונה: ${formatRelativeDay(last.workout.startedAt)}` : "עוד לא בוצע"}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-text-muted">{items.map((i) => i.exercise.nameHe).join(", ")}</p>
                <Button variant={open ? "secondary" : "primary"} fullWidth loading={pending} disabled={!!open} onClick={() => void start(template.id)}>
                  התחלה
                </Button>
              </Panel>
            );
          })
        )}
        <Button variant="ghost" fullWidth disabled={!!open} onClick={() => void start()}>
          אימון חופשי, בלי תבנית
        </Button>
      </section>

      <nav aria-label="עוד" className="glass flex flex-col rounded-lg">
        <Link href="/history" className="flex items-center gap-3 px-4 py-4">
          <History aria-hidden className="size-5 text-accent" />
          <span className="flex-1">היסטוריית אימונים</span>
          <span className="num text-sm text-text-subtle">{data?.history.length ?? ""}</span>
          <ChevronLeft aria-hidden className="size-4 text-text-subtle" />
        </Link>
        <span aria-hidden className="mx-4 h-px bg-border/60" />
        <Link href="/exercises" className="flex items-center gap-3 px-4 py-4">
          <Library aria-hidden className="size-5 text-accent" />
          <span className="flex-1">ספריית תרגילים</span>
          <ChevronLeft aria-hidden className="size-4 text-text-subtle" />
        </Link>
      </nav>
    </AppShell>
  );
}
