"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Award, Lock, Settings2, Swords } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Skeleton } from "@/components/ui/surface";
import { HBars, Section } from "@/components/journey/parts";
import { listSales } from "@/data/journey-repo";
import { useAllMissions, useCheckIns, useCuts, useJourney, useToday } from "@/hooks/use-journey";
import { journeyBadges } from "@/lib/journey/achievements";
import { bestStreak, dayNumber, JOURNEY_DAYS, LEVELS, levelOf, totalXp } from "@/lib/journey/engine";
import { DOMAIN_LABEL, DOMAINS } from "@/lib/journey/library";
import { addDays } from "@/lib/nutrition";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * The 90 days as a map: six levels, a cell for every day (gold done, red the tests, dim ahead),
 * the areas trained so far, and the marks earned.
 */
export default function JourneyPage() {
  const journey = useJourney();
  const today = useToday();
  const missions = useAllMissions();
  const checkins = useCheckIns();
  const cuts = useCuts();
  const sales = useLiveQuery(() => listSales(), []);

  const data = useMemo(() => {
    if (!journey || !missions) return null;
    const n = Math.max(1, dayNumber(journey.startDate, today));
    const days = Array.from({ length: JOURNEY_DAYS }, (_, i) => {
      const date = addDays(journey.startDate, i);
      const main = missions.find((m) => m.date === date && m.slot === "main");
      return { i: i + 1, date, status: main?.status ?? null, boss: (i + 1) % 15 === 0 };
    });
    const done = missions.filter((m) => m.status === "done");
    const perDomain = DOMAINS.map((d) => ({ label: DOMAIN_LABEL[d], value: done.filter((m) => m.domain === d).length }));
    return { n, days, done: done.length, perDomain, best: bestStreak(missions), xp: totalXp(missions) };
  }, [journey, missions, today]);

  const badges = missions && checkins && cuts && sales ? journeyBadges({ missions, checkins, cuts, sales }) : null;

  if (!journey || !data) {
    return (
      <AppShell tab="journey" eyebrow="90 יום" title="המסע">
        <Skeleton className="h-96 rounded-xl" />
      </AppShell>
    );
  }
  const level = levelOf(data.n);
  const over = data.n > JOURNEY_DAYS;

  return (
    <AppShell
      tab="journey"
      eyebrow={over ? "90 יום מאחוריך" : `יום ${data.n} מתוך ${JOURNEY_DAYS}`}
      title="המסע"
      action={
        <Link href="/journey/start?edit=1" aria-label="הגדרות המסע" className="glass inline-flex size-11 items-center justify-center rounded-pill text-text-muted hover:text-text">
          <Settings2 aria-hidden className="size-5" strokeWidth={1.6} />
        </Link>
      }
    >
      <section className="card-hero rise flex flex-col gap-4 rounded-xl p-6" aria-label="השלב הנוכחי">
        <span className="eyebrow">שלב {level.n} מתוך 6</span>
        <h2 className="display text-[2.2rem] leading-none">{level.name}</h2>
        <p className="text-text-muted">{level.theme}</p>
        <div className="flex flex-col gap-2">
          <span className="well block h-1.5 overflow-hidden rounded-pill">
            <span className="block h-full rounded-pill bg-accent" style={{ width: `${Math.min(100, ((data.n - level.firstDay + 1) / 15) * 100)}%` }} />
          </span>
          <span className="text-xs text-text-subtle">
            {level.lastDay - data.n > 0 ? `עוד ${level.lastDay - data.n} ימים למבחן הדרגה` : "היום: מבחן הדרגה"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[
            { l: "משימות", v: formatNumber(data.done, 0) },
            { l: "רצף שיא", v: formatNumber(data.best, 0) },
            { l: "נקודות", v: formatNumber(data.xp, 0) },
          ].map((s) => (
            <div key={s.l} className="flex flex-col">
              <span className="figure text-2xl">{s.v}</span>
              <span className="text-xs text-text-subtle">{s.l}</span>
            </div>
          ))}
        </div>
      </section>

      <Section title="המפה">
        <div className="glass flex flex-col gap-5 rounded-xl p-5">
          {LEVELS.map((lv) => {
            const cells = data.days.slice(lv.firstDay - 1, lv.lastDay);
            const ahead = data.n < lv.firstDay;
            return (
              <div key={lv.n} className={cn("flex flex-col gap-2", ahead && "opacity-55")}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">
                    <span className="figure me-2 text-accent-ink">{lv.n}</span>
                    {lv.name}
                  </span>
                  <span className="text-xs text-text-subtle">
                    ימים <bdi dir="ltr">{lv.firstDay}–{lv.lastDay}</bdi>
                  </span>
                </div>
                <ol className="grid grid-cols-15 gap-1" aria-label={`שלב ${lv.name}`}>
                  {cells.map((c) => (
                    <li
                      key={c.i}
                      title={`יום ${c.i}${c.status === "done" ? ": בוצע" : c.status === "skipped" ? ": דילגת" : ""}`}
                      aria-label={`יום ${c.i}${c.status === "done" ? ", בוצע" : c.status === "skipped" ? ", דילגת" : c.i === data.n ? ", היום" : ""}`}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-[4px]",
                        c.status === "done" ? (c.boss ? "bg-blood" : "bg-accent") : c.boss ? "border border-blood-ink/60" : "well",
                        c.status === "skipped" && "bg-transparent outline outline-1 -outline-offset-1 outline-text-subtle/50",
                        c.i === data.n && "ring-2 ring-text ring-offset-2 ring-offset-surface",
                      )}
                    >
                      {c.boss && c.status !== "done" && <Swords aria-hidden className="size-2.5 text-blood-ink" />}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-4 text-xs text-text-subtle">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-accent" />בוצע</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-blood" />מבחן שעבר</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] outline outline-1 outline-text-subtle/50" />דילגת</span>
          </div>
        </div>
      </Section>

      <Section title="מה נבנה עד עכשיו" href="/review" linkLabel="הדוח השבועי">
        <div className="glass rounded-xl p-5">
          <HBars rows={data.perDomain} />
        </div>
      </Section>

      <Section title="סימנים">
        {!badges ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <ul className="grid grid-cols-2 gap-2.5">
            {badges.map((b, i) => (
              <li key={b.id} className={cn("glass rise flex flex-col gap-2 rounded-lg p-4", b.unlocked && "border-accent/40")} style={{ ["--i" as string]: i % 6 }}>
                <span className={cn("flex size-9 items-center justify-center rounded-pill", b.unlocked ? "bg-accent text-on-accent" : "well text-text-subtle")}>
                  {b.unlocked ? <Award aria-hidden className="size-4.5" /> : <Lock aria-hidden className="size-4" />}
                </span>
                <span className={cn("text-sm font-semibold", !b.unlocked && "text-text-muted")}>{b.title}</span>
                <span className="text-xs leading-snug text-text-subtle">{b.body}</span>
                {!b.unlocked && (
                  <span className="mt-auto flex items-center gap-2">
                    <span className="well block h-1 flex-1 overflow-hidden rounded-pill">
                      <span className="block h-full bg-accent/70" style={{ width: `${b.progress * 100}%` }} />
                    </span>
                    <span className="figure text-[0.625rem] text-text-subtle">{b.detail}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
