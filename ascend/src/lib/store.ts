import { useSyncExternalStore } from 'react'
import type { CategoryId } from '../content/types'
import { dayKey } from './dates'

export interface LessonProgress {
  pos: number
  dur: number
  done: boolean
  doneAt?: number
  last: number
}

export interface Habit {
  id: string
  text: string
  lessonId?: string
  createdAt: number
  checks: string[]
  archived?: boolean
}

export interface JournalEntry {
  id: string
  lessonId: string
  prompt: string
  text: string
  at: number
}

export interface AudioFileMeta {
  id: string
  title: string
  author: string
  size: number
  addedAt: number
}

export interface Settings {
  voiceURI?: string
  rate: number
  autoContinue: boolean
  skip: number
}

export interface Note {
  id: string
  text: string
  bookId?: string
  lessonId?: string
  /** A quoted paragraph the note is about (a highlight). */
  quote?: string
  para?: number
  kind: 'note' | 'love'
  at: number
}

export interface Reminder {
  id: string
  text: string
  /** "HH:MM", daily */
  time: string
  days: number[]
  on: boolean
  kind: 'learn' | 'breathe' | 'posture' | 'custom'
}

export interface Memo {
  id: string
  title: string
  bookId?: string
  seconds: number
  at: number
}

export interface AppState {
  v: 1
  onboarded: boolean
  name: string
  goals: CategoryId[]
  dailyGoalMin: number
  assessment: Partial<Record<CategoryId, number>>
  initialAssessment: Partial<Record<CategoryId, number>>
  settings: Settings
  progress: Record<string, LessonProgress>
  log: Record<string, number>
  habits: Habit[]
  journal: JournalEntry[]
  actions: Record<string, number>
  saved: string[]
  activePathId?: string
  achievements: Record<string, number>
  lastTrack?: string
  cps?: number
  files: AudioFileMeta[]
  /** Narrator chosen on the voice screen. */
  narrator?: string
  /** Where the reader stopped in each book. */
  reading?: Record<string, { ch: number; y: number; last: number }>
  readerPrefs?: { size: number; paper: 'night' | 'ivory' }
  /** Chapters read to the end in the reader. */
  readDone?: Record<string, number>
  notes?: Note[]
  reminders?: Reminder[]
  memos?: Memo[]
  /** Best quiz score per quiz id (0..1). */
  quiz?: Record<string, { best: number; last: number; at: number }>
  /** Memory cards: Leitner box and next due time per chapter. */
  cards?: Record<string, { box: number; due: number }>
  /** Minutes of practice in the calm space, per day. */
  calm?: Record<string, number>
  /** Thirty-day program: the day each program day was completed (day key). */
  program?: Record<string, string>
  /** Your day: the day the idea of the day was opened, and the daily reminder time (HH:MM) once set. */
  daily?: { idea?: string; remindAt?: string }
}

const KEY = 'ascend:v1'

export const initialState = (): AppState => ({
  v: 1,
  onboarded: false,
  name: '',
  goals: [],
  dailyGoalMin: 10,
  assessment: {},
  initialAssessment: {},
  settings: { rate: 1, autoContinue: true, skip: 15 },
  progress: {},
  log: {},
  habits: [],
  journal: [],
  actions: {},
  saved: [],
  achievements: {},
  files: [],
})

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initialState()
    const parsed = JSON.parse(raw)
    const base = initialState()
    return { ...base, ...parsed, settings: { ...base.settings, ...parsed.settings } }
  } catch {
    return initialState()
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | undefined

function persistNow() {
  clearTimeout(saveTimer)
  saveTimer = undefined
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable: keep in memory */
  }
}

export const store = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  set(update: Partial<AppState> | ((s: AppState) => Partial<AppState>), opts: { immediate?: boolean } = {}) {
    const patch = typeof update === 'function' ? update(state) : update
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
    if (opts.immediate) persistNow()
    else if (!saveTimer) saveTimer = setTimeout(persistNow, 1200)
  },
  flush: persistNow,
  replace(next: AppState) {
    state = { ...initialState(), ...next }
    listeners.forEach((l) => l())
    persistNow()
  },
  reset() {
    state = initialState()
    listeners.forEach((l) => l())
    persistNow()
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', persistNow)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persistNow())
}

export function useStore<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(state), () => select(state))
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/* ---------- actions ---------- */

export function addListening(seconds: number) {
  const k = dayKey()
  store.set((s) => ({ log: { ...s.log, [k]: (s.log[k] ?? 0) + seconds } }))
}

export function setLessonPosition(id: string, pos: number, dur: number) {
  store.set((s) => {
    const prev = s.progress[id]
    return { progress: { ...s.progress, [id]: { ...prev, done: prev?.done ?? false, pos, dur, last: Date.now() } }, lastTrack: id }
  })
}

export function completeLesson(id: string, dur: number) {
  store.set(
    (s) => {
      const prev = s.progress[id]
      return {
        progress: { ...s.progress, [id]: { ...prev, pos: 0, dur, done: true, doneAt: prev?.doneAt ?? Date.now(), last: Date.now() } },
      }
    },
    { immediate: true },
  )
}

