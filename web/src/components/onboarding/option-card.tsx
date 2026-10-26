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
        "glass flex w-full items-center gap-4 rounded-lg p-4 text-start transition-[box-shadow,background-color] duration-(--motion-fast)",
        selected && "bg-accent-soft/70 outline-1 outline-accent/70",
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-(--motion-fast)",
            selected ? "bg-accent text-on-accent" : "well text-text-muted",
          )}
        >
          {icon}
        </span>
      )}
      <span className="flex flex-1 flex-col">
        <span className="font-medium">{title}</span>
        {body && <span className="text-sm text-text-subtle">{body}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-5.5 shrink-0 items-center justify-center border-[1.5px] transition-colors duration-(--motion-fast)",
          multiple ? "rounded-[0.4rem]" : "rounded-pill",
          selected ? "border-accent bg-accent text-on-accent" : "border-border-input",
        )}
      >
        {selected && <Check className="size-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

/** "שאלה 3 מתוך 9" with a bar. The bar fills from the start side (right in RTL). */
export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="num text-xs text-text-subtle">
        שאלה {step} מתוך {total}
      </span>
      <div
        role="progressbar"
        aria-label="התקדמות בשאלון"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        className="well h-1 overflow-hidden rounded-pill"
      >
        <div className="h-full rounded-pill bg-accent transition-[width] duration-(--motion-base)" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  );
}
