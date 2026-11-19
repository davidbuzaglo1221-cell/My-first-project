import { books, lessonIndex } from '../content'
import type { Book, Lesson } from '../content/types'
import type { AppState } from './store'

/** How much of one chapter is learned, 0..1: finished by listening or reading counts in full. */
export function chapterLearned(s: AppState, id: string) {
  const p = s.progress[id]
  if (p?.done || s.readDone?.[id]) return 1
  return p && p.dur ? Math.min(0.95, p.pos / p.dur) : 0
}
export const chapterDone = (s: AppState, id: string) => chapterLearned(s, id) >= 1

/** Percent of a book learned, 0..100. */
export function bookPercent(s: AppState, b: Book) {
  if (!b.lessons.length) return 0
  return Math.round((b.lessons.reduce((a, l) => a + chapterLearned(s, l.id), 0) / b.lessons.length) * 100)
}
export const bookStatus = (s: AppState, b: Book): 'new' | 'active' | 'done' => {
  const p = bookPercent(s, b)
  return p >= 100 ? 'done' : p > 0 || s.reading?.[b.id] ? 'active' : 'new'
}

export function libraryStats(s: AppState) {
  const all = books.flatMap((b) => b.lessons)
  const learned = all.reduce((a, l) => a + chapterLearned(s, l.id), 0)
  const done = all.filter((l) => chapterDone(s, l.id)).length
  const booksDone = books.filter((b) => bookPercent(s, b) >= 100).length
  const booksActive = books.filter((b) => bookStatus(s, b) === 'active').length
  return { percent: Math.round((learned / all.length) * 100), chapters: all.length, done, booksDone, booksActive, books: books.length }
}

/* ---------- quizzes, built from the book itself ---------- */

export interface Question {
  id: string
  prompt: string
  options: string[]
  answer: number
  explain: string
  lessonId: string
}

/** Deterministic shuffle so a quiz is stable within a day but varies over time. */
function rng(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296
}
function shuffle<T>(arr: T[], r: () => number) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Three kinds of question per chapter: its core idea, which chapter an idea belongs to, and the practical step. */
function questionsFor(b: Book, l: Lesson, i: number, r: () => number): Question[] {
  const others = b.lessons.filter((x) => x.id !== l.id)
  const pick = (f: (x: Lesson) => string) => shuffle(others, r).map(f).filter((t, k, a) => t && a.indexOf(t) === k).slice(0, 3)
  const qs: Question[] = []
  const make = (kind: string, prompt: string, right: string, wrong: string[], explain: string) => {
    if (wrong.length < 2) return
    const opts = shuffle([right, ...wrong], r)
    qs.push({ id: `${l.id}:${kind}`, prompt, options: opts, answer: opts.indexOf(right), explain, lessonId: l.id })
  }
  make('core', `מה הרעיון המרכזי של הפרק ״${l.title}״?`, l.takeaway, pick((x) => x.takeaway), l.takeaway)
  make('where', `באיזה פרק מופיע הרעיון: ״${l.takeaway}״`, l.title, pick((x) => x.title), `זה הפרק ״${l.title}״, פרק ${i + 1} בספר.`)
  make('do', `איזה תרגיל מעשי מתאים לפרק ״${l.title}״?`, l.exercise.task, pick((x) => x.exercise.task), l.exercise.task)
  return qs
}

export function chapterQuiz(lessonId: string): Question[] {
  const ref = lessonIndex[lessonId]
  if (!ref) return []
  const r = rng(lessonId + new Date().toDateString())
  return questionsFor(ref.book, ref.lesson, ref.index, r)
}

export function bookQuiz(b: Book, count = 10): Question[] {
  const r = rng(b.id + new Date().toDateString())
  const all = b.lessons.flatMap((l, i) => questionsFor(b, l, i, r))
  // one question per chapter first, then fill
  const first = b.lessons.map((l) => all.find((q) => q.lessonId === l.id && !q.id.endsWith(':do'))).filter(Boolean) as Question[]
  const rest = shuffle(all.filter((q) => !first.includes(q)), r)
  return shuffle([...first, ...rest].slice(0, count), r)
}

/* ---------- memory cards ---------- */

/** Cards due now: chapters you have learned, on a spaced schedule. */
export function dueCards(s: AppState, now = Date.now()) {
  return books
    .flatMap((b) => b.lessons.map((l) => ({ b, l })))
    .filter(({ l }) => chapterDone(s, l.id) && (s.cards?.[l.id]?.due ?? 0) <= now)
}
