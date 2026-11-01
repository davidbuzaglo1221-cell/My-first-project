import { shortLabel } from "../lib/dates";

export interface Series {
  label: string;
  color: string;
  values: (number | null)[];
}

/** Line chart on real values only. Missing days (null) break the line instead of being interpolated. */
export function LineChart({ labels, series, min = 1, max = 5, height = 160 }: { labels: string[]; series: Series[]; min?: number; max?: number; height?: number }) {
  const w = 320;
  const padL = 22;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const n = labels.length;
  const x = (i: number) => padL + (n <= 1 ? (w - padL - padR) / 2 : (i * (w - padL - padR)) / (n - 1));
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (height - padT - padB);
  const ticks = [min, (min + max) / 2, max];
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${height}`} role="img" aria-label={`גרף: ${series.map((s) => s.label).join(", ")}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="rgba(20,19,18,0.08)" />
          <text x={2} y={y(t) + 4}>{Math.round(t * 10) / 10}</text>
        </g>
      ))}
      {series.map((s) => {
        let d = "";
        let pen = false;
        s.values.forEach((v, i) => {
          if (v === null || Number.isNaN(v)) {
            pen = false;
            return;
          }
          d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
          pen = true;
        });
        return (
          <g key={s.label}>
            <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={2.6} fill={s.color} />))}
          </g>
        );
      })}
      {labels.map((l, i) => (i % Math.ceil(n / 6) === 0 || i === n - 1 ? <text key={i} x={x(i)} y={height - 4} textAnchor="middle">{shortLabel(l)}</text> : null))}
    </svg>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
      {series.map((s) => (
        <span key={s.label} className="small text-2 row" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** Bars for 0/1 values (e.g., exercised or not). */
export function BarStrip({ labels, values, color = "var(--accent)" }: { labels: string[]; values: (boolean | undefined)[]; color?: string }) {
  const w = 320;
  const h = 70;
  const n = labels.length;
  const bw = (w - 8) / n - 4;
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h + 18}`} role="img" aria-label="ימים עם פעילות גופנית">
      {values.map((v, i) => (
        <g key={i}>
          <rect x={4 + i * (bw + 4)} y={v ? 6 : h - 10} width={bw} height={v ? h - 16 : 4} rx={3} fill={v ? color : "rgba(20,19,18,0.12)"} />
        </g>
      ))}
      {labels.map((l, i) => (i % Math.ceil(n / 6) === 0 || i === n - 1 ? <text key={i} x={4 + i * (bw + 4) + bw / 2} y={h + 14} textAnchor="middle">{shortLabel(l)}</text> : null))}
    </svg>
  );
}
