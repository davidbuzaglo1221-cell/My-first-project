"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";

/**
 * Rest timer driven by an absolute end time, so it stays right after the tab sleeps
 * or the phone locks (the push notification covers the locked case; see architecture.md).
 */
export function RestTimer({
  endsAt,
  totalSec,
  onAdjust,
  onSkip,
  onDone,
  variant = "bar",
}: {
  endsAt: number | null;
  totalSec: number;
  onAdjust: (deltaSec: number) => void;
  onSkip: () => void;
  onDone?: () => void;
  variant?: "bar" | "full";
}) {
  const [now, setNow] = useState(() => Date.now());
  const doneFired = useRef(false);

  useEffect(() => {
    if (endsAt == null) return;
    doneFired.current = false;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const remaining = endsAt == null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));
  const finished = endsAt != null && remaining === 0;

  useEffect(() => {
    if (finished && !doneFired.current) {
      doneFired.current = true;
      onDone?.();
    }
  }, [finished, onDone]);

  if (endsAt == null) return null;

  const fraction = totalSec > 0 ? Math.min(1, remaining / totalSec) : 0;
  const time = formatDuration(remaining);

  const step = "well num h-10 min-w-13 rounded-pill px-3 text-sm font-medium text-text-muted hover:text-text";
  const controls = (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onAdjust(-15)} className={step} aria-label="הפחתת 15 שניות">
        <bdi dir="ltr">−15</bdi>
      </button>
      <button type="button" onClick={() => onAdjust(15)} className={step} aria-label="הוספת 15 שניות">
        <bdi dir="ltr">+15</bdi>
      </button>
      <button type="button" onClick={onSkip} className="h-10 rounded-pill px-3 text-sm font-semibold text-accent">
        {finished ? "סגירה" : "דילוג"}
      </button>
    </div>
  );

  return (
    <div className={cn("glass overflow-hidden rounded-lg", variant === "full" ? "p-6" : "px-4 pt-3.5 pb-4")}>
      {/* Announced once when it ends, not every second. */}
      <p aria-live="assertive" className="sr-only">
        {finished ? "המנוחה הסתיימה. לסט הבא" : ""}
      </p>
      {variant === "full" ? (
        <div className="flex flex-col items-center gap-4">
          <span className="text-sm text-text-muted">{finished ? "לסט הבא" : "מנוחה"}</span>
          <span role="timer" aria-label={`נותרו ${time}`} className={cn("figure text-timer", finished && "text-success")}>
            <bdi dir="ltr">{time}</bdi>
          </span>
          {controls}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-text-subtle">{finished ? "לסט הבא" : "מנוחה"}</span>
            <span
              role="timer"
              aria-label={`נותרו ${time}`}
              className={cn("figure text-[2.25rem] leading-none", finished ? "text-success" : "text-text")}
            >
              <bdi dir="ltr">{time}</bdi>
            </span>
          </div>
          {controls}
        </div>
      )}
      <div aria-hidden className={cn("well h-1 overflow-hidden rounded-pill", variant === "full" ? "mt-6" : "mt-3.5")}>
        {/* Shrinks toward the start side (right, in RTL). */}
        <div
          className="h-full rounded-pill bg-accent transition-[width] duration-300 ease-linear"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
