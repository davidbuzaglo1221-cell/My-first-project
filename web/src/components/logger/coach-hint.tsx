"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import type { Suggestion } from "@/lib/coach";
import { formatWeight, unitLabel, type Units } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Today's target for an exercise, with the reasoning one tap away. Teaches double progression
 * by showing it, every session, on the user's own numbers.
 */
export function CoachHint({ suggestion, units, onApply, applied }: { suggestion: Suggestion; units: Units; onApply: () => void; applied: boolean }) {
  const [open, setOpen] = useState(false);
  // In words ("100 ק\"ג, 6 חזרות"): a Hebrew unit inside an LTR "100 × 6" run scrambles the order.
  const target =
    suggestion.weightKg != null ? (
      <>
        <bdi dir="ltr">{formatWeight(suggestion.weightKg, units)}</bdi> {unitLabel(units)}, {suggestion.reps} חזרות
      </>
    ) : (
      `${suggestion.reps} חזרות`
    );
  return (
    <div className={cn("mb-3 rounded-md px-3.5 py-3", suggestion.kind === "add_weight" ? "bg-success-soft" : "well")}>
      <div className="flex items-center gap-2.5">
        <TrendingUp aria-hidden className={cn("size-4 shrink-0", suggestion.kind === "add_weight" ? "text-success" : "text-text-muted")} />
        <span className="flex-1 text-sm">
          {suggestion.kind === "add_weight" ? "היום מעלים משקל: " : "יעד היום: "}
          <span className="font-semibold">{target}</span>
        </span>
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="text-sm font-medium text-text-muted hover:text-text">
          למה?
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={applied}
          className="h-8 rounded-pill bg-accent px-3 text-xs font-semibold text-on-accent disabled:bg-transparent disabled:text-success"
        >
          {applied ? "הוחל" : "להחיל"}
        </button>
      </div>
      {open && <p className="mt-2 text-sm leading-relaxed text-text-muted">{suggestion.why}</p>}
    </div>
  );
}
