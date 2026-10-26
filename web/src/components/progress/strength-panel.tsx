"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";
import { Panel, Skeleton } from "@/components/ui/surface";
import { getStrengthReport } from "@/data/body-repo";
import { GROUP_LABEL, type ScoreGroup } from "@/lib/strength";
import { formatWeight, unitLabel, type Units } from "@/lib/format";
import { cn } from "@/lib/cn";

const LEVEL_LABEL = { beginner: "מתחיל", intermediate: "בינוני", advanced: "מתקדם", expert: "מומחה", elite: "עילית" } as const;
const GROUPS: ScoreGroup[] = ["legs", "back", "chest", "shoulders", "arms"];

/** S18/S19: the score, its five parts, and why it moved this week, in words. */
export function StrengthPanel({ units }: { units: Units }) {
  const fmt = (kg: number) => `${formatWeight(kg, units)} ${unitLabel(units)}`;
  const report = useLiveQuery(() => getStrengthReport(fmt), [units]);

  if (report === undefined) return <Skeleton className="h-64 rounded-xl" />;

  if (report === "no_bodyweight" || report === null) {
    return (
      <Panel className="flex flex-col gap-3 rounded-xl">
        <h2 className="text-lg">ציון כוח</h2>
        <p className="text-sm text-text-muted">
          {report === "no_bodyweight"
            ? "הציון משווה את הכוח שלך למשקל הגוף, אז צריך שקילה אחת כדי לחשב."
            : "הציון מחושב מתרגילים מרכזיים: סקוואט, דדליפט, לחיצת חזה, לחיצת כתפיים, חתירה, מתח ועוד. אחרי אימון עם אחד מהם הוא יופיע כאן."}
        </p>
        {report === "no_bodyweight" && (
          <Link href="/body" className="font-semibold">
            לשקילה
          </Link>
        )}
      </Panel>
    );
  }

  const { now, change } = report;
  return (
    <Panel className="flex flex-col gap-5 rounded-xl">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">ציון כוח</h2>
          <span className="text-sm font-medium text-pr">{LEVEL_LABEL[now.level]}</span>
        </div>
        <div className="flex items-baseline gap-2">
          {change.delta !== 0 && (
            <span className={cn("num text-sm font-semibold", change.delta > 0 ? "text-success" : "text-danger")}>
              <bdi dir="ltr">{change.delta > 0 ? `+${change.delta}` : change.delta}</bdi>
            </span>
          )}
          <span className="figure text-[3.5rem] leading-none">{now.total}</span>
        </div>
      </div>

      <ul className="flex flex-col gap-3" aria-label="לפי קבוצת שריר">
        {GROUPS.map((g) => {
          const s = now.groups[g];
          return (
            <li key={g} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{GROUP_LABEL[g]}</span>
                <span className="text-text-subtle">
                  {s ? (
                    <>
                      {s.lift}, <bdi dir="ltr">{formatWeight(s.weightKg, units)} × {s.reps}</bdi>
                      <span className="figure ms-2 text-text">{s.score}</span>
                    </>
                  ) : (
                    "אין נתונים ב-6 שבועות"
                  )}
                </span>
              </div>
              <div
                className="well h-1.5 overflow-hidden rounded-pill"
                role="progressbar"
                aria-label={GROUP_LABEL[g]}
                aria-valuemin={0}
                aria-valuemax={600}
                aria-valuenow={s?.score ?? 0}
              >
                <div className="h-full rounded-pill bg-accent" style={{ width: `${((s?.score ?? 0) / 600) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="well flex flex-col gap-1.5 rounded-md px-4 py-3">
        <span className="text-sm font-semibold">מה השתנה השבוע</span>
        <ul className="flex flex-col gap-1 text-sm text-text-muted">
          {change.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <details className="text-sm text-text-muted">
        <summary className="cursor-pointer font-medium text-text">איך מחושב הציון</summary>
        <p className="mt-2 leading-relaxed">
          לכל תרגיל מרכזי לוקחים את ה-1RM המשוער הטוב ביותר ב-6 השבועות האחרונים, ומחלקים במשקל הגוף. 300 נקודות הן רמה בינונית לתרגיל, עד 600. כל קבוצת שריר מקבלת את
          התרגיל הכי חזק שלה, והציון הכולל הוא ממוצע משוקלל (רגליים וגב שוקלים יותר). קבוצה בלי נתונים לא מורידה את הציון. בגלל החלון של 6 שבועות, אימון חלש אחד לא מוריד
          אותו.
          {!report.sexKnown && " כרגע מחושב לפי סטנדרט גברים; אפשר לעדכן ביעדי התזונה."}
        </p>
      </details>

      <Link href="/body" className="flex items-center justify-between text-sm text-text-muted">
        <span>
          משקל הגוף בחישוב: {formatWeight(report.bodyweightKg, units)} {unitLabel(units)}
        </span>
        <ChevronLeft aria-hidden className="size-4" />
      </Link>
    </Panel>
  );
}
