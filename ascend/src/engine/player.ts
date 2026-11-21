import { useSyncExternalStore } from 'react'
import { BASE_CPS, bookById, lessonIndex, spokenIdeas, spokenScript } from '../content'
import audioManifest from '../content/audioManifest.json'
import { getFile } from '../lib/idb'
import { calmLines, meditationById } from '../content/calm'
import { addCalm, addListening, completeLesson, setLessonPosition, store } from '../lib/store'
import { offsets, toSegments } from './sentences'
import { pickVoice, speechSupported } from './voices'

export type TrackKind = 'lesson' | 'quick' | 'file' | 'calm'

/** Studio narration rendered ahead of time: duration and the start time of every sentence. */
/** f/o: the chapter lives inside one file per book (f), starting at o seconds. */
type Narration = Record<string, { d: number; s: number[]; f?: string; o?: number }>
const byVoice = audioManifest as Record<string, Narration>
export const DEFAULT_VOICE = 'maya'
/** Earlier narrators map to the voice that replaced them (same gender, same role). */
const RENAMED: Record<string, string> = { avri: 'yoav', hila: 'maya' }
/** The narrator the listener chose on the voice screen, if that voice is rendered. */
export const currentVoice = () => {
  const raw = store.get().narrator
  const v = raw && RENAMED[raw] ? RENAMED[raw] : raw
  return v && byVoice[v] ? v : byVoice[DEFAULT_VOICE] ? DEFAULT_VOICE : Object.keys(byVoice).find((k) => k !== 'calm')
}
/** The chosen voice, or the main narrator when the chosen voice has no recording of this track. */
const voiceFor = (id: string) => {
  const v = currentVoice()
  if (v && byVoice[v]?.[id]) return v
  if (byVoice[DEFAULT_VOICE]?.[id]) return DEFAULT_VOICE
  // Any narrator that recorded this track beats silent captions.
  return Object.keys(byVoice).find((k) => k !== 'calm' && byVoice[k][id])
}
const narrationFor = (id: string) => {
  if (id.startsWith('calm:')) return byVoice.calm?.[id.slice(5)]
  const v = voiceFor(id)
  return v ? byVoice[v][id] : undefined
}
const narrationSrc = (id: string) => (id.startsWith('calm:') ? `audio/calm/${id.slice(5)}.mp3` : `audio/${voiceFor(id)}/${narrationFor(id)?.f ?? id}.mp3`)
export const hasNarration = (id: string) => !!narrationFor(id)

export interface Track {
  id: string
  kind: TrackKind
  title: string
  subtitle: string
  author: string
  bookId?: string
  script?: string
  src?: string
}

export type Mode = 'voice' | 'file' | 'captions'
export type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'ended'

export interface Snapshot {
  track?: Track
  status: Status
  position: number
  duration: number
  rate: number
  mode: Mode
  segment: number
  segments: string[]
  sleepAt?: number
  sleepEndOfTrack?: boolean
  notice?: string
  endedId?: string
}

/* ---------- track resolution ---------- */

export function trackFor(id: string): Track | undefined {
  if (id.startsWith('file:')) {
    const meta = store.get().files.find((f) => `file:${f.id}` === id)
    if (!meta) return
    return { id, kind: 'file', title: meta.title, subtitle: 'האודיו שלי', author: meta.author }
  }
  if (id.startsWith('calm:')) {
    const m = meditationById[id.slice(5)]
    if (!m) return
    return { id, kind: 'calm', title: m.title, subtitle: 'מהישרדות לחופש', author: 'מדיטציה מודרכת', script: calmLines(m).join('\n'), src: narrationFor(id) ? narrationSrc(id) : undefined }
  }
  if (id.endsWith('-quick')) {
    const book = bookById[id.slice(0, -6)]
    if (!book) return
    const script = [
      `${book.title}, מאת ${book.author}. ${book.tagline}`,
      ...book.ideas.map((i) => `${i.title}. ${i.body}`),
      'זה הסיכום בדקה. כשיהיה לך זמן, הספר המלא מחכה לך כאן, פרק אחר פרק.',
    ].join('\n')
    return { id, kind: 'quick', title: 'הספר בדקה', subtitle: book.title, author: book.author, bookId: book.id, script, src: narrationFor(id) ? narrationSrc(id) : undefined }
  }
  const ref = lessonIndex[id]
  if (!ref) return
  return {
    id,
    kind: 'lesson',
    title: ref.lesson.title,
    subtitle: ref.book.title,
    author: ref.book.author,
    bookId: ref.book.id,
    script: spokenScript(ref.lesson),
    src: ref.lesson.audioUrl ?? (narrationFor(id) ? narrationSrc(id) : undefined),
  }
}

