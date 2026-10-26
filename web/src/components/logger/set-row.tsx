"use client";

import { useEffect, useRef } from "react";
import { Check, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatWeight, type Units } from "@/lib/format";

export type SetKind = "warmup" | "work" | "drop" | "failure";
export type SetField = "weight" | "reps";

export type SetValues = { weightKg: number | null; reps: number | null };

const kindBadge: Record<SetKind, { short: string; name: string; className: string }> = {
  warmup: { short: "ח", name: "חימום", className: "text-warning" },
  work: { short: "", name: "סט עבודה", className: "text-text-muted" },
  drop: { short: "י", name: "סט ירידה", className: "text-accent" },
  failure: { short: "כ", name: "עד כשל", className: "text-danger" },
};

export const SET_GRID = "grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_4rem_3rem] items-center gap-2";

/** Column headings, rendered once above the rows of an exercise. */
export function SetHeader({ units }: { units: Units }) {
  return (
    <div className={cn(SET_GRID, "px-1 pb-1.5 text-xs text-text-subtle")} aria-hidden>
      <span className="text-center">סט</span>
      <span>פעם קודמת</span>
      <span className="text-center">{units === "kg" ? 'ק"ג' : "ליב'"}</span>
      <span className="text-center">חזרות</span>
      <span />
    </div>
  );
}

/**
 * One set. Weight and reps open the custom keypad instead of the system keyboard
 * (the Hebrew system keyboard switches language to type digits).
 * Tapping ✓ on an empty row copies the previous performance: the one-tap set.
 */
export function SetRow({
  number,
  kind,
  previous,
  values,
  done,
  isPr,
  units,
  activeField,
  onFieldFocus,
  onToggleDone,
  onCycleKind,
}: {
  number: number;
  kind: SetKind;
  previous?: SetValues | null;
  values: SetValues;
  done: boolean;
  isPr?: boolean;
  units: Units;
  activeField?: SetField | null;
  onFieldFocus: (field: SetField) => void;
  onToggleDone: () => void;
  onCycleKind: () => void;
}) {
  const badge = kindBadge[kind];
  const rowRef = useRef<HTMLDivElement>(null);
  // Warmups are not counted, so they get a name instead of a number.
  const setName = kind === "warmup" ? "סט חימום" : `סט ${number}`;

  // The keypad docks over the bottom of the screen; keep the row being edited above it.
  useEffect(() => {
    if (activeField) rowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeField]);

  const prevText =
    previous && previous.weightKg != null && previous.reps != null
      ? `${formatWeight(previous.weightKg, units)} × ${previous.reps}`
      : "—";

  const cell = (field: SetField, value: number | null, placeholder: number | null | undefined, label: string) => {
    const shown = value != null ? (field === "weight" ? formatWeight(value, units) : String(value)) : null;
    const hint =
      placeholder != null ? (field === "weight" ? formatWeight(placeholder, units) : String(placeholder)) : "";
    return (
      <button
        type="button"
        aria-label={`${label}, ${setName}: ${shown ?? (hint ? `ריק, בפעם הקודמת ${hint}` : "ריק")}`}
        aria-pressed={activeField === field}
        onClick={() => onFieldFocus(field)}
        className={cn(
          "figure h-(--layout-touch-logger) rounded-sm text-center text-[1.35rem] transition-[background-color,box-shadow,color] duration-(--motion-fast)",
          activeField === field ? "glass-raised outline-2 outline-offset-1 outline-focus" : done ? "bg-transparent" : "well",
          shown == null ? "text-text-subtle" : "text-text",
        )}
      >
        {shown ?? (hint || "—")}
      </button>
    );
  };

  return (
    <div
      ref={rowRef}
      className={cn(
        SET_GRID,
        "rounded-md px-1 py-1 transition-colors duration-(--motion-base)",
        done && "bg-success-soft/70",
      )}
    >
      <button
        type="button"
        onClick={onCycleKind}
        aria-label={`${setName}, ${badge.name}. לשינוי סוג הסט`}
        className={cn("figure mx-auto flex size-9 items-center justify-center rounded-pill text-lg", badge.className)}
      >
        {badge.short || number}
      </button>

      <span className="num truncate text-sm text-text-subtle">
        <bdi dir="ltr">{prevText}</bdi>
      </span>

      {cell("weight", values.weightKg, previous?.weightKg, "משקל")}
      {cell("reps", values.reps, previous?.reps, "חזרות")}

      <div className="relative flex justify-center">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `${setName} הושלם. לביטול` : `סימון ${setName} כהושלם`}
          onClick={onToggleDone}
          className={cn(
            "flex size-11 items-center justify-center rounded-pill transition-[background-color,box-shadow,color,transform] duration-(--motion-fast) active:scale-95",
            done
              ? "bg-success text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_18px_-10px_var(--c-success)]"
              : "well text-text-subtle/50 hover:text-text-muted",
          )}
        >
          <Check aria-hidden className={cn("size-5", done && "animate-[pr-pop_var(--motion-base)_var(--ease-out)]")} strokeWidth={2.75} />
        </button>
        {isPr && done && (
          <span
            aria-label="שיא אישי חדש"
            role="img"
            className="glass-raised absolute -top-2 -end-1.5 flex size-6 items-center justify-center rounded-pill text-pr animate-[pr-pop_var(--motion-slow)_var(--ease-out)]"
          >
            <Trophy aria-hidden className="size-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}

export const SET_KINDS: SetKind[] = ["work", "warmup", "drop", "failure"];
