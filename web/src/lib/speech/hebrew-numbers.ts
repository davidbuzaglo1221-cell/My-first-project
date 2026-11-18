// Hebrew number words for speech. Spoken Hebrew agrees numbers with the noun's gender, uses a
// construct form for 2 before a noun (שתי דקות, שני סטים), and joins the last part with ו
// (מאה עשרים וחמש). Abstract numbers (a bare count, a year, a clock time) take the feminine form.
// Relative imports only, so the corpus tooling can load this file outside the app.

export type Gender = "m" | "f";

const ONES_F = ["אפס", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע"];
const ONES_M = ["אפס", "אחד", "שניים", "שלושה", "ארבעה", "חמישה", "שישה", "שבעה", "שמונה", "תשעה"];
const TEENS_F = ["עשר", "אחת עשרה", "שתים עשרה", "שלוש עשרה", "ארבע עשרה", "חמש עשרה", "שש עשרה", "שבע עשרה", "שמונה עשרה", "תשע עשרה"];
const TEENS_M = ["עשרה", "אחד עשר", "שנים עשר", "שלושה עשר", "ארבעה עשר", "חמישה עשר", "שישה עשר", "שבעה עשר", "שמונה עשר", "תשעה עשר"];
const TENS = ["", "", "עשרים", "שלושים", "ארבעים", "חמישים", "שישים", "שבעים", "שמונים", "תשעים"];
const HUNDREDS = ["", "מאה", "מאתיים", "שלוש מאות", "ארבע מאות", "חמש מאות", "שש מאות", "שבע מאות", "שמונה מאות", "תשע מאות"];
// 3,000 to 10,000 use the construct of the masculine number: שלושת אלפים, עשרת אלפים.
const THOUSANDS = ["", "אלף", "אלפיים", "שלושת אלפים", "ארבעת אלפים", "חמשת אלפים", "ששת אלפים", "שבעת אלפים", "שמונת אלפים", "תשעת אלפים", "עשרת אלפים"];

/** Words of 0..999, as a list of parts (the caller joins the last one with ו). */
function under1000(n: number, g: Gender): string[] {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 20) {
    parts.push(TENS[Math.floor(rest / 10)]);
    if (rest % 10) parts.push((g === "f" ? ONES_F : ONES_M)[rest % 10]);
  } else if (rest >= 10) {
    parts.push((g === "f" ? TEENS_F : TEENS_M)[rest - 10]);
  } else if (rest > 0) {
    parts.push((g === "f" ? ONES_F : ONES_M)[rest]);
  }
  return parts;
}

function joinParts(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  // ו attaches to the last part: "מאה עשרים וחמש", "אלף ושלוש מאות".
  return [...parts.slice(0, -1), `ו${parts[parts.length - 1]}`].join(" ");
}

/**
 * A whole number in words. `construct` gives the form used directly before a noun, which only
 * changes an exact 2 (שתי / שני).
 */
export function numberToHebrew(n: number, g: Gender = "f", construct = false): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `מינוס ${numberToHebrew(-n, g, construct)}`;
  n = Math.floor(n);
  if (n === 0) return ONES_F[0];
  if (construct && n === 2) return g === "f" ? "שתי" : "שני";

  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  if (millions) parts.push(millions === 1 ? "מיליון" : `${joinParts(under1000(millions, "m"))} מיליון`);
  if (thousands) {
    // 11,000 and up: masculine number + אלף ("אחד עשר אלף", "מאה אלף").
    parts.push(thousands <= 10 ? THOUSANDS[thousands] : `${joinParts(under1000(thousands, "m"))} אלף`);
  }
  parts.push(...under1000(rest, g));
  return joinParts(parts);
}

/** "2.5" → "שתיים וחצי", "1.6" → "אחת נקודה שש", "0.25" → "רבע". */
export function decimalToHebrew(text: string, g: Gender = "f"): string {
  const [intPart, frac = ""] = text.replace(/,/g, "").split(".");
  const whole = Number(intPart || "0");
  const f = frac.replace(/0+$/, "");
  if (!f) return numberToHebrew(whole, g);
  if (f === "5") return whole ? `${numberToHebrew(whole, g)} וחצי` : "חצי";
  if (f === "25") return whole ? `${numberToHebrew(whole, g)} ורבע` : "רבע";
  // Read the fraction as a number when it has no leading zero (1.75 → נקודה שבעים וחמש),
  // digit by digit otherwise (1.05 → נקודה אפס חמש).
  const fracWords = f.startsWith("0") ? [...f].map((d) => ONES_F[Number(d)]).join(" ") : numberToHebrew(Number(f), "f");
  return `${numberToHebrew(whole, g)} נקודה ${fracWords}`;
}

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

/** 15/11/2026 → "חמישה עשר בנובמבר אלפיים עשרים ושש". Day numbers are masculine (יום). */
export function dateToHebrew(day: number, month: number, year?: number): string {
  const d = day === 1 ? "הראשון" : numberToHebrew(day, "m");
  const m = `ב${MONTHS[month - 1]}`;
  return year === undefined ? `${d} ${m}` : `${d} ${m} ${numberToHebrew(year, "f")}`;
}

/** 07:30 → "שבע וחצי", 18:05 → "שמונה עשרה וחמש דקות", 9:00 → "תשע". Hours are feminine. */
export function timeToHebrew(h: number, m: number): string {
  const hour = h === 0 ? "חצות" : numberToHebrew(h, "f");
  if (m === 0) return hour;
  if (m === 30) return `${hour} וחצי`;
  if (m === 15) return `${hour} ורבע`;
  if (m === 1) return `${hour} ודקה`;
  if (m < 10) return `${hour} ו${numberToHebrew(m, "f")} דקות`;
  return `${hour} ו${numberToHebrew(m, "f")}`;
}

export const MONTH_NAMES = MONTHS;
