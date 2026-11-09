"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ChevronLeft, Plus, Scissors, Wallet } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button, Fab } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/surface";
import { BarChart } from "@/components/progress/charts";
import { Metric, Section } from "@/components/journey/parts";
import { useCuts, useJourney, useToday } from "@/hooks/use-journey";
import { clients, monthlyTotal, runway, shekel, summarize, weeklyIncome } from "@/lib/journey/business";
import { formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/cn";

const SERVICE: Record<string, string> = { haircut: "תספורת", beard: "זקן", combo: "תספורת וזקן", other: "אחר" };

/**
 * The chair as a business: this month's money, who comes back, the last eight weeks, and how
 * long the savings last at the pace of the last thirty days.
 */
export default function BusinessPage() {
  const router = useRouter();
  const journey = useJourney();
  const cuts = useCuts();
  const today = useToday();

  const view = useMemo(() => {
    if (!cuts) return null;
    const month = today.slice(0, 7);
    const thisMonth = summarize(cuts.filter((c) => c.date.startsWith(month)));
    const weeks = weeklyIncome(cuts, today, 8);
    const people = clients(cuts);
    const r = journey ? runway(journey, cuts, today) : null;
    return { thisMonth, weeks, people, r };
  }, [cuts, journey, today]);

  const hasMoney = journey && (journey.savings != null || monthlyTotal(journey.monthly) > 0);

  return (
    <AppShell tab="business" eyebrow="ספרות גברים" title="העסק">
      {!view ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <section className="card-hero rise flex flex-col gap-4 rounded-xl p-6" aria-label="החודש">
            <span className="eyebrow">החודש</span>
            <span className="display figure text-[3rem] leading-none">{shekel(view.thisMonth.income)}</span>
            {journey?.incomeGoal ? (
              <div className="flex flex-col gap-1.5">
                <span className="well block h-1.5 overflow-hidden rounded-pill">
                  <span className="block h-full rounded-pill bg-accent" style={{ width: `${Math.min(100, (view.thisMonth.income / journey.incomeGoal) * 100)}%` }} />
                </span>
                <span className="text-xs text-text-subtle">
                  {Math.round((view.thisMonth.income / journey.incomeGoal) * 100)}% מהיעד של {shekel(journey.incomeGoal)}
                </span>
              </div>
            ) : (
              <Link href="/business/money" className="text-sm text-text-muted underline-offset-4 hover:underline">
                לקבוע יעד הכנסה חודשי
              </Link>
            )}
            <div className="hairline" />
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col">
                <span className="figure text-2xl">{view.thisMonth.cuts}</span>
                <span className="text-xs text-text-subtle">תספורות</span>
              </div>
              <div className="flex flex-col">
                <span className="figure text-2xl">{shekel(view.thisMonth.avgPrice)}</span>
                <span className="text-xs text-text-subtle">מחיר ממוצע</span>
              </div>
              <div className="flex flex-col">
                <span className="figure text-2xl">{Math.round(view.thisMonth.rebookShare * 100)}%</span>
                <span className="text-xs text-text-subtle">קבעו תור הבא</span>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2.5">
            <Metric label="לקוחות חדשים החודש" value={view.thisMonth.newClients} />
            <Metric label="לקוחות חוזרים" value={`${Math.round(view.thisMonth.returningShare * 100)}%`} hint="מהתספורות החודש" />
          </div>

          <Section title="כמה זמן הכסף מחזיק" href="/business/money" linkLabel="עריכה">
            {!hasMoney || !view.r ? (
              <Link href="/business/money" className="glass flex items-center gap-4 rounded-lg p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-pill border border-accent/50 text-accent-ink">
                  <Wallet aria-hidden className="size-5" strokeWidth={1.7} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold">המספרים של החיים</span>
                  <span className="text-sm text-text-muted">חסכונות, שכירות, הוצאות. כדי לדעת אם אפשר לגור לבד.</span>
                </span>
                <ChevronLeft aria-hidden className="size-5 text-text-subtle" />
              </Link>
            ) : (
              <div className="glass flex flex-col gap-4 rounded-xl p-5">
                <div className="flex items-end justify-between gap-4">
                  <div className="flex flex-col">
                    <span className={cn("display figure text-[2.5rem] leading-none", Number.isFinite(view.r.months) && view.r.months < 4 ? "text-blood-ink" : "text-text")}>
                      {Number.isFinite(view.r.months) ? view.r.months.toLocaleString("he-IL", { maximumFractionDigits: 1 }) : "∞"}
                    </span>
                    <span className="text-sm text-text-muted">{Number.isFinite(view.r.months) ? "חודשים בקצב של 30 הימים האחרונים" : "ההכנסה מכסה את ההוצאות"}</span>
                  </div>
                  <div className="flex flex-col text-end">
                    <span className="figure text-lg">{Number.isFinite(view.r.monthsNoIncome) ? view.r.monthsNoIncome.toLocaleString("he-IL", { maximumFractionDigits: 1 }) : "—"}</span>
                    <span className="text-xs text-text-subtle">בלי הכנסה בכלל</span>
                  </div>
                </div>
                <div className="hairline" />
                <dl className="grid grid-cols-2 gap-y-3 text-sm">
                  <dt className="text-text-muted">הוצאות בחודש</dt>
                  <dd className="figure text-end">{shekel(view.r.costs)}</dd>
                  <dt className="text-text-muted">הכנסה ב-30 יום</dt>
                  <dd className="figure text-end">{shekel(view.r.monthlyIncome)}</dd>
                  <dt className="text-text-muted">תספורות לכיסוי ההוצאות</dt>
                  <dd className="figure text-end text-accent-ink">{view.r.cutsToBreakEven} בחודש</dd>
                </dl>
              </div>
            )}
          </Section>

          <Section title="8 שבועות">
            <div className="glass rounded-xl p-5">
              <BarChart
                label="הכנסה לפי שבוע"
                bars={view.weeks.map((w, i) => ({ label: `${Number(w.start.slice(8, 10))}/${Number(w.start.slice(5, 7))}`, value: w.income, highlight: i === view.weeks.length - 1 }))}
              />
            </div>
          </Section>

          <Section title="תספורות אחרונות">
            {cuts && cuts.length === 0 ? (
              <EmptyState
                icon={<Scissors aria-hidden className="size-6" />}
                title="עוד אין תספורות ברישום"
                body="כל לקוח שיוצא מהכיסא נרשם כאן: מחיר, חדש או חוזר, ואם קבע תור. מזה בונים עסק."
                action={<Button onClick={() => router.push("/business/log")}>תספורת ראשונה</Button>}
              />
            ) : (
              <ul className="glass divide-y divide-border overflow-hidden rounded-xl">
                {cuts!.slice(0, 12).map((c) => (
                  <li key={c.id}>
                    <Link href={`/business/log?id=${c.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent-soft/30">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">
                          {c.client || "לקוח"}
                          {c.isNew && <span className="ms-2 rounded-pill bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-semibold text-accent-ink">חדש</span>}
                        </span>
                        <span className="text-xs text-text-subtle">
                          {formatRelativeDay(c.at)} · {SERVICE[c.service]}
                          {c.rebooked && " · קבע תור"}
                        </span>
                      </span>
                      <span className="figure">{shekel(c.price + c.tip)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {view.people.length > 0 && (
            <Section title={`לקוחות (${view.people.length})`}>
              <ul className="glass divide-y divide-border overflow-hidden rounded-xl">
                {view.people.slice(0, 10).map((p) => {
                  const days = Math.round((Date.parse(today) - Date.parse(p.last)) / 86_400_000);
                  return (
                    <li key={p.name} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{p.name}</span>
                        <span className={cn("text-xs", days > 30 ? "text-blood-ink" : "text-text-subtle")}>
                          {p.visits} ביקורים · {days === 0 ? "היום" : `לפני ${days} ימים`}
                          {days > 30 && " · כדאי להזכיר לו"}
                        </span>
                      </span>
                      <span className="figure text-sm text-text-muted">{shekel(p.spent)}</span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          <Fab label="רישום תספורת" onClick={() => router.push("/business/log")}>
            <Plus aria-hidden className="size-7" />
          </Fab>
        </>
      )}
    </AppShell>
  );
}
