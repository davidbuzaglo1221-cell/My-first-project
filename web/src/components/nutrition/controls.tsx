"use client";

import { Minus, Plus } from "lucide-react";
import { Segmented } from "@/components/ui/field";
import { MEALS, MEAL_LABEL, type Meal } from "@/data/types";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

const MEAL_SHORT: Record<Meal, string> = { breakfast: "בוקר", lunch: "צהריים", dinner: "ערב", snack: "נשנוש" };

export function MealPicker({ value, onChange }: { value: Meal; onChange: (m: Meal) => void }) {
  return <Segmented label="ארוחה" value={value} onChange={onChange} fullWidth options={MEALS.map((m) => ({ value: m, label: MEAL_SHORT[m] }))} />;
}

export { MEAL_LABEL };

/** Grams with − / + buttons and a typed value. Steps by 10 g (5 under 50 g). */
export function GramsStepper({ value, onChange, label = "כמות בגרם" }: { value: number; onChange: (g: number) => void; label?: string }) {
  const step = value < 50 ? 5 : 10;
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`פחות ${step} גרם`}
        onClick={() => onChange(Math.max(1, value - step))}
        className="well flex size-12 items-center justify-center rounded-pill text-text"
      >
        <Minus aria-hidden className="size-5" />
      </button>
      <label className="well flex h-12 flex-1 items-center justify-center gap-1 rounded-md px-3">
        <span className="sr-only">{label}</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={5000}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(Math.max(0, Math.min(5000, Number(e.target.value) || 0)))}
          className="figure w-20 bg-transparent text-center text-2xl outline-none"
        />
        <span className="text-sm text-text-muted">גרם</span>
      </label>
      <button
        type="button"
        aria-label={`עוד ${step} גרם`}
        onClick={() => onChange(Math.min(5000, value + step))}
        className="well flex size-12 items-center justify-center rounded-pill text-text"
      >
        <Plus aria-hidden className="size-5" />
      </button>
    </div>
  );
}

/** kcal and the three macros in one compact line. */
export function MacroLine({ kcal, protein, carbs, fat, className }: { kcal: number; protein: number; carbs: number; fat: number; className?: string }) {
  return (
    <span className={cn("num flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm text-text-muted", className)}>
      <span>
        <span className="font-semibold text-text">{formatNumber(kcal, 0)}</span> קלוריות
      </span>
      <span>
        <span className="text-macro-protein">ח׳</span> {formatNumber(protein, 0)}
      </span>
      <span>
        <span className="text-macro-carbs">פ׳</span> {formatNumber(carbs, 0)}
      </span>
      <span>
        <span className="text-macro-fat">ש׳</span> {formatNumber(fat, 0)}
      </span>
    </span>
  );
}
