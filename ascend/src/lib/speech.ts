/* Text-to-speech behind one interface, for short spoken answers (lessons have their own recorded narration).
   - cloud: Microsoft neural Hebrew voices (Hila, Avri) through the app's server; the key never reaches the device.
   - device: the Hebrew voice installed on the phone or computer.
   The best available engine is chosen automatically; a voice preference (female/male) carries across both. */
import { pause as pausePlayer, player } from '../engine/player'
import { hebrewVoices, speechSupported } from '../engine/voices'
import { serverBase, serverCaps } from './ai'

export type VoiceGender = 'female' | 'male'

export interface SpeakOptions {
  gender: VoiceGender
  rate: number
  onEnd?: () => void
}

export interface Speaking {
  stop(): void
  done: Promise<void>
}

export interface SpeechProvider {
  id: 'cloud' | 'device'
  speak(text: string, o: SpeakOptions): Speaking
}

/** Hebrew device voices by gender, as published by Apple, Google and Microsoft. */
const MALE = /asaf|avri|male|גבר/i
const FEMALE = /carmit|hila|female|google|אישה/i

export function deviceVoiceFor(gender: VoiceGender, voices = hebrewVoices()): SpeechSynthesisVoice | undefined {
  const want = gender === 'male' ? MALE : FEMALE
  return voices.find((v) => want.test(v.name)) ?? voices[0]
}

/** Speech reads better without symbols the voice would spell out. */
export const speakable = (t: string) =>
  t
    .replace(/[*_#`>|]/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const deviceProvider: SpeechProvider = {
  id: 'device',
  speak(text, { gender, rate, onEnd }) {
    let resolve!: () => void
    const done = new Promise<void>((r) => (resolve = r))
    const u = new SpeechSynthesisUtterance(speakable(text))
    u.lang = 'he-IL'
    const v = deviceVoiceFor(gender)
    if (v) u.voice = v
    u.rate = rate
    u.onend = u.onerror = () => (resolve(), onEnd?.())
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
    return { stop: () => (speechSynthesis.cancel(), resolve()), done }
  },
}

const cloudProvider: SpeechProvider = {
  id: 'cloud',
  speak(text, { gender, rate, onEnd }) {
    const ctl = new AbortController()
    const audio = new Audio()
    let url = ''
    let resolve!: () => void
    const done = new Promise<void>((r) => (resolve = r))
    const finish = () => {
      if (url) URL.revokeObjectURL(url)
      resolve()
      onEnd?.()
    }
    fetch(`${serverBase()}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: speakable(text).slice(0, 2500), voice: gender === 'male' ? 'avri' : 'hila', rate }),
      signal: ctl.signal,
    })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        url = URL.createObjectURL(b)
        audio.src = url
        audio.onended = finish
        audio.onerror = finish
        return audio.play()
      })
      // the server could not speak: fall back to the device voice rather than staying silent
      .catch(() => (ctl.signal.aborted ? finish() : deviceProvider.speak(text, { gender, rate, onEnd: finish })))
    return {
      stop: () => (ctl.abort(), audio.pause(), speechSynthesis?.cancel(), finish()),
      done,
    }
  },
}

/** The best engine on this device right now. */
export async function speechEngine(): Promise<SpeechProvider | null> {
  if ((await serverCaps()).tts) return cloudProvider
  return speechSupported() ? deviceProvider : null
}

let current: Speaking | undefined
/** Speak one text; starting a new one stops the previous, and a playing lesson pauses first. */
export async function say(text: string, o: SpeakOptions): Promise<Speaking | null> {
  const engine = await speechEngine()
  if (!engine) return null
  current?.stop()
  if (player.get().status === 'playing') pausePlayer()
  current = engine.speak(text, o)
  return current
}

export const stopSpeaking = () => (current?.stop(), (current = undefined))
