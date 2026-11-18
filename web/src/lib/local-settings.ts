// Per-device settings that never leave the browser. Storage can throw (private mode,
// blocked site data), so every access is guarded and the app works without it.

const APP_TOKEN = "app-access-token";

export function getAppToken(): string {
  try {
    return localStorage.getItem(APP_TOKEN) ?? "";
  } catch {
    return "";
  }
}

export function setAppToken(token: string): void {
  try {
    if (token.trim()) localStorage.setItem(APP_TOKEN, token.trim());
    else localStorage.removeItem(APP_TOKEN);
  } catch {
    // Not persisted; the photo request will ask again.
  }
}

// Listening: speed, chosen voice per engine, and where each lesson was left.
const SPEECH_RATE = "speech-rate";
const SPEECH_VOICE = "speech-voice:";
const SPEECH_POS = "speech-pos:";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not persisted: the player still works for this visit.
  }
}

export function getSpeechRate(): number {
  const r = Number(read(SPEECH_RATE));
  return r >= 0.5 && r <= 2 ? r : 1;
}
export const setSpeechRate = (rate: number) => write(SPEECH_RATE, String(rate));

export const getSpeechVoice = (engine: string) => read(SPEECH_VOICE + engine) ?? "";
export const setSpeechVoice = (engine: string, id: string) => write(SPEECH_VOICE + engine, id || null);

/** The sentence to continue from, or 0. Cleared when the lesson is heard to the end. */
export function getListenPosition(contentId: string): number {
  const n = Number(read(SPEECH_POS + contentId));
  return Number.isInteger(n) && n > 0 ? n : 0;
}
export const setListenPosition = (contentId: string, index: number) => write(SPEECH_POS + contentId, index > 0 ? String(index) : null);
