/**
 * The coach's judgement: what it notices from your real data, and how commitments live.
 * Everything here reads only what you did in the app. No invented praise, no guilt.
 */
import { categoryById, lessonIndex } from '../content'
import { coachSessionById } from '../content/coach'
import { addDays, dayKey } from './dates'
import { isActiveDay } from './insights'
import { store, type AppState, type CoachState, type Commitment } from './store'

const DAY = 86400000
const EMPTY: CoachState = {}

export const coachOf = (s: AppState): CoachState => s.coach ?? EMPTY
export const openCommits = (s: AppState) => (coachOf(s).commits ?? []).filter((c) => c.status === 'open')

export interface CoachNote {
  id: string
  text: string
  /** What the note offers to do. */
  action?: { label: string; to?: string; commit?: string }
}

const daysAgo = (t: number, now: number) => Math.floor((now - t) / DAY)
const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`)

/** What the coach notices today, most important first. At most four notes. */
export function coachNotes(s: AppState, now = Date.now()): CoachNote[] {
  const c = coachOf(s)
  const notes: CoachNote[] = []
  const commits = c.commits ?? []

  // 1. A commitment left open: ask about it, directly.
  const stale = commits.filter((x) => x.status === 'open' && daysAgo(x.at, now) >= 2).sort((a, b) => a.at - b.at)[0]
  if (stale) {
    const n = daysAgo(stale.at, now)
    notes.push({ id: 'stale', text: `לפני ${plural(n, 'יום', 'ימים')} אמרת: "${stale.text}". זה קרה?`, action: { label: 'לסמן', commit: stale.id } })
  }

  // 2. No goal yet: without a direction every road looks fine.
  if (!c.goal) notes.push({ id: 'nogoal', text: 'עוד אין לנו מטרה. בלי כיוון, כל דרך נראית טובה. חמש דקות של בהירות?', action: { label: 'להתחיל', to: '/coach/clarity' } })

  // 3. Missed commitments: the size is wrong, not the person.
  const recent = commits.filter((x) => now - x.at < 14 * DAY)
  const dropped = recent.filter((x) => x.status === 'dropped').length
  if (dropped >= 2) notes.push({ id: 'smaller', text: `${dropped} התחייבויות לא קרו בשבועיים האחרונים. זה לא עניין של אופי, זה עניין של גודל. את הבאה נעשה קטנה בחצי.` })

  // 4. Several low check-ins in a row.
  const moods = [0, 1, 2].map((i) => s.checkins?.[dayKey(addDays(new Date(now), -i))]?.mood).filter((m): m is number => !!m)
  if (moods.length >= 2 && moods.reduce((a, b) => a + b, 0) / moods.length <= 2)
    notes.push({ id: 'low', text: 'כמה ימים שאתה מסמן שקשה. לפני עוד ספר, אולי שלוש דקות של "יום קשה"?', action: { label: 'לפתוח', to: '/coach/reset' } })

  // 5. The goal says one area, the listening says another.
  if (c.goal?.area) {
    const lastTwoWeeks = Object.entries(s.progress).filter(([id, p]) => p.done && p.last && now - p.last < 14 * DAY && lessonIndex[id])
    const inArea = lastTwoWeeks.filter(([id]) => lessonIndex[id].book.category === c.goal!.area).length
    if (lastTwoWeeks.length >= 4 && inArea === 0) {
      const name = categoryById[c.goal.area as keyof typeof categoryById]?.short ?? 'התחום שבחרת'
      notes.push({ id: 'drift', text: `המטרה שלך ב${name}, אבל אף אחד מ-${lastTwoWeeks.length} הפרקים האחרונים לא היה בתחום. בכוונה?`, action: { label: 'לספרים בתחום', to: `/explore/${c.goal.area}` } })
    }
  }

  // 6. Gone quiet after being active.
  const quiet = [0, 1, 2].every((i) => !isActiveDay(s, dayKey(addDays(new Date(now), -i))))
  const before = [3, 4, 5, 6, 7, 8, 9].some((i) => isActiveDay(s, dayKey(addDays(new Date(now), -i))))
  if (quiet && before) notes.push({ id: 'quiet', text: 'שלושה ימים בלי למידה. לא צריך שעה: פרק אחד של ארבע דקות מחזיר את הקצב.', action: { label: 'לבית', to: '/' } })

  // 7. Evidence, not compliments: name a real pattern when there is one.
  const done = recent.filter((x) => x.status === 'done').length
  if (done >= 3) notes.push({ id: 'pattern', text: `${done} התחייבויות בוצעו בשבועיים. זה כבר דפוס, לא מקרה. הגיע הזמן להעלות את הרף בצעד אחד.` })

  // 8. Weekly review, from Thursday, once a week.
  const dow = new Date(now).getDay()
  const lastWeek = (c.sessions ?? []).filter((x) => x.kind === 'week').sort((a, b) => b.at - a.at)[0]
  if (dow >= 4 && (!lastWeek || now - lastWeek.at > 5 * DAY))
    notes.push({ id: 'week', text: 'סוף שבוע מתקרב. עשר דקות של סיכום יכוונו את כל השבוע הבא.', action: { label: 'לסיכום', to: '/coach/week' } })

  return notes.slice(0, 4)
}

/** Numbers for the weekly review: what actually happened in the last seven days. */
export function weekFacts(s: AppState, now = Date.now()) {
  const keys = Array.from({ length: 7 }, (_, i) => dayKey(addDays(new Date(now), -i)))
  const minutes = Math.round(keys.reduce((a, k) => a + (s.log[k] ?? 0), 0) / 60)
  const active = keys.filter((k) => isActiveDay(s, k)).length
  const chapters = Object.values(s.progress).filter((p) => p.done && p.last && now - p.last < 7 * DAY).length
  const moods = keys.map((k) => s.checkins?.[k]?.mood).filter((m): m is number => !!m)
  const commits = (coachOf(s).commits ?? []).filter((x) => now - x.at < 7 * DAY)
  return {
    minutes,
    active,
    chapters,
    mood: moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
    done: commits.filter((x) => x.status === 'done').length,
    total: commits.length,
  }
}

const uid = () => Math.random().toString(36).slice(2, 9)

export function addCommit(text: string, from?: string) {
  const t = text.trim()
  if (!t) return
  const c: Commitment = { id: uid(), text: t, at: Date.now(), status: 'open', from }
  store.set((s) => ({ coach: { ...s.coach, commits: [c, ...(s.coach?.commits ?? [])] } }), { immediate: true })
}

export function setCommit(id: string, status: Commitment['status']) {
  store.set(
    (s) => ({ coach: { ...s.coach, commits: (s.coach?.commits ?? []).map((c) => (c.id === id ? { ...c, status, doneAt: status === 'open' ? undefined : Date.now() } : c)) } }),
    { immediate: true },
  )
}

export function setGoal(goal: CoachState['goal']) {
  store.set((s) => ({ coach: { ...s.coach, goal } }), { immediate: true })
}

/** Save a finished session; clarity also sets the goal; the chosen answer becomes the next commitment. */
export function finishSession(kind: string, answers: string[], commit: boolean) {
  const def = coachSessionById[kind]
  store.set(
    (s) => {
      const coach: CoachState = { ...s.coach, sessions: [{ id: uid(), kind, at: Date.now(), answers }, ...(s.coach?.sessions ?? [])].slice(0, 60) }
      if (def?.goalFrom && answers[def.goalFrom.text]?.trim())
        coach.goal = { ...s.coach?.goal, text: answers[def.goalFrom.text].trim(), why: answers[def.goalFrom.why]?.trim() || undefined, at: Date.now() }
      return { coach }
    },
    { immediate: true },
  )
  if (commit && def) addCommit(answers[def.commitFrom] ?? '', kind)
}
