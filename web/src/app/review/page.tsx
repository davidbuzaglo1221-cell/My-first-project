"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Banner, Panel, Skeleton } from "@/components/ui/surface";
import { BarChart, LineChart } from "@/components/progress/charts";
import { GoldRing, HBars, Metric, Section } from "@/components/journey/parts";
import { listNotes, listSales, saveJourney, saveNote } from "@/data/journey-repo";
import { useCoachContext } from "@/hooks/use-journey";
import { weeklyIncome, shekel } from "@/lib/journey/business";
import { COACH_ERROR_TEXT, weeklyReport, type CoachError } from "@/lib/journey/coach-ai";
import { bestStreak, performance } from "@/lib/journey/engine";
import { addDays } from "@/lib/nutrition";
import { formatNumber, formatRelativeDay } from "@/lib/format";

const short = (k: string) => `${Number(k.slice(8, 10))}/${Number(k.slice(5, 7))}`;

/**
 * The week in numbers and in the coach's words: the score and what it is made of, the trends,
 * the records, and an honest report that also sets next week's difficulty.
 */
export default function ReviewPage() {
  const ctx = useCoachContext();
  const notes = useLiveQuery(() => listNotes(), []);
  const sales = useLiveQuery(() => listSales(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CoachError | null>(null);

  const v = useMemo(() => {
    if (!ctx) return null;
    const { missions, checkins, cuts, today } = ctx;
    const perf = performance(missions, checkins, today);
    const prev = performance(missions, checkins, addDays(today, -7));
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    const doneByDay = days.map((d) => ({ label: short(d), value: missions.filter((m) => m.date === d && m.status === "done").length, highlight: d === today }));
    const cs = checkins.filter((c) => c.date >= days[0]);
    const sleep = cs.filter((c) => c.sleepHours != null).map((c, i) => ({ x: i, y: c.sleepHours!, label: short(c.date) }));
    const screen = cs.filter((c) => c.screenHours != null).map((c, i) => ({ x: i, y: c.screenHours!, label: short(c.date) }));
    const weeks = weeklyIncome(cuts, today, 8);
    const xpByDay = new Map<string, number>();
    for (const m of missions) if (m.status === "done") xpByDay.set(m.date, (xpByDay.get(m.date) ?? 0) + m.xp);
    return {
      perf,
      delta: perf.score - prev.score,
      doneByDay,
      sleep,
      screen,
      weeks,
      records: {
        streak: bestStreak(missions),
        bestDay: Math.max(0, ...xpByDay.values()),
        bestWeek: Math.max(0, ...weeks.map((w) => w.income)),
      },
    };
  }, [ctx]);

  const report = notes?.find((n) => n.kind === "report");
  const bestSales = Math.max(0, ...(sales ?? []).filter((s) => s.review).map((s) => s.review!.score));

  const write = async () => {
    if (!ctx) return;
    setBusy(true);
    setError(null);
    const r = await weeklyReport(ctx);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    await saveNote({ id: crypto.randomUUID(), at: new Date().toISOString(), kind: "report", weekStart: addDays(ctx.today, -6), question: null, report: r.data, answer: null });
    // The coach's call on difficulty moves the next days' missions by one step.
    const bias = r.data.difficulty === "up" ? 1 : r.data.difficulty === "down" ? -1 : 0;
    await saveJourney({ difficultyBias: bias });
  };

  return (
    <AppShell tab="coach" back={{ href: "/coach", label: "המאמן" }} eyebrow="7 הימים האחרונים" title="הדוח השבועי">
      {!v ? (
        ctx === null ? <Banner tone="warning">הדוח מתחיל אחרי שהמסע מתחיל.</Banner> : <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <section className="card-hero rise flex items-center gap-5 rounded-xl p-6" aria-label="ציון ביצוע">
            <GoldRing value={v.perf.score / 100} size={124} label={`ציון ביצוע ${v.perf.score}`}>
              <span className="figure text-[2.4rem] leading-none">{v.perf.score}</span>
              <span className="mt-1 text-[0.625rem] tracking-widest text-text-subtle">מתוך 100</span>
            </GoldRing>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="eyebrow">ציון ביצוע</span>
              <span className={v.delta >= 0 ? "figure text-accent-ink" : "figure text-blood-ink"}>
                {v.delta >= 0 ? "+" : "−"}
                {Math.abs(v.delta)} משבוע שעבר
              </span>
              <span className="text-xs leading-relaxed text-text-subtle">משימות, צ׳ק-אין, שינה של 7 שעות ומעלה, ולפחות שלושה אימונים.</span>
            </div>
          </section>

          <Panel>
            <HBars rows={v.perf.parts.map((p) => ({ label: p.label, value: p.value / p.max, hint: `${p.value}/${p.max}` }))} max={1} />
          </Panel>

          <Section title="דוח המאמן">
            {error && <Banner tone="danger">{COACH_ERROR_TEXT[error]}</Banner>}
            {report?.report ? (
              <div className="glass flex flex-col gap-4 rounded-xl p-5">
                <p className="display text-2xl leading-snug">{report.report.headline}</p>
                {[
                  { t: "התקדמות", l: report.report.wins },
                  { t: "התחמקויות", l: report.report.gaps },
                  { t: "שלוש העדיפויות לשבוע הבא", l: report.report.priorities },
                ].map((g) =>
                  g.l.length ? (
                    <div key={g.t} className="flex flex-col gap-2">
                      <span className="eyebrow">{g.t}</span>
                      <ul className="flex flex-col gap-1.5">
                        {g.l.map((x, i) => (
                          <li key={i} className="flex gap-2 text-[0.95rem] leading-relaxed">
                            <ChevronLeft aria-hidden className="mt-1 size-4 shrink-0 text-accent-ink" />
                            {x}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
                <div className="well rounded-md p-4 text-sm leading-relaxed">
                  <span className="font-semibold text-accent-ink">הדפוס: </span>
                  {report.report.pattern}
                </div>
                <span className="text-xs text-text-subtle">
                  {formatRelativeDay(report.at)} · קושי המשימות: {report.report.difficulty === "up" ? "עולה" : report.report.difficulty === "down" ? "יורד" : "נשאר"}
                </span>
                <Button variant="secondary" loading={busy} onClick={() => void write()}>
                  דוח חדש
                </Button>
              </div>
            ) : (
              <Panel className="flex flex-col gap-3">
                <p className="text-sm leading-relaxed text-text-muted">המאמן קורא את השבוע, אומר לך איפה התקדמת ואיפה התחמקת, ומכוון את הקושי של המשימות הבאות.</p>
                <Button loading={busy} icon={<Sparkles aria-hidden className="size-4" />} onClick={() => void write()}>
                  לכתוב את הדוח
                </Button>
              </Panel>
            )}
          </Section>

          <Section title="משימות שבוצעו, 14 יום">
            <div className="glass rounded-xl p-5">
              <BarChart label="משימות שבוצעו בכל יום" bars={v.doneByDay} target={1} />
            </div>
          </Section>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="glass flex flex-col gap-2 rounded-xl p-5">
              <span className="eyebrow">שינה</span>
              <LineChart label="שעות שינה" unit="שעות" points={v.sleep} height={110} empty="שני צ'ק-אינים עם שינה, ותראה מגמה." />
            </div>
            <div className="glass flex flex-col gap-2 rounded-xl p-5">
              <span className="eyebrow">מסך</span>
              <LineChart label="שעות מסך" unit="שעות" points={v.screen} height={110} empty="שני צ'ק-אינים עם שעות מסך, ותראה מגמה." />
            </div>
          </div>

          <Section title="הכנסה, 8 שבועות">
            <div className="glass rounded-xl p-5">
              <BarChart label="הכנסה לפי שבוע" bars={v.weeks.map((w, i) => ({ label: short(w.start), value: w.income, highlight: i === v.weeks.length - 1 }))} />
            </div>
          </Section>

          <Section title="שיאים">
            <div className="grid grid-cols-2 gap-2.5">
              <Metric label="רצף הכי ארוך" value={`${v.records.streak} ימים`} tone="gold" />
              <Metric label="יום הכי חזק" value={`${formatNumber(v.records.bestDay, 0)} נק׳`} />
              <Metric label="שבוע הכנסה שיא" value={shekel(v.records.bestWeek)} />
              <Metric label="ציון מכירה שיא" value={bestSales || "—"} />
            </div>
          </Section>
        </>
      )}
    </AppShell>
  );
}
