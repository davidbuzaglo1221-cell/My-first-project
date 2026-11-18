export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

const QUALITY = [/natural/i, /neural/i, /premium/i, /enhanced/i, /siri/i, /google/i, /online/i, /carmit/i, /hila/i, /avri/i]

const rank = (v: SpeechSynthesisVoice) => {
  const i = QUALITY.findIndex((r) => r.test(v.name))
  return (i === -1 ? 50 : i) + (v.localService ? 0 : -0.5)
}

export const isHebrew = (v: SpeechSynthesisVoice) => /^(he|iw)([-_]|$)/i.test(v.lang)

let cache: SpeechSynthesisVoice[] = []
const subs = new Set<(v: SpeechSynthesisVoice[]) => void>()

function refresh() {
  if (!speechSupported()) return
  cache = speechSynthesis
    .getVoices()
    .filter(isHebrew)
    .sort((a, b) => rank(a) - rank(b))
  subs.forEach((f) => f(cache))
}

if (speechSupported()) {
  refresh()
  speechSynthesis.addEventListener?.('voiceschanged', refresh)
  // Some engines populate late and never fire the event.
  setTimeout(refresh, 400)
  setTimeout(refresh, 1500)
}

export const hebrewVoices = () => cache
export const onVoices = (fn: (v: SpeechSynthesisVoice[]) => void) => {
  subs.add(fn)
  return () => subs.delete(fn)
}

export function pickVoice(uri?: string) {
  return cache.find((v) => v.voiceURI === uri) ?? cache[0]
}

/** Human label for a voice: strip vendor noise. */
export const voiceLabel = (v: SpeechSynthesisVoice) =>
  v.name.replace(/Microsoft|Google|\(.*?\)|Online|Hebrew|Israel|-/gi, ' ').replace(/\s+/g, ' ').trim() || v.name
