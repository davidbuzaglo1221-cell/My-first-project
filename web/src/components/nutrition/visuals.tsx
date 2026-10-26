import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

/**
 * Calories as a segmented arc: 28 rounded bars across 240°, filled in ink up to today's total.
 * Bars read faster than a thin ring and stay legible in sunlight. Over target, the overflow
 * bars turn the warning colour and the centre says by how much.
 */
export function CalorieArc({ value, target, size = 260 }: { value: number; target: number; size?: number }) {
  const bars = 28;
  const sweep = 240;
  const start = -90 - sweep / 2; // centred on the top
  const ratio = target > 0 ? value / target : 0;
  const filled = Math.min(bars, Math.round(Math.min(ratio, 1) * bars));
  const over = ratio > 1 ? Math.min(bars, Math.round((ratio - 1) * bars)) : 0;
  const c = size / 2;
  const outer = size / 2 - 6;
  const inner = outer - size * 0.13;
  const height = size * 0.78;

  return (
    <div
      role="img"
      aria-label={`קלוריות: ${formatNumber(value, 0)} מתוך ${formatNumber(target, 0)}${ratio > 1 ? `, ${formatNumber(value - target, 0)} מעל היעד` : `, נותרו ${formatNumber(Math.max(0, target - value), 0)}`}`}
      className="relative mx-auto"
      style={{ width: size, height }}
    >
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} aria-hidden>
        {Array.from({ length: bars }, (_, i) => {
          // Fill runs clockwise from the start of the arc, like a gauge, in both text directions.
          const a = ((start + (i / (bars - 1)) * sweep) * Math.PI) / 180;
          const isFilled = i < filled;
          const isOver = i < over;
          return (
            <line
              key={i}
              x1={c + Math.cos(a) * inner}
              y1={c + Math.sin(a) * inner}
              x2={c + Math.cos(a) * outer}
              y2={c + Math.sin(a) * outer}
              strokeWidth={size * 0.034}
              strokeLinecap="round"
              stroke={isOver ? "var(--c-warning)" : isFilled ? "var(--c-text)" : "var(--c-border)"}
              style={{ transition: `stroke var(--motion-slow) ${i * 12}ms` }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-x-0 top-[38%] flex flex-col items-center">
        <span className="text-sm text-text-muted">קלוריות</span>
        <span className="figure text-[2.75rem] leading-none">
          <bdi dir="ltr">{formatNumber(value, 0)}</bdi>
        </span>
        <span className="num mt-1 text-sm text-text-subtle">
          מתוך <bdi dir="ltr">{formatNumber(target, 0)}</bdi>
        </span>
      </div>
    </div>
  );
}

const MACROS = {
  protein: { label: "חלבון", color: "--c-macro-protein", text: "text-macro-protein" },
  carbs: { label: "פחמימות", color: "--c-macro-carbs", text: "text-macro-carbs" },
  fat: { label: "שומן", color: "--c-macro-fat", text: "text-macro-fat" },
} as const;
export type MacroKey = keyof typeof MACROS;

/** Three macros side by side under the arc: label, eaten / target in grams, a short bar. */
export function MacroTrio({ values, targets }: { values: Record<MacroKey, number>; targets: Record<MacroKey, number> }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {(Object.keys(MACROS) as MacroKey[]).map((k) => {
        const m = MACROS[k];
        const ratio = targets[k] > 0 ? values[k] / targets[k] : 0;
        return (
          <div key={k} className="flex flex-col gap-1.5">
            <span className={cn("text-sm font-semibold", m.text)}>{m.label}</span>
            <div
              role="progressbar"
              aria-label={m.label}
              aria-valuemin={0}
              aria-valuemax={targets[k]}
              aria-valuenow={Math.round(values[k])}
              aria-valuetext={`${formatNumber(values[k], 0)} מתוך ${formatNumber(targets[k], 0)} גרם`}
              className="well h-1.5 overflow-hidden rounded-pill"
            >
              <div
                className="h-full rounded-pill transition-[width] duration-(--motion-slow)"
                style={{ width: `${Math.min(100, ratio * 100)}%`, background: `var(${m.color})` }}
              />
            </div>
            <span className="num text-sm text-text-subtle">
              <bdi dir="ltr">
                <span className="font-semibold text-text">{formatNumber(values[k], 0)}</span>/{formatNumber(targets[k], 0)}
              </bdi>{" "}
              ג׳
            </span>
          </div>
        );
      })}
    </div>
  );
}

const weekdayShort = new Intl.DateTimeFormat("he-IL", { weekday: "short" });

export type DayMark = { date: string; logged: boolean; onTarget: boolean };

/**
 * The week as a strip of days. The selected day is a filled ink pill; days with food logged
 * get a dashed ring, days within target a solid one. Days run right to left (RTL), Sunday first.
 */
export function WeekStrip({
  days,
  selected,
  today,
  onSelect,
}: {
  days: DayMark[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div role="tablist" aria-label="ימי השבוע" className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const date = new Date(`${d.date}T12:00:00`);
        const isSel = d.date === selected;
        const isFuture = d.date > today;
        return (
          <button
            key={d.date}
            type="button"
            role="tab"
            aria-selected={isSel}
            aria-label={`${new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(date)}${d.logged ? ", יש רישום" : ""}${d.date === today ? ", היום" : ""}`}
            disabled={isFuture}
            onClick={() => onSelect(d.date)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-pill py-2 transition-colors duration-(--motion-fast) disabled:opacity-40",
              isSel ? "bg-accent text-on-accent" : "text-text-muted hover:text-text",
            )}
          >
            <span className="text-xs">{weekdayShort.format(date).replace("יום ", "")}</span>
            <span
              className={cn(
                "num flex size-8 items-center justify-center rounded-pill text-sm font-semibold",
                d.onTarget ? "border-2 border-success" : d.logged ? "border-[1.5px] border-dashed" : "border-[1.5px] border-transparent",
                d.logged && !d.onTarget && (isSel ? "border-on-accent/70" : "border-text-subtle"),
              )}
            >
              {date.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
