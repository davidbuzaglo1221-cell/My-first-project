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

const dayMonth = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long" });
const weekdayDayMonth = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" });

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "היום", "אתמול", "יום שלישי", or "12 באוקטובר" for anything older than a week. */
export function formatRelativeDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return "היום";
  if (days === 1) return "אתמול";
  if (days > 1 && days < 7) return new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(d);
  return dayMonth.format(d);
}

export function formatFullDate(d: Date | string): string {
  return weekdayDayMonth.format(typeof d === "string" ? new Date(d) : d);
}

export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}

/** 3725 -> "שעה ו-2 דק׳", 1500 -> "25 דק׳". For summaries, not for running clocks. */
export function formatDurationWords(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60);
  if (m < 1) return "פחות מדקה";
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const hours = h === 1 ? "שעה" : h === 2 ? "שעתיים" : `${h} שעות`;
  return rest ? `${hours} ו-${rest} דק׳` : hours;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "לילה טוב";
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

/** Start of the current week, by the user's choice of Sunday or Monday. */
export function startOfWeek(now: Date, weekStartsOn: "sun" | "mon"): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (d.getDay() - (weekStartsOn === "sun" ? 0 : 1) + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}
