"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  /** Unit shown inside the field, e.g. ק"ג. */
  suffix?: ReactNode;
  hideLabel?: boolean;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, suffix, hideLabel, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className={cn("text-sm font-medium text-text", hideLabel && "sr-only")}>
        {label}
      </label>
      <div
        className={cn(
          "flex h-12 items-center gap-2 rounded-md border bg-bg px-3",
          "focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-focus",
          error ? "border-danger" : "border-border-input",
        )}
      >
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-text-subtle"
          {...rest}
        />
        {suffix && <span className="shrink-0 text-sm text-text-muted">{suffix}</span>}
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
});

export function SearchField({
  value,
  onChange,
  placeholder = "חיפוש",
  label = "חיפוש",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div
      role="search"
      className="flex h-11 items-center gap-2 rounded-pill bg-surface-2 px-4 focus-within:outline-2 focus-within:outline-focus"
    >
      <Search aria-hidden className="size-5 shrink-0 text-text-muted" />
      <input
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-text-subtle [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="ניקוי החיפוש"
          onClick={() => onChange("")}
          className="-me-2 inline-flex size-9 items-center justify-center rounded-pill text-text-muted hover:bg-surface"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Toggle chip for filters. aria-pressed carries the state. */
export function FilterChip({
  selected,
  onToggle,
  children,
}: {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-pill border px-3.5 text-sm font-medium transition-colors duration-(--motion-fast)",
        selected
          ? "border-accent bg-accent-soft text-accent-ink"
          : "border-border bg-bg text-text hover:bg-surface",
      )}
    >
      {children}
    </button>
  );
}

/** Two to four mutually exclusive options, e.g. ק"ג / ליב'. Uses radio semantics. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-9 min-w-16 rounded-sm px-3 text-sm font-semibold transition-colors duration-(--motion-fast)",
              active ? "bg-bg text-text shadow-card" : "text-text-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
