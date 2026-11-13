"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Activity, Barcode, Camera, Headphones, ChevronLeft, Dumbbell, Flame, Image as ImageIcon, NotebookPen, Plus, Scale, Scissors, Search, Swords, UserRound } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { Skeleton } from "@/components/ui/surface";
import { Countdown, DifficultyBars, DomainMark, GoldRing, MissionRow, Section } from "@/components/journey/parts";
import { getDayLog } from "@/data/nutrition-repo";
import { readLessonIds } from "@/data/coach-repo";
import { minutesOf, nextLesson } from "@/lib/journey/academy";
import { DOMAIN_LABEL } from "@/lib/journey/library";
import { getCheckIn } from "@/data/journey-repo";
import { listFinishedWorkouts, listTemplates } from "@/data/repo";
import { useOpenWorkout, useProfile } from "@/hooks/use-data";
import { useAllMissions, useCheckIns, useCuts, useDayMissions, useJourney, useToday } from "@/hooks/use-journey";
import { useStartWorkout } from "@/hooks/use-start-workout";
import { useNow } from "@/hooks/use-now";
import { dayNumber, JOURNEY_DAYS, levelOf, msLeftToday, performance, rankOf, streak, totalXp } from "@/lib/journey/engine";
import { shekel, summarize } from "@/lib/journey/business";
import { formatNumber, greeting } from "@/lib/format";
import { IS_ARTIFACT } from "@/lib/runtime";
import { cn } from "@/lib/cn";

/**
 * Today: the command center. One gold-edged card carries the day's mission and the time left;
 * under it the numbers that say how the week is really going, the side missions, the check-in,
 * the chair and the body.
 */
