import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

/**
 * Circular progress toward a daily target, drawn fine like a watch bezel.
 * Past 100% a second lap runs in the warning colour: over target is information, not an error.
 */
export function ProgressRing({
  value,
  target,
  size = 168,
  stroke = 7,
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
  const r = (size - stroke) / 2 - 4;
  const c = 2 * Math.PI * r;
  const ratio = target > 0 ? value / target : 0;
  const first = Math.min(1, ratio);
  const over = Math.min(1, Math.max(0, ratio - 1));
  const remaining = Math.max(0, target - value);
  const ticks = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div
      role="img"
      aria-label={`${label}: ${formatNumber(value, 0)} מתוך ${formatNumber(target, 0)} ${unit}${ratio > 1 ? ", מעל היעד" : ""}`}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Rings start at the top and run clockwise in both text directions: a dial, not a line of text. */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {ticks.map((i) => {
          const a = (i / 60) * 2 * Math.PI;
          const outer = size / 2 - 1;
          const inner = outer - (i % 5 === 0 ? 4 : 2);
          return (
            <line
              key={i}
              x1={size / 2 + Math.cos(a) * inner}
              y1={size / 2 + Math.sin(a) * inner}
              x2={size / 2 + Math.cos(a) * outer}
              y2={size / 2 + Math.sin(a) * outer}
              stroke="var(--c-text-subtle)"
              strokeOpacity={i % 5 === 0 ? 0.55 : 0.25}
              strokeWidth={1}
            />
          );
        })}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--g-well)" strokeWidth={stroke} />
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
        <span className="figure text-display leading-none">{formatNumber(ratio > 1 ? value - target : remaining, 0)}</span>
        <span className="mt-1.5 text-xs text-text-muted">{ratio > 1 ? `${unit} מעל היעד` : `${unit} נותרו`}</span>
      </div>
    </div>
  );
}

const MACROS = {
  protein: { label: "חלבון", colorVar: "--c-macro-protein" },
  carbs: { label: "פחמימות", colorVar: "--c-macro-carbs" },
  fat: { label: "שומן", colorVar: "--c-macro-fat" },
} as const;

export type MacroKey = keyof typeof MACROS;

/** A labelled hairline per macro. The number carries the meaning; colour only groups it, so over target is said in words. */
export function MacroBar({ macro, value, target }: { macro: MacroKey; value: number; target: number }) {
  const m = MACROS[macro];
  const ratio = target > 0 ? value / target : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-2 text-sm text-text">
          <span aria-hidden className="size-1.5 rounded-pill" style={{ background: `var(${m.colorVar})` }} />
          {m.label}
        </span>
        <span className="text-sm text-text-muted">
          <bdi dir="ltr" className="figure text-base text-text">
            {formatNumber(value, 0)}
          </bdi>
          <span className="num text-text-subtle"> / {formatNumber(target, 0)} ג׳</span>
          {ratio > 1 && (
            <span className="num ms-2 text-xs text-warning">
              מעל ב-<bdi dir="ltr">{formatNumber(value - target, 0)}</bdi>
            </span>
          )}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={m.label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${formatNumber(value, 0)} מתוך ${formatNumber(target, 0)} גרם`}
        className="well h-1.5 overflow-hidden rounded-pill"
      >
        <div
          className="h-full rounded-pill transition-[width] duration-(--motion-slow)"
          style={{ width: `${Math.min(100, ratio * 100)}%`, background: `var(${m.colorVar})` }}
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

/** Strength score: the serif figure, its level engraved in brass, and the week's change. */
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
    <div className="flex items-end gap-4">
      <span className={cn("figure leading-[0.85]", size === "lg" ? "text-[4.5rem]" : "text-display")}>
        {formatNumber(score, 0)}
      </span>
      <div className="flex flex-col gap-1.5 pb-1">
        <span className="text-sm font-medium text-pr">{LEVELS[level]}</span>
        {delta != null && delta !== 0 && (
          <span className={cn("num text-xs", delta > 0 ? "text-success" : "text-danger")}>
            <bdi dir="ltr">{delta > 0 ? `+${delta}` : `${delta}`}</bdi> השבוע
          </span>
        )}
      </div>
    </div>
  );
}