/* ---------- state ---------- */

let snap: Snapshot = { status: 'idle', position: 0, duration: 0, rate: store.get().settings.rate, mode: 'voice', segment: 0, segments: [] }
const subs = new Set<() => void>()
const emit = (patch: Partial<Snapshot>) => {
  snap = { ...snap, ...patch }
  subs.forEach((f) => f())
}
export const player = {
  get: () => snap,
  subscribe: (f: () => void) => {
    subs.add(f)
    return () => subs.delete(f)
  },
}
export const usePlayer = () => useSyncExternalStore(player.subscribe, player.get, player.get)

/* ---------- voice timing ---------- */

let starts: number[] = []
let totalChars = 0
let cps = store.get().cps ?? BASE_CPS
const segStart = (i: number) => (starts[i] ?? totalChars) / cps
const segDur = (i: number) => ((starts[i + 1] ?? totalChars) - (starts[i] ?? 0)) / cps

let gen = 0
let segBeganAt = 0
let segBaseChars = 0
let started = false
let lastTick = 0
let lastSave = 0
let ticker: ReturnType<typeof setInterval> | undefined
let audio: HTMLAudioElement | undefined
let keepAlive: HTMLAudioElement | undefined
let objectUrl: string | undefined
let fileTimes: number[] = []
/** Where the current chapter starts inside its book file, and whether its length comes from the manifest. */
let base = 0
let fixedDur = false
const filePos = () => (audio ? Math.max(0, audio.currentTime - base) : 0)

const SILENCE = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

function ensureAudio() {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'auto'
    audio.addEventListener('loadedmetadata', () => !fixedDur && emit({ duration: audio!.duration || snap.duration }))
    audio.addEventListener('ended', () => finish())
    audio.addEventListener('error', () => snap.mode === 'file' && emit({ status: 'paused', notice: 'לא הצלחנו לנגן את קובץ האודיו.' }))
  }
  return audio
}

function startKeepAlive() {
  if (typeof navigator === 'undefined' || !navigator.maxTouchPoints) return
  if (!keepAlive) {
    keepAlive = new Audio(SILENCE)
    keepAlive.loop = true
  }
  keepAlive.play().catch(() => {})
}
const stopKeepAlive = () => keepAlive?.pause()

function voicePosition() {
  if (snap.status !== 'playing') return snap.position
  const i = snap.segment
  const elapsed = started ? ((performance.now() - segBeganAt) / 1000) * snap.rate : 0
  return Math.min(segStart(i) + segBaseChars / cps + elapsed, segStart(i) + segDur(i))
}

function speakSegment(i: number) {
  const my = ++gen
  started = false
  segBaseChars = 0
  emit({ segment: i, position: segStart(i) })

  if (snap.mode === 'captions') {
    segBeganAt = performance.now()
    started = true
    return
  }

  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(snap.segments[i])
  u.lang = 'he-IL'
  const v = pickVoice(store.get().settings.voiceURI)
  if (v) u.voice = v
  u.rate = snap.rate
  u.onstart = () => {
    if (my !== gen) return
    started = true
    segBeganAt = performance.now()
  }
  u.onboundary = (e) => {
    if (my !== gen || !e.charIndex) return
    segBaseChars = e.charIndex
    segBeganAt = performance.now()
    started = true
  }
  u.onend = () => {
    if (my !== gen) return
    if (started) {
      const real = (performance.now() - segBeganAt) / 1000 + segBaseChars / cps / snap.rate
      const chars = snap.segments[i].length
      if (real > 1.2) {
        const measured = chars / (real * snap.rate)
        if (measured > 7 && measured < 28) {
          cps = cps * 0.8 + measured * 0.2
          store.set({ cps })
        }
      }
    }
    next(i)
  }
  u.onerror = (e) => {
    if (my !== gen || e.error === 'interrupted' || e.error === 'canceled') return
    next(i)
  }
  // A tiny delay after cancel() keeps Chrome and Safari from dropping the utterance.
  setTimeout(() => my === gen && speechSynthesis.speak(u), 30)
  segBeganAt = performance.now()
}

