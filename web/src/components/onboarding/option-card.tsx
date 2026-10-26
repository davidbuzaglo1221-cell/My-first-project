import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A large choice for onboarding questions. Use inside role="radiogroup" (single)
 * or role="group" with multiple (checkbox semantics).
 */
export function OptionCard({
  selected,
  onSelect,
  title,
  body,
  icon,
  multiple = false,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  body?: string;
  icon?: ReactNode;
  multiple?: boolean;
}) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border-2 p-4 text-start transition-colors duration-(--motion-fast)",
        selected ? "border-accent bg-accent-soft" : "border-border bg-bg hover:bg-surface",
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-md",
            selected ? "bg-accent text-on-accent" : "bg-surface-2 text-text",
          )}
        >
          {icon}
        </span>
      )}
      <span className="flex flex-1 flex-col">
        <span className="font-semibold">{title}</span>
        {body && <span className="text-sm text-text-muted">{body}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center border-2",
          multiple ? "rounded-sm" : "rounded-pill",
          selected ? "border-accent bg-accent text-on-accent" : "border-border-input",
        )}
      >
        {selected && <Check className="size-4" strokeWidth={3} />}
      </span>
    </button>
  );
}

/** "שאלה 3 מתוך 9" with a bar. The bar fills from the start side (right in RTL). */
export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="num text-xs font-medium text-text-muted">
        שאלה {step} מתוך {total}
      </span>
      <div
        role="progressbar"
        aria-label="התקדמות בשאלון"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        className="h-1.5 overflow-hidden rounded-pill bg-surface-2"
      >
        <div className="h-full rounded-pill bg-accent transition-[width] duration-(--motion-base)" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  );
}
