"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Minus, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Panel, Skeleton, Stat } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { LineChart } from "@/components/progress/charts";
import { deleteBodyweight, listBodyweight, logBodyweight } from "@/data/body-repo";
import { useProfile } from "@/hooks/use-data";
import { formatNumber, formatRelativeDay, fromDisplayWeight, toDisplayWeight, unitLabel } from "@/lib/format";
import { addDays, localDateKey } from "@/lib/nutrition";

const shortDate = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric" });

/** S23: weigh-ins and the trend. The 7-day average matters more than any single morning. */
export default function BodyPage() {
  const toast = useToast();
  const profile = useProfile();
  const units = profile?.units ?? "kg";
  const rows = useLiveQuery(() => listBodyweight(), []);
  const [draft, setDraft] = useState<number | null>(null);

  if (!rows || !profile) {
    return (
      <AppShell tab="progress" title="משקל" back={{ href: "/progress", label: "התקדמות" }}>
        <Skeleton className="h-60 rounded-xl" />
      </AppShell>
    );
  }

  const last = rows.at(-1);
  const step = units === "kg" ? 0.1 : 0.2;
  const shown = draft ?? Number(toDisplayWeight(last?.weightKg ?? profile.bodyweightKg ?? 75, units).toFixed(1));
  const today = localDateKey();
  const weekAgo = addDays(today, -7);
  const recent = rows.filter((r) => r.date > weekAgo);
  const avg7 = recent.length ? recent.reduce((n, r) => n + r.weightKg, 0) / recent.length : null;
  const first = rows[0];

  return (
    <AppShell tab="progress" title="משקל" subtitle="שקילה פעם ביום, בבוקר, נותנת את המגמה הכי נקייה" back={{ href: "/progress", label: "התקדמות" }}>
      <Panel className="flex flex-col items-center gap-5 rounded-xl py-7">
        <span className="text-sm text-text-muted">{last?.date === today ? "השקילה של היום" : "שקילה להיום"}</span>
        <div className="flex items-center gap-5" role="group" aria-label={`משקל ב${unitLabel(units)}`}>
          <button type="button" aria-label="פחות" onClick={() => setDraft(Math.round((shown - step) * 10) / 10)} className="well flex size-14 items-center justify-center rounded-pill">
            <Minus aria-hidden className="size-6" />
          </button>
          <label className="flex items-baseline gap-1.5">
            <span className="sr-only">משקל</span>
            <input
              type="number"
              inputMode="decimal"
              step={step}
              value={shown}
              onChange={(e) => setDraft(Number(e.target.value) || 0)}
              className="figure w-36 bg-transparent text-center text-[3.25rem] leading-none outline-none"
            />
            <span className="text-text-muted">{unitLabel(units)}</span>
          </label>
          <button type="button" aria-label="יותר" onClick={() => setDraft(Math.round((shown + step) * 10) / 10)} className="well flex size-14 items-center justify-center rounded-pill">
            <Plus aria-hidden className="size-6" />
          </button>
        </div>
        <Button
          size="lg"
          className="w-full max-w-xs"
          disabled={!(shown > 20)}
          onClick={async () => {
            await logBodyweight(Math.round(fromDisplayWeight(shown, units) * 100) / 100);
            setDraft(null);
            toast({ tone: "success", message: "השקילה נשמרה" });
          }}
        >
          שמירה
        </Button>
      </Panel>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="אחרון" value={formatNumber(toDisplayWeight(last!.weightKg, units), 1)} unit={unitLabel(units)} />
            <Stat label="ממוצע 7 ימים" value={avg7 ? formatNumber(toDisplayWeight(avg7, units), 1) : "—"} unit={avg7 ? unitLabel(units) : undefined} />
            <Stat
              label="מההתחלה"
              value={
                <bdi dir="ltr">
                  {last!.weightKg - first.weightKg >= 0 ? "+" : "−"}
                  {formatNumber(Math.abs(toDisplayWeight(last!.weightKg - first.weightKg, units)), 1)}
                </bdi>
              }
              unit={unitLabel(units)}
            />
          </div>
          <Panel className="flex flex-col gap-3">
            <h2 className="text-lg">מגמה</h2>
            <LineChart
              label="משקל גוף"
              unit={unitLabel(units)}
              points={rows.slice(-60).map((r) => ({ x: new Date(r.date).getTime(), y: Math.round(toDisplayWeight(r.weightKg, units) * 10) / 10, label: shortDate.format(new Date(`${r.date}T12:00:00`)) }))}
            />
          </Panel>
          <ul className="glass flex flex-col rounded-lg" aria-label="שקילות">
            {[...rows].reverse().slice(0, 30).map((r, i) => (
              <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
                <span className="flex-1 text-sm text-text-muted">{formatRelativeDay(`${r.date}T12:00:00`)}</span>
                <span className="figure">
                  {formatNumber(toDisplayWeight(r.weightKg, units), 1)} <span className="text-xs font-normal text-text-subtle">{unitLabel(units)}</span>
                </span>
                <button type="button" aria-label="מחיקת השקילה" onClick={() => void deleteBodyweight(r.id)} className="flex size-9 items-center justify-center rounded-pill text-text-subtle hover:text-danger">
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
