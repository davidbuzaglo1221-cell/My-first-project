import { useSyncExternalStore } from 'react'
import { BASE_CPS, bookById, lessonIndex } from '../content'
import audioManifest from '../content/audioManifest.json'
import { getFile } from '../lib/idb'
import { addListening, completeLesson, setLessonPosition, store } from '../lib/store'
import { offsets, toSegments } from './sentences'
import { pickVoice, speechSupported } from './voices'

export type TrackKind = 'lesson' | 'quick' | 'file'

/** Studio narration rendered ahead of time: duration and the start time of every sentence. */
const narrated = audioManifest as Record<string, { d: number; s: number[] }>
export const hasNarration = (id: string) => !!narrated[id]

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
  if (id.endsWith('-quick')) {
    const book = bookById[id.slice(0, -6)]
    if (!book) return
    const script = [
      `${book.title}, מאת ${book.author}. ${book.tagline}`,
      ...book.ideas.map((i) => `${i.title}. ${i.body}`),
      'זה הסיכום בדקה. כשיהיה לך זמן, השיעורים המלאים מחכים לך.',
    ].join('\n')
    return { id, kind: 'quick', title: 'הספר בדקה', subtitle: book.title, author: book.author, bookId: book.id, script, src: narrated[id] ? `audio/${id}.mp3` : undefined }
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
    script: ref.lesson.script,
    src: ref.lesson.audioUrl ?? (narrated[id] ? `audio/${id}.mp3` : undefined),
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

const SILENCE = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

function ensureAudio() {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'auto'
    audio.addEventListener('loadedmetadata', () => emit({ duration: audio!.duration || snap.duration }))
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
    position = audio.currentTime
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
  if (!t || t.kind === 'quick') return
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
    a.src = src!
    a.playbackRate = rate
    ;(a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true
    const n = narrated[id]
    const segments = n && track.script ? toSegments(track.script) : []
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
      if (from > 0 && from < (a.duration || Infinity) - 1) a.currentTime = from
    }
    if (a.readyState >= 1) seekWhenReady()
    else a.addEventListener('loadedmetadata', seekWhenReady, { once: true })
  } else {
    const segments = toSegments(track.script ?? '')
    const o = offsets(segments)
    starts = o.starts
    totalChars = o.total
    const hasVoice = speechSupported() && !!pickVoice(store.get().settings.voiceURI)
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
      notice: hasVoice ? undefined : 'לא נמצא קול עברי במכשיר, ולכן השיעור מוצג ככתוביות מתוזמנות. אפשר להתקין קול עברי בהגדרות המכשיר.',
      endedId: undefined,
    })
  }
  if (track.kind !== 'quick') store.set({ lastTrack: id })
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
  const position = snap.mode === 'file' ? audio?.currentTime ?? snap.position : voicePosition()
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
    if (audio) audio.currentTime = target
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
  if (!t) return
  gen++
  clearInterval(ticker)
  stopKeepAlive()
  emit({ status: 'ended', position: snap.duration, endedId: t.id })
  if (t.kind === 'lesson') completeLesson(t.id, snap.duration)
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
      album: 'ASCEND',
      artwork: art ? [{ src: art, sizes: '512x512', type: 'image/png' }] : [],
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
    set('previoustrack', () => skip(-skipBy))
    set('nexttrack', () => skip(skipBy))
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
if (typeof window !== 'undefined') (window as unknown as { __ascend: unknown }).__ascend = { player, load, play, pause, seek, skip, setRate, store }