function next(i: number) {
  if (i + 1 >= snap.segments.length) finish()
  else speakSegment(i + 1)
}

function tick() {
  const now = performance.now()
  const dt = Math.min(2, (now - lastTick) / 1000)
  lastTick = now
  if (snap.status !== 'playing') return

  let position = snap.position
  if (snap.mode === 'file' && audio) {
    position = filePos()
    if (fixedDur && snap.duration && position >= snap.duration - 0.05) {
      audio.pause()
      return finish()
    }
    if (fileTimes.length) {
      let i = 0
      while (i + 1 < fileTimes.length && fileTimes[i + 1] <= position + 0.05) i++
      if (i !== snap.segment) emit({ segment: i })
    }
  } else {
    position = voicePosition()
    const i = snap.segment
    const real = (now - segBeganAt) / 1000
    if (snap.mode === 'captions' && position >= segStart(i) + segDur(i) - 0.02) return next(i)
    // Watchdog: an engine that never starts or never ends.
    if (snap.mode === 'voice' && !started && real > 4 && i === 0 && snap.position < 1) {
      emit({ mode: 'captions', notice: 'הקול במכשיר לא הגיב, ולכן ההאזנה מוצגת ככתוביות. אפשר לבחור קול בהגדרות.' })
      speechSynthesis.cancel()
      return speakSegment(i)
    }
    if (snap.mode === 'voice' && real > (segDur(i) / snap.rate) * 2.5 + 5) return next(i)
  }

  emit({ position })
  if (dt > 0) addListening(dt)
  if (snap.sleepAt && Date.now() >= snap.sleepAt) {
    pause()
    emit({ sleepAt: undefined, notice: 'טיימר השינה עצר את ההאזנה.' })
  }
  if (now - lastSave > 5000) {
    lastSave = now
    persistPosition()
  }
  updatePositionState()
}

function persistPosition() {
  const t = snap.track
  if (!t || t.kind === 'quick' || t.kind === 'calm') return
  setLessonPosition(t.id, snap.position, snap.duration)
}

function startTicker() {
  lastTick = performance.now()
  clearInterval(ticker)
  ticker = setInterval(tick, 250)
}

/* ---------- public controls ---------- */

