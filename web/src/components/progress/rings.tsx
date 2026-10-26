import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

/**
 * Circular progress toward a daily target. Goes past 100% as a second lap in the warning colour,
 * because over target is information, not an error.
 */
export function ProgressRing({
  value,
  target,
  size = 132,
  stroke = 12,
  colorVar = "--c-accent",
  label,
  unit,
}: {
  value: number;
  target: number;
  size?: number;
  stroke?: number;
  colorVar?: string;
  label: string;
  unit: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = target > 0 ? value / target : 0;
  const first = Math.min(1, ratio);
  const over = Math.min(1, Math.max(0, ratio - 1));
  const remaining = Math.max(0, target - value);

  return (
    <div
      role="img"
      aria-label={`${label}: ${formatNumber(value, 0)} מתוך ${formatNumber(target, 0)} ${unit}${ratio > 1 ? ", מעל היעד" : ""}`}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Rings start at the top and fill clockwise in both directions of text: a clock, not a line of text. */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`var(${colorVar})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - first)}
          className="transition-[stroke-dashoffset] duration-(--motion-slow)"
        />
        {over > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--c-warning)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - over)}
          />
        )}
      </svg>
      <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-2xl leading-none">{formatNumber(ratio > 1 ? value - target : remaining, 0)}</span>
        <span className="mt-1 text-xs text-text-muted">{ratio > 1 ? "מעל היעד" : `נותרו ${unit}`}</span>
      </div>
    </div>
  );
}

const MACROS = {
  protein: { label: "חלבון", colorVar: "--c-macro-protein", text: "text-macro-protein" },
  carbs: { label: "פחמימות", colorVar: "--c-macro-carbs", text: "text-macro-carbs" },
  fat: { label: "שומן", colorVar: "--c-macro-fat", text: "text-macro-fat" },
} as const;

export type MacroKey = keyof typeof MACROS;

/** A labelled bar per macro. The number carries the meaning; colour only groups it. */
export function MacroBar({ macro, value, target }: { macro: MacroKey; value: number; target: number }) {
  const m = MACROS[macro];
  const ratio = target > 0 ? value / target : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className={cn("font-semibold", m.text)}>{m.label}</span>
        <span className="num text-text-muted">
          <bdi dir="ltr">
            {formatNumber(value, 0)}/{formatNumber(target, 0)}
          </bdi>{" "}
          ג׳
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={m.label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${formatNumber(value, 0)} מתוך ${formatNumber(target, 0)} גרם`}
        className="h-2 overflow-hidden rounded-pill bg-surface-2"
      >
        <div
          className="h-full rounded-pill transition-[width] duration-(--motion-slow)"
          style={{ width: `${Math.min(100, ratio * 100)}%`, background: `var(${ratio > 1.1 ? "--c-warning" : m.colorVar})` }}
        />
      </div>
    </div>
  );
}

export type StrengthLevel = "beginner" | "intermediate" | "advanced" | "expert" | "elite";

const LEVELS: Record<StrengthLevel, string> = {
  beginner: "מתחיל",
  intermediate: "בינוני",
  advanced: "מתקדם",
  expert: "מומחה",
  elite: "עילית",
};

/** Strength score with its level and the week's change, explained in words. */
export function ScoreBadge({
  score,
  level,
  delta,
  size = "md",
}: {
  score: number;
  level: StrengthLevel;
  delta?: number;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("num leading-none", size === "lg" ? "text-display" : "text-2xl")}>{formatNumber(score, 0)}</span>
      <div className="flex flex-col gap-1">
        <span className="w-fit rounded-pill bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent-ink">
          {LEVELS[level]}
        </span>
        {delta != null && delta !== 0 && (
          <span className={cn("num text-xs font-semibold", delta > 0 ? "text-accent" : "text-danger")}>
            <bdi dir="ltr">{delta > 0 ? `+${delta}` : `${delta}`}</bdi> השבוע
          </span>
        )}
      </div>
    </div>
  );
}
