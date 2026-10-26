"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Minus, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { FilterChip, TextField } from "@/components/ui/field";
import { Panel, Skeleton, Stat } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { CARDIO_LABEL, deleteCardio, estimateCardioKcal, listCardio, logCardio } from "@/data/coach-repo";
import { bodyweightOn } from "@/data/body-repo";
import type { CardioKind } from "@/data/types";
import { formatNumber, formatRelativeDay } from "@/lib/format";
import { localDateKey } from "@/lib/nutrition";

const KINDS: CardioKind[] = ["walk", "run", "bike", "row", "elliptical", "swim", "hiit", "other"];

/** S25: cardio, logged in seconds. Calories are an estimate from effort, bodyweight and time. */
export default function CardioPage() {
  const toast = useToast();
  const [kind, setKind] = useState<CardioKind>("walk");
  const [minutes, setMinutes] = useState(30);
  const [distance, setDistance] = useState("");
  const data = useLiveQuery(async () => ({ rows: await listCardio(), bw: (await bodyweightOn(localDateKey())) ?? 75 }), []);

  if (!data) {
    return (
      <AppShell tab="progress" title="קרדיו" back={{ href: "/progress", label: "התקדמות" }}>
        <Skeleton className="h-72 rounded-xl" />
      </AppShell>
    );
  }
  const kcal = estimateCardioKcal(kind, minutes, data.bw);
  const weekAgo = localDateKey(new Date(new Date().setDate(new Date().getDate() - 6)));
  const week = data.rows.filter((r) => r.date >= weekAgo);

  return (
    <AppShell tab="progress" title="קרדיו" back={{ href: "/progress", label: "התקדמות" }}>
      <Panel className="flex flex-col gap-5 rounded-xl">
        <div className="flex flex-wrap gap-2" role="group" aria-label="סוג">
          {KINDS.map((k) => (
            <FilterChip key={k} selected={kind === k} onToggle={() => setKind(k)}>
              {CARDIO_LABEL[k]}
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center justify-center gap-5" role="group" aria-label="דקות">
          <button type="button" aria-label="פחות 5 דקות" onClick={() => setMinutes((m) => Math.max(5, m - 5))} className="well flex size-12 items-center justify-center rounded-pill">
            <Minus aria-hidden className="size-5" />
          </button>
          <div className="flex flex-col items-center">
            <span className="figure text-[3rem] leading-none">{minutes}</span>
            <span className="text-sm text-text-muted">דקות</span>
          </div>
          <button type="button" aria-label="עוד 5 דקות" onClick={() => setMinutes((m) => Math.min(300, m + 5))} className="well flex size-12 items-center justify-center rounded-pill">
            <Plus aria-hidden className="size-5" />
          </button>
        </div>
        <TextField label="מרחק (לא חובה)" inputMode="decimal" suffix="ק״מ" value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^\d.,]/g, ""))} />
        <p className="text-center text-sm text-text-muted">
          כ-<span className="figure text-text">{formatNumber(kcal, 0)}</span> קלוריות, לפי משקל גוף של {formatNumber(data.bw, 1)} ק״ג
        </p>
        <Button
          size="lg"
          fullWidth
          onClick={async () => {
            await logCardio({ kind, minutes, distanceKm: distance ? Number(distance.replace(",", ".")) : null });
            setDistance("");
            toast({ tone: "success", message: `${CARDIO_LABEL[kind]} נשמרה` });
          }}
        >
          שמירה
        </Button>
      </Panel>

      {data.rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="ב-7 ימים" value={week.length} hint="פעמים" />
            <Stat label="דקות" value={formatNumber(week.reduce((n, r) => n + r.minutes, 0), 0)} hint="ב-7 ימים" />
            <Stat label="קלוריות" value={formatNumber(week.reduce((n, r) => n + r.kcal, 0), 0)} hint="משוער" />
          </div>
          <ul className="glass flex flex-col rounded-lg" aria-label="פעילויות">
            {data.rows.slice(0, 30).map((r, i) => (
              <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-border" : ""}`}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{CARDIO_LABEL[r.kind]}</span>
                  <span className="text-sm text-text-subtle">
                    {formatRelativeDay(`${r.date}T12:00:00`)}, {r.minutes} דק׳{r.distanceKm ? `, ${formatNumber(r.distanceKm, 1)} ק״מ` : ""}
                  </span>
                </span>
                <span className="figure">{formatNumber(r.kcal, 0)}</span>
                <button type="button" aria-label="מחיקה" onClick={() => void deleteCardio(r.id)} className="flex size-9 items-center justify-center rounded-pill text-text-subtle hover:text-danger">
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
