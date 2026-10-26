"use client";

import { useState } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

/**
 * Docked keypad for the logger. Digits stay in phone order (left to right) even in RTL.
 * `value` is the raw string being typed, so "82." survives while the user is mid-number.
 * The first digit replaces the shown value; remount (change `key`) when the field changes.
 */
export function NumericKeypad({
  label,
  value,
  onChange,
  step,
  allowDecimal,
  onNext,
  onDone,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
  allowDecimal: boolean;
  onNext: () => void;
  onDone: () => void;
}) {
  const [fresh, setFresh] = useState(true);

  const press = (key: string) => {
    const wasFresh = fresh;
    setFresh(false);
    if (key === "back") return onChange(wasFresh ? "" : value.slice(0, -1));
    if (key === ".") {
      if (!allowDecimal || (!wasFresh && value.includes("."))) return;
      return onChange(value === "" || wasFresh ? "0." : `${value}.`);
    }
    const next = wasFresh || value === "0" ? key : value + key;
    // Keep inputs sane: up to 4 digits before the point, 2 after.
    if (!/^\d{0,4}(\.\d{0,2})?$/.test(next)) return;
    onChange(next);
  };

  const bump = (delta: number) => {
    setFresh(false);
    const current = Number(value || 0);
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);
    onChange(String(next));
  };

  const key = "figure glass flex h-13 items-center justify-center rounded-md text-2xl text-text active:brightness-125";
  const fn = "glass flex h-13 items-center justify-center rounded-md text-base font-medium text-text-muted active:brightness-125";
  const stepLabel = formatNumber(step);

  return (
    <div
      role="group"
      aria-label={`מקלדת: ${label}`}
      className="glass-raised mx-2 mb-2 rounded-xl px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="ps-1 text-sm text-text-muted">{label}</span>
        <button type="button" onClick={onDone} className="h-9 px-2 text-sm font-semibold text-accent">
          סיום
        </button>
      </div>
      <div dir="ltr" className="grid grid-cols-4 gap-2">
        {["1", "2", "3"].map((k) => (
          <button key={k} type="button" className={key} onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button type="button" className={fn} onClick={() => bump(-step)} aria-label={`הפחתה של ${stepLabel}`}>
          −{stepLabel}
        </button>
        {["4", "5", "6"].map((k) => (
          <button key={k} type="button" className={key} onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button type="button" className={fn} onClick={() => bump(step)} aria-label={`הוספה של ${stepLabel}`}>
          +{stepLabel}
        </button>
        {["7", "8", "9"].map((k) => (
          <button key={k} type="button" className={key} onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button type="button" className={fn} onClick={() => press("back")} aria-label="מחיקה">
          <Delete aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          className={cn(key, !allowDecimal && "invisible")}
          onClick={() => press(".")}
          aria-label="נקודה עשרונית"
          tabIndex={allowDecimal ? 0 : -1}
        >
          .
        </button>
        <button type="button" className={key} onClick={() => press("0")}>
          0
        </button>
        <button
          type="button"
          onClick={onNext}
          className="col-span-2 flex h-13 items-center justify-center rounded-md bg-accent text-lg font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] active:bg-accent-hover"
        >
          הבא
        </button>
      </div>
    </div>
  );
}
