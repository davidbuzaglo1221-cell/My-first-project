"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Award, Flame } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Panel, Skeleton, Stat } from "@/components/ui/surface";
import { getCoachSummary } from "@/data/coach-repo";
import { cn } from "@/lib/cn";

/** Every badge, unlocked ones engraved in brass, the rest with how far along you are. */
export default function AchievementsPage() {
  const coach = useLiveQuery(() => getCoachSummary(), []);
  if (!coach) {
    return (
      <AppShell tab="progress" title="הישגים" back={{ href: "/progress", label: "התקדמות" }}>
        <Skeleton className="h-96 rounded-xl" />
      </AppShell>
    );
  }
  const unlocked = coach.achievements.filter((a) => a.unlocked).length;
  const sorted = [...coach.achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.progress - a.progress);
  return (
    <AppShell tab="progress" title="הישגים" subtitle={`${unlocked} מתוך ${coach.achievements.length}`} back={{ href: "/progress", label: "התקדמות" }}>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="שבועות ברצף ביעד" value={coach.weekStreak} hint={`יעד: ${coach.weekGoal} אימונים בשבוע`} />
        <Stat label="ימים ברצף ביומן" value={coach.foodStreak} hint="רישום אוכל" />
      </div>
      <ul className="grid grid-cols-2 gap-2" aria-label="הישגים">
        {sorted.map((a) => (
          <li key={a.id}>
            <Panel className={cn("flex h-full flex-col gap-3 p-4", !a.unlocked && "opacity-90")}>
              <span className={cn("flex size-11 items-center justify-center rounded-pill", a.unlocked ? "bg-pr-soft text-pr" : "well text-text-subtle")}>
                {a.id.startsWith("streak") || a.id.startsWith("food") ? <Flame aria-hidden className="size-5" /> : <Award aria-hidden className="size-5" />}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className={cn("font-semibold", a.unlocked ? "text-text" : "text-text-muted")}>{a.title}</span>
                <span className="text-xs text-text-subtle">{a.detail}</span>
              </div>
              {a.unlocked ? (
                <span className="mt-auto text-xs font-semibold text-pr">הושג</span>
              ) : (
                <div
                  className="well mt-auto h-1.5 overflow-hidden rounded-pill"
                  role="progressbar"
                  aria-label={a.title}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(a.progress * 100)}
                >
                  <div className="h-full rounded-pill bg-pr" style={{ width: `${Math.max(3, a.progress * 100)}%` }} />
                </div>
              )}
            </Panel>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
