"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Barcode, Camera, ChevronLeft, Plus, Search, Zap } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Panel, Skeleton } from "@/components/ui/surface";
import { CalorieArc, MacroTrio, WeekStrip } from "@/components/nutrition/visuals";
import { EntrySheet } from "@/components/nutrition/sheets";
import { getDayLog, getPhoto, getWeekMarks } from "@/data/nutrition-repo";
import { MEALS, MEAL_LABEL, type FoodLog } from "@/data/types";
import { useProfile } from "@/hooks/use-data";
import { addDays, localDateKey } from "@/lib/nutrition";
import { formatFullDate, formatNumber, startOfWeek } from "@/lib/format";

function Thumb({ photoId }: { photoId: string }) {
  const src = useLiveQuery(() => getPhoto(photoId), [photoId]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- local data URL
    <img src={src} alt="" className="size-12 shrink-0 rounded-md object-cover" />
  ) : (
    <span className="well size-12 shrink-0 rounded-md" />
  );
}

function Today() {
  const router = useRouter();
  const params = useSearchParams();
  const profile = useProfile();
  const today = localDateKey();
  const date = params.get("date") ?? today;
  const weekStart = profile ? localDateKey(startOfWeek(new Date(`${date}T12:00:00`), profile.weekStartsOn)) : null;
  const [editing, setEditing] = useState<FoodLog | null>(null);

  const day = useLiveQuery(() => getDayLog(date), [date]);
  const marks = useLiveQuery(async () => (weekStart ? getWeekMarks(weekStart) : null), [weekStart]);

  const go = (d: string) => router.replace(d === today ? "/nutrition" : `/nutrition?date=${d}`, { scroll: false });
  const addHref = (path: string, meal?: string) => `/nutrition/${path}?date=${date}${meal ? `&meal=${meal}` : ""}`;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => weekStart && go(addDays(weekStart, -7))} className="text-sm text-text-muted hover:text-text">
          שבוע קודם
        </button>
        <span className="text-sm font-medium">{date === today ? "היום" : formatFullDate(`${date}T12:00:00`)}</span>
        <button
          type="button"
          disabled={!weekStart || addDays(weekStart, 7) > today}
          onClick={() => weekStart && go(addDays(weekStart, 7))}
          className="text-sm text-text-muted hover:text-text disabled:invisible"
        >
          שבוע הבא
        </button>
      </div>
      {marks ? <WeekStrip days={marks} selected={date} today={today} onSelect={go} /> : <Skeleton className="h-16 rounded-pill" />}

      {!day ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : (
        <Panel className="flex flex-col gap-6 rounded-xl px-5 pt-6 pb-6">
          <CalorieArc value={day.totals.kcal} target={day.targets.calories} />
          <MacroTrio
            values={{ protein: day.totals.protein, carbs: day.totals.carbs, fat: day.totals.fat }}
            targets={{ protein: day.targets.protein, carbs: day.targets.carbs, fat: day.targets.fat }}
          />
          <p className="num -mt-2 text-sm text-text-subtle">
            סיבים: <span className="font-semibold text-text">{formatNumber(day.totals.fiber ?? 0, 0)}</span>/{formatNumber(day.targets.fiber, 0)} ג׳
            {day.entries.some((e) => e.fiber == null) && " (לא לכל הפריטים יש נתון)"}
          </p>
          {day.targets.isDefault && (
            <Link href="/nutrition/goals" className="well flex items-center gap-2 rounded-md px-4 py-3 text-sm">
              <span className="flex-1">היעדים כרגע כלליים. כדאי לחשב יעדים אישיים לפי הגוף והמטרה שלך.</span>
              <ChevronLeft aria-hidden className="size-4 shrink-0 text-text-subtle" />
            </Link>
          )}
        </Panel>
      )}

      <nav aria-label="הוספת אוכל" className="grid grid-cols-4 gap-2">
        {[
          { href: addHref("photo"), label: "צילום", Icon: Camera },
          { href: addHref("add"), label: "חיפוש", Icon: Search },
          { href: addHref("barcode"), label: "ברקוד", Icon: Barcode },
          { href: `${addHref("add")}&tab=quick`, label: "מהיר", Icon: Zap },
        ].map(({ href, label, Icon }) => (
          <Link key={label} href={href} className="glass flex flex-col items-center gap-2 rounded-lg py-3.5 text-sm font-medium">
            <Icon aria-hidden className="size-5" />
            {label}
          </Link>
        ))}
      </nav>

      {day &&
        MEALS.map((meal) => {
          const items = day.byMeal[meal];
          const kcal = items.reduce((n, e) => n + e.kcal, 0);
          return (
            <section key={meal} aria-labelledby={`meal-${meal}`} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 id={`meal-${meal}`} className="text-lg">
                  {MEAL_LABEL[meal]}
                </h2>
                <span className="num text-sm text-text-muted">{kcal ? `${formatNumber(kcal, 0)} קלוריות` : ""}</span>
              </div>
              <div className="glass flex flex-col rounded-lg">
                {items.map((e, i) => (
                  <div key={e.id}>
                    {i > 0 && <span aria-hidden className="mx-4 block h-px bg-border" />}
                    <button type="button" onClick={() => setEditing(e)} className="flex w-full items-center gap-3 px-4 py-3 text-start">
                      {e.photoId && <Thumb photoId={e.photoId} />}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{e.nameHe}</span>
                        <span className="num text-sm text-text-subtle">
                          {e.grams ? `${formatNumber(e.grams, 0)} גרם` : "הוספה מהירה"}
                          {e.source === "photo" && e.confidence === "low" && <span className="text-warning">, כדאי לבדוק</span>}
                        </span>
                      </span>
                      <span className="num shrink-0 text-end">
                        <span className="block font-semibold">{formatNumber(e.kcal, 0)}</span>
                        <span className="block text-xs text-text-subtle">
                          <bdi dir="ltr">
                            {formatNumber(e.protein, 0)}/{formatNumber(e.carbs, 0)}/{formatNumber(e.fat, 0)}
                          </bdi>
                        </span>
                      </span>
                    </button>
                  </div>
                ))}
                {items.length > 0 && <span aria-hidden className="mx-4 block h-px bg-border" />}
                <Link href={addHref("add", meal)} className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-text-muted hover:text-text">
                  <Plus aria-hidden className="size-4" />
                  הוספה ל{MEAL_LABEL[meal]}
                </Link>
              </div>
            </section>
          );
        })}

      {day && (
        <p className="px-1 text-xs text-text-subtle">
          המספרים מתחת לכל פריט: חלבון/פחמימות/שומן בגרם. ערכים מתמונה ומהמאגר הם הערכה.
        </p>
      )}

      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
    </>
  );
}

export default function NutritionPage() {
  return (
    <AppShell tab="nutrition" title="תזונה" action={<Link href="/nutrition/goals" className="pb-1 text-sm font-medium text-text-muted hover:text-text">יעדים</Link>}>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Today />
      </Suspense>
    </AppShell>
  );
}
