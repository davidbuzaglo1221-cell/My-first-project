// SSML for each cloud engine, from one speech item. Kept to the tags each engine documents:
//   Google Chirp 3 HD: speak, p, s, break, prosody, say-as, phoneme, sub, voice, audio
//     https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd
//   Azure: speak, voice, lang (multilingual voices only), break, prosody, phoneme, sub
//     https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice
// No <emphasis>: Chirp 3 HD ignores it and Azure's he-IL voices do not support it. Emphasis comes
// from structure instead: a slower, separated title, and a pause before a callout's lead.
import type { Lang, SpeechPart, SpeechRole } from "./segment";

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Commas from the normalizer (dashes, brackets) get a short, explicit breath. */
function withBreaths(text: string): string {
  return escapeXml(text).replace(/,\s+/g, ', <break time="120ms"/>');
}

function roleWrap(inner: string, role: SpeechRole): string {
  if (role === "title") return `<prosody rate="94%">${inner}</prosody>`;
  return inner;
}

export type VoicePair = Record<Lang, string>;

/** Google: one request; a run in the other language switches voice with <voice>. */
export function googleSsml(parts: SpeechPart[], role: SpeechRole, voices: VoicePair, base: Lang): string {
  const body = parts
    .map((p) => (p.lang === base ? withBreaths(p.text) : `<voice name="${escapeXml(voices[p.lang])}">${withBreaths(p.text)}</voice>`))
    .join(" ");
  return `<speak><s>${roleWrap(body, role)}</s></speak>`;
}

/** Azure: each language run in its own <voice>; he-IL voices are not multilingual. */
export function azureSsml(parts: SpeechPart[], role: SpeechRole, voices: VoicePair, base: Lang): string {
  const body = parts.map((p) => `<voice name="${escapeXml(voices[p.lang])}">${roleWrap(withBreaths(p.text), role)}</voice>`).join("");
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${base}">${body}</speak>`;
}