export async function load(id: string, opts: { autoplay?: boolean; from?: number } = {}) {
  const track = trackFor(id)
  if (!track) return
  stopInternal()
  const saved = store.get().progress[id]
  const from = opts.from ?? (saved && !saved.done ? saved.pos : 0)
  const rate = store.get().settings.rate

  if (track.kind === 'file' || track.src) {
    let src = track.src
    if (track.kind === 'file') {
      const blob = await getFile(id.slice(5))
      if (!blob) return emit({ notice: 'הקובץ לא נמצא במכשיר.' })
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      objectUrl = URL.createObjectURL(blob)
      src = objectUrl
    }
    const a = ensureAudio()
    const n0 = track.kind === 'file' ? undefined : narrationFor(id)
    base = n0?.o ?? 0
    fixedDur = !!n0
    // Chapters of the same book share one file: switching chapters only moves the playhead.
    if (new URL(src!, location.href).href !== a.src) a.src = src!
    a.playbackRate = rate
    ;(a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true
    const n = narrationFor(id)
    const segments = n && track.script ? (track.kind === 'calm' ? track.script.split('\n') : toSegments(track.script)) : []
    fileTimes = n && segments.length === n.s.length ? n.s : []
    emit({
      track,
      mode: 'file',
      segments: fileTimes.length ? segments : [],
      segment: 0,
      status: 'paused',
      position: from,
      duration: n?.d ?? saved?.dur ?? 0,
      rate,
      notice: undefined,
      endedId: undefined,
    })
    const seekWhenReady = () => {
      if (from < (n?.d ?? a.duration ?? Infinity) - 1) a.currentTime = base + from
    }
    if (a.readyState >= 1) seekWhenReady()
    else a.addEventListener('loadedmetadata', seekWhenReady, { once: true })
  } else {
    const segments = toSegments(track.script ?? '')
    const o = offsets(segments)
    starts = o.starts
    totalChars = o.total
    // The device's speech engine sounds robotic, so it is never used: unrecorded lessons show guided captions only.
    const hasVoice = false
    const duration = totalChars / cps
    let segment = 0
    while (segment + 1 < segments.length && segStart(segment + 1) <= from) segment++
    emit({
      track,
      mode: hasVoice ? 'voice' : 'captions',
      segments,
      segment,
      status: 'paused',
      position: from > 0 ? segStart(segment) : 0,
      duration,
      rate,
      notice: hasVoice ? undefined : 'השיעור הזה עוד בהקלטה באולפן. בינתיים הוא מוצג ככתוביות מתוזמנות.',
      endedId: undefined,
    })
  }
  if (track.kind !== 'quick' && track.kind !== 'calm') store.set({ lastTrack: id })
  setMediaSession(track)
  if (opts.autoplay) play()
}

export function play() {
  if (!snap.track) {
    const last = store.get().lastTrack
    if (last) load(last, { autoplay: true })
    return
  }
  if (snap.status === 'ended') return seek(0, true)
  emit({ status: 'playing', endedId: undefined })
  startTicker()
  if (snap.mode === 'file') {
    ensureAudio()
      .play()
      .catch(() => emit({ status: 'paused', notice: 'הדפדפן חסם ניגון אוטומטי. לחץ שוב על הפעלה.' }))
  } else {
    if (snap.mode === 'voice') startKeepAlive()
    speakSegment(snap.segment)
  }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
}

export function pause() {
  if (snap.status !== 'playing') return
  const position = snap.mode === 'file' ? (audio ? filePos() : snap.position) : voicePosition()
  gen++
  if (snap.mode === 'file') audio?.pause()
  else if (speechSupported()) speechSynthesis.cancel()
  stopKeepAlive()
  clearInterval(ticker)
  emit({ status: 'paused', position: snap.mode === 'file' ? position : segStart(snap.segment) })
  persistPosition()
  store.flush()
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
}

export const toggle = () => (snap.status === 'playing' ? pause() : play())

export function seek(t: number, andPlay = snap.status === 'playing') {
  const target = Math.max(0, Math.min(t, snap.duration || 0))
  if (snap.mode === 'file') {
    if (audio) audio.currentTime = base + target
    emit({ position: target, status: andPlay ? 'playing' : snap.status === 'ended' ? 'paused' : snap.status })
    if (andPlay && audio?.paused) play()
    return
  }
  let i = 0
  while (i + 1 < snap.segments.length && segStart(i + 1) <= target + 0.05) i++
  gen++
  if (speechSupported()) speechSynthesis.cancel()
  emit({ segment: i, position: segStart(i), status: snap.status === 'ended' ? 'paused' : snap.status })
  if (andPlay) {
    emit({ status: 'playing' })
    startTicker()
    speakSegment(i)
  }
  persistPosition()
}

export const skip = (delta: number) => {
  // In narrated mode a small backward skip should land on the previous sentence, not restart the current one.
  if (snap.mode !== 'file' && delta < 0 && snap.position - segStart(snap.segment) < 2.5) return seek(segStart(Math.max(0, snap.segment - 1)) + 0.01)
  seek(snap.position + delta)
}

export const jumpToSegment = (i: number) => seek((snap.mode === 'file' && fileTimes.length ? fileTimes[i] : segStart(i)) + 0.01, true)

export function setRate(rate: number) {
  store.set((s) => ({ settings: { ...s.settings, rate } }), { immediate: true })
  emit({ rate })
  if (snap.mode === 'file' && audio) audio.playbackRate = rate
  else if (snap.status === 'playing' && snap.mode === 'voice') speakSegment(snap.segment)
}

export function setSleep(minutes: number | 'end' | null) {
  if (minutes === null) emit({ sleepAt: undefined, sleepEndOfTrack: false })
  else if (minutes === 'end') emit({ sleepAt: undefined, sleepEndOfTrack: true })
  else emit({ sleepAt: Date.now() + minutes * 60000, sleepEndOfTrack: false })
}

export const dismissNotice = () => emit({ notice: undefined })

function stopInternal() {
  gen++
  if (speechSupported()) speechSynthesis.cancel()
  audio?.pause()
  stopKeepAlive()
  clearInterval(ticker)
}

function finish() {
  const t = snap.track
  if (!t || snap.status === 'ended') return
  gen++
  clearInterval(ticker)
  stopKeepAlive()
  emit({ status: 'ended', position: snap.duration, endedId: t.id })
  if (t.kind === 'lesson') completeLesson(t.id, snap.duration)
  if (t.kind === 'calm') addCalm(Math.round(snap.duration / 60))
  if (t.kind === 'file') setLessonPosition(t.id, 0, snap.duration)
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'

  const s = store.get()
  if (t.kind === 'lesson' && s.settings.autoContinue && !snap.sleepEndOfTrack) {
    const ref = lessonIndex[t.id]
    const nextLesson = ref?.book.lessons[ref.index + 1]
    if (nextLesson) setTimeout(() => load(nextLesson.id, { autoplay: true, from: 0 }), 1600)
  }
  if (snap.sleepEndOfTrack) emit({ sleepEndOfTrack: false })
}

export function stop() {
  pause()
  emit({ track: undefined, status: 'idle', position: 0, duration: 0, segments: [] })
}

/* ---------- media session (lock screen, headphones, car) ---------- */

let artworkFor: ((t: Track) => Promise<string> | undefined) | undefined
export const registerArtwork = (fn: (t: Track) => Promise<string> | undefined) => (artworkFor = fn)

function setMediaSession(t: Track, art?: string) {
  if (!('mediaSession' in navigator)) return
  if (art === undefined) artworkFor?.(t)?.then((png) => png && snap.track?.id === t.id && setMediaSession(t, png))
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: `${t.subtitle} · ${t.author}`,
      album: 'הספריה',
      artwork: art ? [{ src: art, sizes: '512x512', type: art.endsWith('.jpg') ? 'image/jpeg' : 'image/png' }] : [],
    })
    const skipBy = store.get().settings.skip
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(a, h)
      } catch {
        /* unsupported action */
      }
    }
    set('play', () => play())
    set('pause', () => pause())
    set('seekbackward', (d) => skip(-(d.seekOffset ?? skipBy)))
    set('seekforward', (d) => skip(d.seekOffset ?? skipBy))
    set('seekto', (d) => d.seekTime != null && seek(d.seekTime))
    set('previoustrack', () => previousChapter())
    set('nexttrack', () => nextChapter())
  } catch {
    /* ignore */
  }
}

