// Turns written Hebrew into the words a person says: numbers agree with their noun, ranges and
// units are read in full, dates and times are spoken, abbreviations expanded, quotes removed, and
// known English terms written the way an Israeli says them. The voice then reads, it never guesses.
import { dateToHebrew, decimalToHebrew, numberToHebrew, timeToHebrew, type Gender } from "./hebrew-numbers";
import { ABBREVIATIONS, EN_IN_HEBREW, NOUN_GENDER, UNITS } from "./lexicon";

const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
// One-letter Hebrew prefixes written before a number with a hyphen: ל-12, ב-3, כ-1.6, ו-3, מ-60, ה-15.
const PREFIX = String.raw`(?:[ובלמכהש]{1,3}[-־])`;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const UNIT_RE = Object.keys(UNITS)
  .sort((a, b) => b.length - a.length)
  .map(escapeRe)
  .join("|");

// A Hebrew "word" for lookahead: letters plus in-word geresh/gershayim (ק״ג, קוטג׳).
const WORD = String.raw`[א-ת][א-ת׳״'"]*`;
const NUMBER_RUN = new RegExp(
  String.raw`(?<pre>${PREFIX})?(?<a>${NUM})(?:\s*(?<sep>עד|[-–—])\s*(?<b>${NUM}))?(?:\s*(?<unit>${UNIT_RE})(?![א-תa-zA-Z]))?(?<tail>\s+(?<noun>${WORD}))?`,
  "g",
);

function stripPrefixLetters(word: string): string {
  return word.replace(/^[ובלכמה](?=[א-ת]{2,})/, "");
}

/** The gender of the noun a number counts, or undefined if the next word is not a known noun. */
export function nounGender(word: string | undefined): Gender | undefined {
  if (!word) return undefined;
  const clean = word.replace(/[׳״'"]+$/, "");
  return NOUN_GENDER[clean] ?? NOUN_GENDER[UNITS[clean] ?? ""] ?? NOUN_GENDER[stripPrefixLetters(clean)];
}

function sayNumber(raw: string, g: Gender, construct: boolean): string {
  const plain = raw.replace(/,/g, "");
  return plain.includes(".") ? decimalToHebrew(plain, g) : numberToHebrew(Number(plain), g, construct);
}

function spellPrefix(pre: string | undefined): string {
  return pre ? pre.replace(/[-־]$/, "") : "";
}

function numbers(text: string): string {
  return text.replace(NUMBER_RUN, (...args) => {
    const groups = args[args.length - 1] as Record<string, string | undefined>;
    const { pre, a, sep, b, unit, tail, noun } = groups;
    const unitWord = unit ? UNITS[unit] : undefined;
    const counted = unitWord ?? noun;
    const g: Gender = nounGender(counted) ?? "f";
    const known = nounGender(counted) !== undefined;
    const p = spellPrefix(pre);
    const after = unitWord ? ` ${unitWord}${tail ?? ""}` : (tail ?? "");

    if (b !== undefined && sep !== undefined) {
      // A range: "8 עד 12 חזרות", "1-3". The first number stands alone, the second meets the noun.
      return `${p}${sayNumber(a!, g, false)} עד ${sayNumber(b, g, known)}${after}`;
    }
    // One before a noun goes after it: "1 סט" → "סט אחד".
    if (a === "1" && known && !p) {
      const nounText = unitWord ?? noun!;
      const rest = unitWord ? (tail ?? "") : "";
      return `${nounText} ${g === "m" ? "אחד" : "אחת"}${rest}`;
    }
    return `${p}${sayNumber(a!, g, known)}${after}`;
  });
}

function dates(text: string): string {
  return text
    .replace(new RegExp(String.raw`(${PREFIX})?\b(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})\b`, "g"), (m, pre, d, mo, y) => {
      const day = Number(d), month = Number(mo);
      if (day < 1 || day > 31 || month < 1 || month > 12) return m;
      const year = y.length === 2 ? 2000 + Number(y) : Number(y);
      return spellPrefix(pre) + dateToHebrew(day, month, year);
    })
    .replace(new RegExp(String.raw`(${PREFIX})?\b([01]?\d|2[0-3]):([0-5]\d)\b`, "g"), (_, pre, h, m) => spellPrefix(pre) + timeToHebrew(Number(h), Number(m)));
}

function percents(text: string): string {
  return text.replace(new RegExp(String.raw`(${PREFIX})?(${NUM})\s?%`, "g"), (_, pre, n) => `${spellPrefix(pre)}${sayNumber(n, "m", false)} אחוז`);
}

function abbreviations(text: string): string {
  let out = text;
  for (const [k, v] of Object.entries(ABBREVIATIONS)) {
    out = out.replace(new RegExp(String.raw`(^|[\s(,])${escapeRe(k)}(?=$|[\s.,!?;:)])`, "g"), `$1${v}`);
  }
  return out;
}

function englishTerms(text: string): string {
  let out = text;
  const keys = Object.keys(EN_IN_HEBREW).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    // Only inside Hebrew text: an English sentence keeps its own words.
    out = out.replace(new RegExp(String.raw`(?<![A-Za-z0-9])${escapeRe(k)}(?![A-Za-z0-9])`, "g"), (m, offset: number, whole: string) => {
      const around = whole.slice(Math.max(0, offset - 30), offset + m.length + 30);
      return /[א-ת]/.test(around) ? EN_IN_HEBREW[k] : m;
    });
  }
  return out;
}

/** Hebrew unit abbreviations that are not after a number: "לכל ק״ג משקל גוף" → "לכל קילו משקל גוף". */
function standaloneUnits(text: string): string {
  let out = text;
  for (const [k, v] of Object.entries(UNITS)) {
    if (!/[א-ת]/.test(k) || !/[״"׳']/.test(k)) continue;
    out = out.replace(new RegExp(String.raw`(^|[\s(,])${escapeRe(k)}(?=$|[\s.,!?;:)])`, "g"), `$1${v}`);
  }
  return out;
}

function quotesAndSymbols(text: string): string {
  return (
    text
      // A quoted label keeps its words but not its question or exclamation mark: ב„למה?” is a
      // button name, not a question, and must not lift the intonation mid-sentence.
      .replace(/([„“"״])([^„“”"״]{1,40}?)[?!]([”"״])/g, "$1$2$3")
      // Gershayim or geresh used as quotation marks (at a word's edge), and typographic quotes.
      .replace(/(^|[\s(])[״"„“”]+(?=\S)/g, "$1")
      .replace(/(?<=\S)[„“”]+/g, "")
      .replace(/(?<=[א-ת.,!?])[״"](?=$|[\s.,!?;:)])/g, "")
      .replace(/(\d)\s*[×xX*]\s*(\d)/g, "$1 כפול $2")
      .replace(/\s*&\s*/g, " ו")
      .replace(/~\s*/g, "בערך ")
      .replace(/\s+[-–—]\s+/g, ", ")
      .replace(/[()]/g, ", ")
      .replace(/\s*\+\s*(?=\d)/g, " פלוס ")
      .replace(/…/g, "...")
  );
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/^[,\s]+/, "")
    .trim();
}

/** Written text → the words to speak. Idempotent on text that has nothing left to expand. */
export function normalizeForSpeech(text: string): string {
  let t = text.normalize("NFC");
  t = englishTerms(t);
  t = abbreviations(t);
  t = quotesAndSymbols(t);
  t = dates(t);
  t = percents(t);
  t = numbers(t);
  t = standaloneUnits(t);
  return tidy(t);
}