export default function TodayPage() {
  const router = useRouter();
  const profile = useProfile();
  const journey = useJourney();
  const today = useToday();
  const missions = useDayMissions(today, !!journey);
  const all = useAllMissions();
  const checkins = useCheckIns();
  const cuts = useCuts();
  const checkin = useLiveQuery(() => getCheckIn(today), [today]);
  const open = useOpenWorkout();
  const { start, pending } = useStartWorkout();
  const [sheet, setSheet] = useState(false);
  const nowMs = useNow(30_000);
  const now = nowMs ? new Date(nowMs) : null;

  const day = useLiveQuery(() => getDayLog(today), [today]);
  const leadDomain = missions?.find((m) => m.slot === "main")?.domain;
  const academy = useLiveQuery(async () => {
    const reads = await readLessonIds();
    const done = new Set([...reads].filter((r) => r.startsWith("academy:")).map((r) => r.slice(8)));
    return nextLesson(done, leadDomain);
  }, [leadDomain]);
  const training = useLiveQuery(async () => {
    const [templates, history] = await Promise.all([listTemplates(), listFinishedWorkouts()]);
    const next = templates
      .map((t) => ({ t, last: history.find((h) => h.workout.templateId === t.template.id)?.workout.startedAt ?? "" }))
      .sort((a, b) => a.last.localeCompare(b.last) || a.t.template.position - b.t.template.position)[0]?.t;
    return { next, last: history[0] };
  }, []);

  // First visit: set up the journey. Someone with training history but no journey starts it too.
  useEffect(() => {
    if (journey === null) router.replace("/journey/start");
  }, [journey, router]);

  const main = missions?.find((m) => m.slot === "main");
  const rest = missions?.filter((m) => m.slot !== "main") ?? [];
  const n = journey ? Math.max(1, dayNumber(journey.startDate, today)) : 1;
  const level = levelOf(n);
  const perf = all && checkins ? performance(all, checkins, today) : null;
  const run = all ? streak(all, today) : 0;
  const xp = all ? totalXp(all) : 0;
  const rank = rankOf(xp);
  const todayCuts = summarize((cuts ?? []).filter((c) => c.date === today));
  const name = journey?.name?.trim() || profile?.displayName?.trim() || "";

  return (
    <AppShell
      tab="home"
      eyebrow={journey ? `יום ${n} מתוך ${JOURNEY_DAYS} · ${level.name}` : " "}
      title={now ? `${greeting(now)}${name ? `, ${name}` : ""}` : " "}
      action={
        <Link href="/profile" aria-label="פרופיל והגדרות" className="glass inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-text-muted hover:text-text">
          <UserRound aria-hidden className="size-5" strokeWidth={1.6} />
        </Link>
      }
    >
      {/* The mission of the day. */}
      {!main || !now ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <section aria-label="המשימה של היום" className="card-hero rise flex flex-col gap-5 rounded-xl p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">{main.boss ? "מבחן הדרגה" : "המשימה של היום"}</span>
            {main.status === "open" ? (
              <span className="flex items-center gap-2 text-xs text-text-muted">
                נשארו
                <Countdown until={now.getTime() + msLeftToday(now)} className="text-sm text-text" />
              </span>
            ) : (
              <span className={cn("rounded-pill px-2.5 py-1 text-xs font-semibold", main.status === "done" ? "bg-accent text-on-accent" : "well text-text-muted")}>
                {main.status === "done" ? "בוצע" : "דילגת"}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <DomainMark domain={main.domain} />
              <DifficultyBars value={main.difficulty} />
              {main.boss && (
                <span className="inline-flex items-center gap-1 rounded-pill bg-blood px-2 py-0.5 text-[0.6875rem] font-semibold text-on-blood">
                  <Swords aria-hidden className="size-3" />
                  {main.xp} נק׳
                </span>
              )}
            </div>
            <h2 className="display text-[2.15rem] leading-[1.08]">{main.title}</h2>
            <p className="text-[0.975rem] leading-relaxed text-text-muted">{main.objective}</p>
          </div>
          <div className="hairline" />
          <div className="flex items-center gap-3">
            <Button size="lg" fullWidth onClick={() => router.push(`/mission?id=${encodeURIComponent(main.id)}`)}>
              {main.status === "done" ? "מה כתבת" : main.status === "skipped" ? "לפתוח מחדש" : main.progress > 0 ? "להמשיך" : "לקבל את המשימה"}
            </Button>
          </div>
        </section>
      )}

      {/* How it is really going. */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-5 rounded-xl glass p-5">
        {perf ? (
          <GoldRing value={perf.score / 100} size={112} label={`ציון ביצוע לשבוע: ${perf.score} מתוך 100`}>
            <span className="figure text-[2rem] leading-none">{perf.score}</span>
            <span className="mt-1 text-[0.625rem] tracking-widest text-text-subtle">ביצוע 7 ימים</span>
          </GoldRing>
        ) : (
          <Skeleton className="size-28 rounded-pill" />
        )}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <Flame aria-hidden className={cn("size-5", run > 0 ? "text-blood-ink" : "text-text-subtle")} />
            <span className="figure text-xl">{run}</span>
            <span className="text-sm text-text-muted">{run === 1 ? "יום ברצף" : "ימים ברצף"}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">{rank.name}</span>
              <span className="figure text-xs text-text-subtle">{formatNumber(xp, 0)} נק׳</span>
            </div>
            <span className="well block h-1.5 overflow-hidden rounded-pill" role="progressbar" aria-label="התקדמות לדרגה הבאה" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rank.progress * 100)}>
              <span className="block h-full rounded-pill bg-accent transition-[width] duration-700" style={{ width: `${Math.max(3, rank.progress * 100)}%` }} />
            </span>
            {rank.next && <span className="text-xs text-text-subtle">עוד {formatNumber(rank.toNext, 0)} ל{rank.next}</span>}
          </div>
        </div>
      </div>

      {rest.length > 0 && (
        <Section title="משימות צד">
          <div className="flex flex-col gap-2.5">
            {rest.map((m, i) => (
              <MissionRow key={m.id} m={m} index={i + 1} />
            ))}
          </div>
        </Section>
      )}

      <Section title="היומן">
        <Link href="/checkin" className="glass flex items-center gap-4 rounded-lg p-4">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-pill", checkin ? "bg-accent text-on-accent" : "border border-accent/50 text-accent-ink")}>
            <NotebookPen aria-hidden className="size-5" strokeWidth={1.7} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold">{checkin ? "הצ'ק-אין של היום" : "צ'ק-אין של 60 שניות"}</span>
            <span className="truncate text-sm text-text-muted">
              {checkin
                ? [checkin.sleepHours != null && `${formatNumber(checkin.sleepHours, 1)} ש׳ שינה`, checkin.energy != null && `אנרגיה ${checkin.energy}/5`, checkin.trained && "התאמן", checkin.screenHours != null && `${formatNumber(checkin.screenHours, 1)} ש׳ מסך`].filter(Boolean).join(" · ")
                : "שינה, אנרגיה, מסך, ניצחון ולקח."}
            </span>
          </span>
          <ChevronLeft aria-hidden className="size-5 shrink-0 text-text-subtle" />
        </Link>
      </Section>

      <Section title="הכיסא" href="/business" linkLabel="לעסק">
        <div className="glass flex items-center gap-4 rounded-lg p-4">
          <div className="flex min-w-0 flex-1 gap-6">
            <div className="flex flex-col">
              <span className="text-xs text-text-muted">היום</span>
              <span className="figure text-2xl">{shekel(todayCuts.income)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-text-muted">תספורות</span>
              <span className="figure text-2xl">{todayCuts.cuts}</span>
            </div>
          </div>
          <Button variant="soft" icon={<Scissors aria-hidden className="size-4" />} onClick={() => router.push("/business/log")}>
            רישום
          </Button>
        </div>
      </Section>

      <Section title="הגוף" href="/workouts" linkLabel="לגוף">
        {open === undefined || !training ? (
          <Skeleton className="h-28 rounded-lg" />
        ) : (
          <div className="glass flex flex-col gap-4 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-pill border border-border text-accent-ink">
                <Dumbbell aria-hidden className="size-5" strokeWidth={1.7} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs text-text-muted">{open ? "אימון פתוח" : "האימון הבא"}</span>
                <span className="truncate font-semibold">{open ? (open.name ?? "אימון חופשי") : (training.next?.template.name ?? "אימון חופשי")}</span>
              </div>
              <Button variant={open ? "primary" : "secondary"} loading={pending} onClick={() => void (open ? start() : start(training.next?.template.id))}>
                {open ? "חזרה" : "התחלה"}
              </Button>
            </div>
            {day && (
              <Link href="/nutrition" className="flex items-center gap-4 border-t border-border pt-3 text-sm">
                <span className="text-text-muted">תזונה היום</span>
                <span className="figure">{formatNumber(day.totals.kcal, 0)}<span className="text-text-subtle">/{formatNumber(day.targets.calories, 0)} קל׳</span></span>
                <span className="figure">{formatNumber(day.totals.protein, 0)}<span className="text-text-subtle">/{formatNumber(day.targets.protein, 0)} ג׳ חלבון</span></span>
              </Link>
            )}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          {[
            { href: `/nutrition/photo?date=${today}`, label: "צילום", Icon: Camera },
            { href: `/nutrition/add?date=${today}`, label: "חיפוש", Icon: Search },
            { href: `/nutrition/barcode?date=${today}`, label: "ברקוד", Icon: Barcode },
          ].map(({ href, label, Icon }) => (
            <Link key={label} href={href} className="glass flex flex-col items-center gap-2 rounded-lg py-3.5 text-sm font-medium">
              <Icon aria-hidden className="size-5 text-accent-ink" strokeWidth={1.6} />
              {label}
            </Link>
          ))}
          <button type="button" onClick={() => setSheet(true)} className="glass flex flex-col items-center gap-2 rounded-lg py-3.5 text-sm font-medium">
            <Plus aria-hidden className="size-5 text-accent-ink" strokeWidth={1.6} />
            עוד
          </button>
        </div>
      </Section>

      {academy && (
        <Section title="השיעור של היום" href="/academy" linkLabel="האקדמיה">
          <Link href={`/academy/read?id=${academy.id}`} className="glass group flex items-center gap-4 rounded-xl p-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-accent text-on-accent shadow-[0_10px_24px_-12px_var(--c-accent)]">
              <Headphones aria-hidden className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs text-text-subtle">
                {DOMAIN_LABEL[academy.domain]} · {minutesOf(academy)} דק׳ האזנה
              </span>
              <span className="display text-xl leading-snug">{academy.title}</span>
              <span className="line-clamp-2 text-sm leading-relaxed text-text-muted">{academy.hook}</span>
            </span>
            <ChevronLeft aria-hidden className="size-5 shrink-0 text-text-subtle" />
          </Link>
        </Section>
      )}

      <BottomSheet open={sheet} onOpenChange={setSheet} title="מה להוסיף?">
        <SheetAction icon={<Scissors aria-hidden className="size-5" />} label="תספורת" hint="לקוח, מחיר, קבע תור" onClick={() => router.push("/business/log")} />
        <SheetAction icon={<NotebookPen aria-hidden className="size-5" />} label="צ'ק-אין" hint="שינה, אנרגיה, מסך" onClick={() => router.push("/checkin")} />
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