export function toggleSaved(bookId: string) {
  store.set((s) => ({ saved: s.saved.includes(bookId) ? s.saved.filter((x) => x !== bookId) : [...s.saved, bookId] }), { immediate: true })
}

export function addHabit(text: string, lessonId?: string) {
  const existing = store.get().habits.find((h) => h.text === text && !h.archived)
  if (existing) return existing.id
  const id = uid()
  store.set((s) => ({ habits: [...s.habits, { id, text, lessonId, createdAt: Date.now(), checks: [] }] }), { immediate: true })
  return id
}

export function toggleHabitToday(id: string) {
  const k = dayKey()
  store.set(
    (s) => ({
      habits: s.habits.map((h) => (h.id !== id ? h : { ...h, checks: h.checks.includes(k) ? h.checks.filter((c) => c !== k) : [...h.checks, k] })),
    }),
    { immediate: true },
  )
}

export function archiveHabit(id: string) {
  store.set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, archived: true } : h)) }), { immediate: true })
}

export function markActionDone(lessonId: string, done = true) {
  store.set(
    (s) => {
      const actions = { ...s.actions }
      if (done) actions[lessonId] = Date.now()
      else delete actions[lessonId]
      return { actions }
    },
    { immediate: true },
  )
}

export function saveJournal(lessonId: string, prompt: string, text: string) {
  if (!text.trim()) return
  store.set(
    (s) => {
      const others = s.journal.filter((j) => !(j.lessonId === lessonId && j.prompt === prompt))
      return { journal: [{ id: uid(), lessonId, prompt, text: text.trim(), at: Date.now() }, ...others] }
    },
    { immediate: true },
  )
}

export function updateSettings(patch: Partial<Settings>) {
  store.set((s) => ({ settings: { ...s.settings, ...patch } }), { immediate: true })
}

/* ---------- notebook, quizzes, cards, reminders ---------- */

export function addNote(n: Omit<Note, 'id' | 'at'>) {
  const id = uid()
  store.set((s) => ({ notes: [{ ...n, id, at: Date.now() }, ...(s.notes ?? [])] }), { immediate: true })
  return id
}
export function updateNote(id: string, text: string) {
  store.set((s) => ({ notes: (s.notes ?? []).map((n) => (n.id === id ? { ...n, text } : n)) }), { immediate: true })
}
export function deleteNote(id: string) {
  store.set((s) => ({ notes: (s.notes ?? []).filter((n) => n.id !== id) }), { immediate: true })
}
export function toggleLove(bookId: string, lessonId: string, para: number, quote: string) {
  const ex = (store.get().notes ?? []).find((n) => n.kind === 'love' && n.lessonId === lessonId && n.para === para)
  if (ex) return deleteNote(ex.id), false
  addNote({ kind: 'love', bookId, lessonId, para, quote, text: '' })
  return true
}
export function markRead(lessonId: string) {
  if (store.get().readDone?.[lessonId]) return
  store.set((s) => ({ readDone: { ...s.readDone, [lessonId]: Date.now() } }), { immediate: true })
}
export function saveQuiz(id: string, score: number) {
  store.set((s) => {
    const prev = s.quiz?.[id]
    return { quiz: { ...s.quiz, [id]: { best: Math.max(prev?.best ?? 0, score), last: score, at: Date.now() } } }
  }, { immediate: true })
}
const BOX_DAYS = [0, 1, 3, 7, 16, 35]
export function gradeCard(lessonId: string, knew: boolean) {
  store.set((s) => {
    const prev = s.cards?.[lessonId] ?? { box: 0, due: 0 }
    const box = knew ? Math.min(5, prev.box + 1) : 1
    return { cards: { ...s.cards, [lessonId]: { box, due: Date.now() + BOX_DAYS[box] * 86400000 } } }
  }, { immediate: true })
}
export function saveReminder(r: Reminder) {
  store.set((s) => {
    const list = s.reminders ?? []
    return { reminders: list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r] }
  }, { immediate: true })
}
export function deleteReminder(id: string) {
  store.set((s) => ({ reminders: (s.reminders ?? []).filter((r) => r.id !== id) }), { immediate: true })
}
export function addMemo(m: Memo) {
  store.set((s) => ({ memos: [m, ...(s.memos ?? [])] }), { immediate: true })
}
export function deleteMemo(id: string) {
  store.set((s) => ({ memos: (s.memos ?? []).filter((m) => m.id !== id) }), { immediate: true })
}
/** The idea of the day was opened. */
export function markDailyIdea() {
  store.set((s) => ({ daily: { ...s.daily, idea: dayKey() } }), { immediate: true })
}

/** A program day was heard to the end. */
export function completeProgramDay(id: string) {
  store.set((s) => ({ program: { ...s.program, [id]: s.program?.[id] ?? dayKey() } }), { immediate: true })
}

export function addCalm(minutes: number) {
  const k = dayKey()
  store.set((s) => ({ calm: { ...s.calm, [k]: (s.calm?.[k] ?? 0) + minutes } }), { immediate: true })
}