function updatePositionState() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !snap.duration) return
  try {
    navigator.mediaSession.setPositionState({ duration: snap.duration, position: Math.min(snap.position, snap.duration), playbackRate: snap.rate })
  } catch {
    /* ignore */
  }
}

/** Test and automation hook. */
if (typeof window !== 'undefined') (window as unknown as { __ascend: unknown }).__ascend = { player, load, play, pause, seek, skip, setRate, store, books: Object.values(bookById) }

/** Switch narrator: the current lesson continues from the same point in the new voice. */
export function setNarrator(voice: string) {
  store.set({ narrator: voice }, { immediate: true })
  const t = snap.track
  if (!t || t.kind === 'file') return
  const ratio = snap.duration ? snap.position / snap.duration : 0
  const wasPlaying = snap.status === 'playing'
  const n = narrationFor(t.id)
  load(t.id, { autoplay: wasPlaying, from: n ? ratio * n.d : snap.position })
}

/** Where a paragraph of a chapter begins in its narration, in seconds (0 when unknown). */
export function paragraphStart(id: string, para: number) {
  const ref = lessonIndex[id]
  const n = narrationFor(id)
  if (!ref || !n) return 0
  // Reader paragraphs: the text, then one per key idea. Narration reads each idea as heading + explanation.
  const text = ref.lesson.script.split(/\n+/)
  const spoken = [...text, ...spokenIdeas(ref.lesson)]
  const at = para < text.length ? para : text.length + 2 * (para - text.length)
  const seg = spoken.slice(0, at).reduce((a, p) => a + toSegments(p).length, 0)
  return n.s[seg] ?? 0
}

/** The chapters around the current one, for next/previous and "up next". */
export function neighbours(id?: string) {
  const ref = id ? lessonIndex[id] : undefined
  if (!ref) return { prev: undefined, next: undefined, upNext: [] as string[] }
  const ls = ref.book.lessons
  return { prev: ls[ref.index - 1]?.id, next: ls[ref.index + 1]?.id, upNext: ls.slice(ref.index + 1).map((l) => l.id) }
}
/** Apple-style previous: restart the chapter, or go to the previous one when already near its start. */
export function previousChapter() {
  const t = snap.track
  if (!t) return
  const { prev } = neighbours(t.id)
  if (snap.position > 4 || !prev) return seek(0, snap.status === 'playing')
  load(prev, { autoplay: true, from: 0 })
}
export function nextChapter() {
  const t = snap.track
  if (!t) return
  const { next: n } = neighbours(t.id)
  if (n) load(n, { autoplay: true, from: 0 })
}
