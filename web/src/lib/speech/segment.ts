// Splits text into the units a listener moves through (sentences) and, inside each sentence, into
// language runs, so an English phrase in a Hebrew sentence is read by an English voice.
import { normalizeForSpeech } from "./normalize";

export type Lang = "he-IL" | "en-US";
export type SpeechPart = { lang: Lang; text: string };
export type SpeechRole = "title" | "body" | "callout";

export type SpeechItem = {
  /** Stable within a script: `${paragraph}.${sentence}`. */
  id: string;
  /** The sentence as written, for the screen. */
  display: string;
  /** What is spoken, already normalized, by language. */
  parts: SpeechPart[];
  role: SpeechRole;
  paragraph: number;
  /** Silence after this item, at 1× speed. Longer at the end of a paragraph and after a title. */
  pauseAfterMs: number;
};

const HEB = /[א-ת]/;
const LAT = /[A-Za-z]/;

/** The main language of a piece of text: whichever has more words (Hebrew on a tie). */
export function detectLang(text: string): Lang {
  const words = text.split(/\s+/);
  const he = words.filter((w) => HEB.test(w)).length;
  const en = words.filter((w) => LAT.test(w) && !HEB.test(w)).length;
  return en > he ? "en-US" : "he-IL";
}

/**
 * Sentences, keeping decimals (2.5), times (7:30) and abbreviations (וכו׳.) whole.
 */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=\S)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Language runs inside one normalized sentence. A run of two or more English words becomes its
 * own part; a single Latin word stays inside the Hebrew run (the lexicon already handled the
 * common ones), so the sentence is not chopped into tiny clips.
 */
export function languageRuns(sentence: string): SpeechPart[] {
  const base = detectLang(sentence);
  if (base === "en-US" || !LAT.test(sentence)) return [{ lang: base, text: sentence }];

  const tokens = sentence.split(/(\s+)/);
  const parts: SpeechPart[] = [];
  let i = 0;
  while (i < tokens.length) {
    // Find a run of Latin words (allowing spaces and light punctuation between them).
    if (LAT.test(tokens[i]) && !HEB.test(tokens[i])) {
      let j = i;
      let words = 0;
      while (j < tokens.length && (tokens[j].trim() === "" || (LAT.test(tokens[j]) && !HEB.test(tokens[j])) || /^[\d.,'’-]+$/.test(tokens[j]))) {
        if (LAT.test(tokens[j])) words++;
        j++;
      }
      // Leave trailing spaces to the next run.
      while (j > i && tokens[j - 1].trim() === "") j--;
      if (words >= 2) {
        parts.push({ lang: "en-US", text: tokens.slice(i, j).join("") });
        i = j;
        continue;
      }
    }
    const last = parts[parts.length - 1];
    if (last && last.lang === "he-IL") last.text += tokens[i];
    else parts.push({ lang: "he-IL", text: tokens[i] });
    i++;
  }
  return parts.map((p) => ({ ...p, text: p.text.trim() })).filter((p) => p.text && /[\p{L}\p{N}]/u.test(p.text));
}

export type ScriptBlock = { text: string; role: SpeechRole; lead?: string };

const PAUSE = { sentence: 140, paragraph: 420, title: 650 } as const;

/** Blocks (a title, paragraphs, a callout) → the ordered items the player speaks. */
export function buildScript(blocks: ScriptBlock[]): SpeechItem[] {
  const items: SpeechItem[] = [];
  blocks.forEach((block, paragraph) => {
    const sentences = splitSentences(block.text);
    sentences.forEach((display, s) => {
      const text = s === 0 && block.lead ? `${block.lead}. ${display}` : display;
      // Hebrew rules only for Hebrew: an English sentence goes to the English voice as written,
      // and English engines read their own numbers and dates ("November 15, 2026").
      const parts: SpeechPart[] =
        detectLang(text) === "en-US" ? [{ lang: "en-US", text: text.replace(/\s+/g, " ").trim() }] : languageRuns(normalizeForSpeech(text));
      const endOfBlock = s === sentences.length - 1;
      items.push({
        id: `${paragraph}.${s}`,
        display,
        parts,
        role: block.role,
        paragraph,
        pauseAfterMs: block.role === "title" ? PAUSE.title : endOfBlock ? PAUSE.paragraph : PAUSE.sentence,
      });
    });
  });
  return items;
}
