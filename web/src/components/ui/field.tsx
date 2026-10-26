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

/** Inputs are wells: recessed into the glass, so it is obvious where to type. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, suffix, hideLabel, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={inputId} className={cn("text-sm font-medium text-text-muted", hideLabel && "sr-only")}>
        {label}
      </label>
      <div
        className={cn(
          "well flex h-13 items-center gap-2 rounded-md px-4 transition-shadow duration-(--motion-fast)",
          "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus",
          error && "outline-2 outline-offset-2 outline-danger",
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
        <p id={`${inputId}-hint`} className="text-sm text-text-subtle">
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
      className="well flex h-12 items-center gap-2.5 rounded-pill px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
    >
      <Search aria-hidden className="size-[1.15rem] shrink-0 text-text-subtle" />
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
          className="-me-2 inline-flex size-9 items-center justify-center rounded-pill text-text-muted hover:text-text"
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
        "inline-flex h-9 shrink-0 items-center rounded-pill px-4 text-sm font-medium transition-[background-color,color] duration-(--motion-fast)",
        selected ? "bg-accent text-on-accent" : "glass text-text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

/** Two to four mutually exclusive options. A raised glass thumb sits in a well. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  fullWidth,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  fullWidth?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("well inline-flex rounded-md p-1", fullWidth && "flex w-full")}>
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
              "h-9 min-w-16 flex-1 rounded-sm px-3.5 text-sm font-medium transition-[background-color,color] duration-(--motion-fast)",
              active ? "glass-raised text-text" : "text-text-muted hover:text-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
