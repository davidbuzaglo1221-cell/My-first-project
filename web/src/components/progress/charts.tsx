import { formatNumber } from "@/lib/format";

/**
 * A small line chart. Time runs left to right even in Hebrew (the convention for charts),
 * so the SVG is forced LTR; labels around it stay RTL.
 */
export function LineChart({ points, height = 140, label, unit }: { points: { x: number; y: number; label: string }[]; height?: number; label: string; unit: string }) {
  if (points.length < 2) {
    return <p className="well rounded-md px-4 py-6 text-center text-sm text-text-muted">צריך לפחות שני אימונים כדי לראות מגמה.</p>;
  }
  const w = 320;
  const pad = { t: 12, r: 8, b: 22, l: 8 };
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (height - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const last = points.at(-1)!;
  const first = points[0];

  return (
    <figure className="flex flex-col gap-2">
      <svg
        direction="ltr"
        viewBox={`0 0 ${w} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${label}: מ-${formatNumber(first.y, 1)} ל-${formatNumber(last.y, 1)} ${unit}, ${points.length} נקודות`}
      >
        <path d={`${path} L${x(points.length - 1)},${height - pad.b} L${x(0)},${height - pad.b} Z`} fill="var(--c-text)" opacity="0.05" />
        <path d={path} fill="none" stroke="var(--c-text)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.y)} r={i === points.length - 1 ? 4 : 2.5} fill={i === points.length - 1 ? "var(--c-text)" : "var(--c-surface)"} stroke="var(--c-text)" strokeWidth="1.5" />
        ))}
        <text x={x(0)} y={height - 6} fontSize="10" fill="var(--c-text-subtle)">
          {first.label}
        </text>
        <text x={x(points.length - 1)} y={height - 6} fontSize="10" fill="var(--c-text-subtle)" textAnchor="end">
          {last.label}
        </text>
      </svg>
    </figure>
  );
}

/** Vertical bars, e.g. workouts per week or calories per day. Optional dashed target line. */
export function BarChart({ bars, target, height = 120, label }: { bars: { label: string; value: number; highlight?: boolean }[]; target?: number; height?: number; label: string }) {
  const max = Math.max(1, target ?? 0, ...bars.map((b) => b.value)) * 1.1;
  return (
    <figure className="flex flex-col gap-2" aria-label={label}>
      <div dir="ltr" className="relative flex items-end gap-1.5" style={{ height }}>
        {target != null && target > 0 && (
          <span aria-hidden className="absolute inset-x-0 border-t border-dashed border-text-subtle/60" style={{ bottom: `${(target / max) * 100}%` }} />
        )}
        {bars.map((b, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`${b.label}: ${formatNumber(b.value, 0)}`}>
            <div
              className={b.highlight ? "rounded-t-sm bg-accent" : "rounded-t-sm bg-text-subtle/35"}
              style={{ height: `${Math.max(b.value > 0 ? 3 : 0, (b.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div dir="ltr" className="flex gap-1.5">
        {bars.map((b, i) => (
          <span key={i} className="flex-1 text-center text-[0.625rem] text-text-subtle">
            {b.label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        {label}: {bars.map((b) => `${b.label} ${formatNumber(b.value, 0)}`).join(", ")}
      </figcaption>
    </figure>
  );
}
