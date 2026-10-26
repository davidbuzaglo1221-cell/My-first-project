export type Units = "kg" | "lb";

const KG_PER_LB = 0.45359237;

const number = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });

export function formatNumber(n: number, fractionDigits = 2): string {
  return fractionDigits === 0 ? integer.format(n) : number.format(Number(n.toFixed(fractionDigits)));
}

/** Weights are stored in kg; this converts for display only. */
export function toDisplayWeight(kg: number, units: Units): number {
  return units === "kg" ? kg : kg / KG_PER_LB;
}

export function fromDisplayWeight(value: number, units: Units): number {
  return units === "kg" ? value : value * KG_PER_LB;
}

export function unitLabel(units: Units): string {
  return units === "kg" ? 'ק"ג' : "ליב'";
}

export function formatWeight(kg: number, units: Units): string {
  const v = toDisplayWeight(kg, units);
  // Round to the plate increments people actually load: 0.25 kg / 0.5 lb.
  const step = units === "kg" ? 0.25 : 0.5;
  return formatNumber(Math.round(v / step) * step);
}

/** 95 -> "1:35". Always left-to-right digits, even inside Hebrew text. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** Epley estimated one-rep max. Only meaningful for 1–12 reps. */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (reps < 1 || reps > 12 || weightKg <= 0) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}
