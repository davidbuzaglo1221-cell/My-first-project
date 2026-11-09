"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
import { chime } from "@/lib/chime";

/**
 * The moment a mission is done: rings of gold light open outwards, a seal settles, the points
 * count in. Two seconds, then it hands back. Tapping skips it. Reduced motion: the seal only.
 */
export function CompletionSeal({ xp, title, boss, onDone }: { xp: number; title: string; boss?: boolean; onDone: () => void }) {
  useEffect(() => {
    try {
      chime();
      navigator.vibrate?.([18, 40, 28]);
    } catch {
      // No sound or vibration here: the seal still shows.
    }
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="assertive"
      onClick={onDone}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-bg/92 px-8 text-center backdrop-blur-md"
      style={{ animation: "fade-in 240ms var(--ease-out) both" }}
    >
      <div className="relative flex size-44 items-center justify-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-pill border border-accent/60"
            style={{ animation: `burst 1.6s var(--ease-out) ${i * 180}ms both` }}
          />
        ))}
        <span
          aria-hidden
          className={`flex size-28 items-center justify-center rounded-pill ${boss ? "bg-blood text-on-blood" : "bg-accent text-on-accent"} shadow-[0_0_60px_-10px_var(--c-accent)]`}
          style={{ animation: "seal 700ms var(--ease-out) 120ms both" }}
        >
          <Check className="size-14" strokeWidth={2.2} />
        </span>
      </div>
      <div className="flex flex-col gap-2" style={{ animation: "rise 520ms var(--ease-out) 380ms both" }}>
        <span className="eyebrow">{boss ? "מבחן הדרגה עבר" : "המשימה בוצעה"}</span>
        <span className="display text-3xl">{title}</span>
        <span className="figure text-xl text-accent-ink"><bdi dir="ltr">+{xp}</bdi> נקודות</span>
      </div>
    </div>
  );
}
