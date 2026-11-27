/**
 * "Your day": something new every day, the same for everyone on the same date (so reminders and the app agree).
 * An idea from the library's key ideas, a small real-life challenge, the next program day, and today's progress.
 */
import { books } from '../content'
import { programDays } from '../content/program'
import { dayKey } from './dates'
import type { AppState as State } from './store'

export interface DailyIdea {
  bookId: string
  bookTitle: string
  lessonId: string
  chapter: number
  h: string
  t: string
}

const IDEAS: DailyIdea[] = books.flatMap((b) =>
  b.lessons.flatMap((l, i) => (l.ideas ?? []).map((x) => ({ bookId: b.id, bookTitle: b.title, lessonId: l.id, chapter: i, h: x.h, t: x.t }))),
)
const STEPS = books.flatMap((b) => b.lessons.flatMap((l) => (l.steps ?? []).map((s) => ({ bookTitle: b.title, lessonId: l.id, text: s }))))

/** Days since a fixed epoch, in local time. */
export const dayNumber = (d: Date = new Date()) => Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(2026, 0, 1).getTime()) / 86400000)

const BY_BOOK = Object.values(IDEAS.reduce<Record<string, DailyIdea[]>>((a, x) => ((a[x.bookId] ??= []).push(x), a), {}))
const mod = (a: number, n: number) => ((a % n) + n) % n
// A different book every day (a stride co-prime with the number of books), and a different idea within it each visit.
export const ideaOfDay = (d: Date = new Date()) => {
  const n = dayNumber(d)
  const book = BY_BOOK[mod(n * 7, BY_BOOK.length)]
  return book[mod(Math.floor(n / BY_BOOK.length) * 5 + n, book.length)]
}
export const challengeOfDay = (d: Date = new Date()) => STEPS[((dayNumber(d) * 211 + 17) % STEPS.length + STEPS.length) % STEPS.length]

/** The next program day to do: the first one not yet heard to the end. */
export function nextProgramDay(s: Pick<State, 'program'>) {
  const done = s.program ?? {}
  const i = programDays.findIndex((d) => !done[d.id])
  return { index: i === -1 ? programDays.length - 1 : i, day: programDays[i === -1 ? programDays.length - 1 : i], doneCount: Object.keys(done).length, finished: i === -1 }
}

export interface TodayChecks {
  practice: boolean
  chapter: boolean
  idea: boolean
}

/** What you already did today: a program day or meditation, a chapter, and the idea of the day. */
export function todayChecks(s: State, d: Date = new Date()): TodayChecks {
  const k = dayKey(d)
  const practice = Object.values(s.program ?? {}).includes(k) || (s.calm?.[k] ?? 0) > 0
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const chapter = Object.values(s.progress).some((p) => p.done && (p.last ?? 0) >= start) || Object.entries(s.readDone ?? {}).some(([, t]) => typeof t === 'number' && t >= start)
  const idea = s.daily?.idea === k
  return { practice, chapter, idea }
}
