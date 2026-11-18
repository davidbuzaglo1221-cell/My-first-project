// The voices the app offers, per engine. A "persona" pairs a Hebrew voice with an English one so
// an English phrase inside a Hebrew sentence sounds like the same person.
//   Google Chirp 3 HD ships the same 30 named voices in he-IL and en-US (he-IL-Chirp3-HD-Kore,
//   en-US-Chirp3-HD-Kore), so a persona is one name in both languages.
//     https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types
//   Azure has two he-IL voices (HilaNeural, AvriNeural), neither multilingual, so each pairs with a
//   multilingual en-US voice of the same gender.
//     https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
import type { Lang } from "./segment";

export type CloudProvider = "google" | "azure";
export type Persona = { id: string; label: string; gender: "female" | "male"; voices: Record<Lang, string> };

const chirp = (name: string, label: string, gender: Persona["gender"]): Persona => ({
  id: `google:${name}`,
  label,
  gender,
  voices: { "he-IL": `he-IL-Chirp3-HD-${name}`, "en-US": `en-US-Chirp3-HD-${name}` },
});

// A short list instead of all 30: enough choice, and every voice here gets listened to in
// speech-quality-testing before it ships. The first of each gender is the default.
export const GOOGLE_PERSONAS: Persona[] = [
  chirp("Kore", "קורה", "female"),
  chirp("Aoede", "איאודה", "female"),
  chirp("Leda", "לדה", "female"),
  chirp("Zephyr", "זפיר", "female"),
  chirp("Charon", "כארון", "male"),
  chirp("Puck", "פאק", "male"),
  chirp("Orus", "אורוס", "male"),
  chirp("Fenrir", "פנריר", "male"),
];

export const AZURE_PERSONAS: Persona[] = [
  { id: "azure:Hila", label: "הילה", gender: "female", voices: { "he-IL": "he-IL-HilaNeural", "en-US": "en-US-AvaMultilingualNeural" } },
  { id: "azure:Avri", label: "אברי", gender: "male", voices: { "he-IL": "he-IL-AvriNeural", "en-US": "en-US-AndrewMultilingualNeural" } },
];

export const PERSONAS: Record<CloudProvider, Persona[]> = { google: GOOGLE_PERSONAS, azure: AZURE_PERSONAS };

export function findPersona(provider: CloudProvider, id: string | undefined): Persona {
  const list = PERSONAS[provider];
  return list.find((p) => p.id === id) ?? list[0];
}

/** Playback speeds offered. Applied on the device (pitch kept), so a speed change is instant and free. */
export const SPEEDS = [0.75, 0.9, 1, 1.15, 1.3, 1.5] as const;

export function speedLabel(rate: number): string {
  // Shown inside dir="ltr" so it reads "1.5×" in an RTL page too.
  return `${rate.toLocaleString("en-US", { maximumFractionDigits: 2 })}×`;
}
