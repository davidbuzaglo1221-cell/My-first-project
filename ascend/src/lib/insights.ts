import { allLessons, books, booksByCategory, categories, curatedPaths, estimateSeconds, lessonIndex, pathById } from '../content'
import type { CategoryId, LearningPath } from '../content/types'
import type { AppState } from './store'
import { addDays, bestStreak, dayKey, lastNDays, streakFrom } from './dates'

export const ACTIVE_DAY_SECONDS = 60

export const todaySeconds = (s: AppState) => s.log[dayKey()] ?? 0
export const isActiveDay = (s: AppState, k: string) => (s.log[k] ?? 0) >= ACTIVE_DAY_SECONDS || s.habits.some((h) => h.checks.includes(k))
export const currentStreak = (s: AppState) => streakFrom((k) => isActiveDay(s, k))
export const longestStreak = (s: AppState) => {
  const keys = new Set(Object.keys(s.log).filter((k) => isActiveDay(s, k)))
  s.habits.forEach((h) => h.checks.forEach((c) => keys.add(c)))
  return bestStreak([...keys])
}
export const totalSeconds = (s: AppState) => Object.values(s.log).reduce((a, b) => a + b, 0)
export const completedIds = (s: AppState) => Object.keys(s.progress).filter((id) => s.progress[id].done && lessonIndex[id])

export function weekSeries(s: AppState) {
  return lastNDays(7).map((d) => ({ date: d, key: dayKey(d), seconds: s.log[dayKey(d)] ?? 0 }))
}

/** Share of the last 28 days on which there was meaningful practice. */
export function consistency(s: AppState) {
  const days = lastNDays(28)
  const firstUse = Math.min(...Object.keys(s.log).map((k) => new Date(k).getTime()), Date.now())
  const relevant = days.filter((d) => d.getTime() >= firstUse - 86400000)
  if (!relevant.length) return 0
  return relevant.filter((d) => isActiveDay(s, dayKey(d))).length / relevant.length
}

export function categoryMastery(s: AppState, id: CategoryId) {
  const lessons = booksByCategory(id).flatMap((b) => b.lessons)
  const done = lessons.filter((l) => s.progress[l.id]?.done).length
  return { done, total: lessons.length, ratio: lessons.length ? done / lessons.length : 0 }
}

/**
 * Growth index per area (0–100): where you started (self assessment),
 * plus evidence of learning (lessons), applying (exercises) and repeating (habit check-ins).
 */
export function growthIndex(s: AppState, id: CategoryId) {
  const base = (s.assessment[id] ?? 3) * 14
  const lessonIds = booksByCategory(id).flatMap((b) => b.lessons.map((l) => l.id))
  const learned = lessonIds.filter((l) => s.progress[l]?.done).length
  const applied = lessonIds.filter((l) => s.actions[l]).length
  const repeated = s.habits.filter((h) => h.lessonId && lessonIds.includes(h.lessonId)).reduce((a, h) => a + h.checks.length, 0)
  return Math.min(100, Math.round(base + Math.min(learned * 4, 14) + Math.min(applied * 4, 10) + Math.min(repeated, 6)))
}

export interface FocusArea {
  id: CategoryId
  score: number
  reason: string
}

/** Areas that need attention: low growth index, weighted toward the user's chosen goals and recent neglect. */
export function focusAreas(s: AppState): FocusArea[] {
  const weekAgo = Date.now() - 7 * 86400000
  return categories
    .map((c) => {
      const score = growthIndex(s, c.id)
      const lessonIds = booksByCategory(c.id).flatMap((b) => b.lessons.map((l) => l.id))
      const recent = lessonIds.some((l) => (s.progress[l]?.last ?? 0) > weekAgo)
      const isGoal = s.goals.includes(c.id)
      const priority = (100 - score) + (isGoal ? 30 : 0) + (recent ? -12 : 8)
      const reason = isGoal && !recent ? 'מטרה שבחרת, ולא נגעת בה השבוע' : isGoal ? 'אחת המטרות שבחרת' : score < 50 ? 'דירגת את התחום הזה נמוך' : 'יכול לחזק את התמונה הכוללת'
      return { id: c.id, score, reason, priority }
    })
    .sort((a, b) => b.priority - a.priority)
    .map(({ id, score, reason }) => ({ id, score, reason }))
}

export interface Recommendation {
  lessonId: string
  reason: string
}

export function recommendations(s: AppState, limit = 4): Recommendation[] {
  const out: Recommendation[] = []
  const seen = new Set<string>()
  const push = (lessonId: string | undefined, reason: string) => {
    if (!lessonId || seen.has(lessonId) || !lessonIndex[lessonId] || s.progress[lessonId]?.done) return
    seen.add(lessonId)
    out.push({ lessonId, reason })
  }

  const inProgress = Object.entries(s.progress)
    .filter(([id, p]) => !p.done && p.pos > 8 && lessonIndex[id])
    .sort((a, b) => b[1].last - a[1].last)
  inProgress.slice(0, 1).forEach(([id]) => push(id, 'ממשיכים מאיפה שעצרת'))

  const path = s.activePathId ? pathById[s.activePathId] ?? personalPath(s) : personalPath(s)
  push(path.lessonIds.find((id) => !s.progress[id]?.done), `הצעד הבא במסלול ״${path.title}״`)

  const started = books
    .filter((b) => b.lessons.some((l) => s.progress[l.id]?.done) && b.lessons.some((l) => !s.progress[l.id]?.done))
    .sort((a, b) => Math.max(...b.lessons.map((l) => s.progress[l.id]?.last ?? 0)) - Math.max(...a.lessons.map((l) => s.progress[l.id]?.last ?? 0)))
  started.forEach((b) => push(b.lessons.find((l) => !s.progress[l.id]?.done)?.id, `השיעור הבא ב״${b.title}״`))

  // Variety across the whole library: one untouched book from every area, rotating daily. No area is favoured.
  const day = Math.floor(Date.now() / 86400000)
  const order = categories.map((_, i) => categories[(i + day) % categories.length])
  for (const cat of order) {
    const pool = booksByCategory(cat.id).filter((b) => !b.lessons.some((l) => s.progress[l.id]))
    const book = pool[day % Math.max(1, pool.length)]
    push(book?.lessons[0]?.id, `מתוך ${cat.short}`)
  }

  allLessons.forEach((r) => push(r.lesson.id, 'עוד לא שמעת'))
  return out.slice(0, limit)
}

export function shortLessons(s: AppState, maxSeconds = 130, limit = 8) {
  return allLessons
    .filter((r) => estimateSeconds(r.lesson, s.cps) <= maxSeconds && !s.progress[r.lesson.id]?.done)
    .sort((a, b) => estimateSeconds(a.lesson, s.cps) - estimateSeconds(b.lesson, s.cps))
    .slice(0, limit)
}

/** A path built only from the areas the learner chose (all areas if none), interleaving foundational lessons. */
export function personalPath(s: AppState): LearningPath {
  const areas = (s.goals.length ? categories.filter((c) => s.goals.includes(c.id)) : categories).map((c) => c.id)
  const queues = areas.map((a) =>
    booksByCategory(a)
      .slice()
      .sort((x, y) => (x.level === y.level ? 0 : x.level === 'יסודות' ? -1 : 1))
      .flatMap((b) => b.lessons.slice(0, 2).map((l) => l.id)),
  )
  const lessonIds: string[] = []
  const max = Math.max(9, areas.length * 2)
  for (let i = 0; lessonIds.length < max && i < 12; i++) queues.forEach((q) => q[i] && lessonIds.length < max && lessonIds.push(q[i]))
  const names = areas.map((a) => categories.find((c) => c.id === a)!.short)
  return {
    id: 'personal',
    title: 'המסלול האישי שלך',
    subtitle: s.goals.length ? names.join(', ') : 'כל התחומים',
    description: s.goals.length ? `נבנה מהתחומים שבחרת: ${names.join(', ')}. אפשר לשנות את הבחירה בכל רגע, וכל הספרייה פתוחה לך.` : 'שיעור מכל תחום, לסירוגין. כל הספרייה פתוחה לך, ואתה בוחר מה ללמוד.',
    lessonIds,
    hue: 156,
    motif: 'stairs',
  }
}

export const resolvePath = (s: AppState, id?: string) => (id === 'personal' || !id ? personalPath(s) : pathById[id] ?? personalPath(s))

export function pathProgress(s: AppState, p: LearningPath) {
  const done = p.lessonIds.filter((id) => s.progress[id]?.done).length
  return { done, total: p.lessonIds.length, ratio: p.lessonIds.length ? done / p.lessonIds.length : 0 }
}

/* ---------- achievements ---------- */

export interface Achievement {
  id: string
  title: string
  detail: string
  test: (s: AppState) => boolean
}

export const achievementList: Achievement[] = [
  { id: 'first-lesson', title: 'הצעד הראשון', detail: 'סיימת שיעור ראשון', test: (s) => completedIds(s).length >= 1 },
  { id: 'first-action', title: 'מידע לפעולה', detail: 'ביצעת תרגיל ראשון', test: (s) => Object.keys(s.actions).length >= 1 },
  { id: 'first-habit', title: 'מערכת חדשה', detail: 'יצרת הרגל ראשון', test: (s) => s.habits.length >= 1 },
  { id: 'streak-3', title: 'שלושה ימים', detail: 'שלושה ימים ברצף', test: (s) => longestStreak(s) >= 3 },
  { id: 'streak-7', title: 'שבוע שלם', detail: 'שבעה ימים ברצף', test: (s) => longestStreak(s) >= 7 },
  { id: 'streak-30', title: 'חודש של משמעת', detail: 'שלושים ימים ברצף', test: (s) => longestStreak(s) >= 30 },
  { id: 'lessons-10', title: 'עשרה שיעורים', detail: 'סיימת עשרה שיעורים', test: (s) => completedIds(s).length >= 10 },
  { id: 'lessons-25', title: 'עשרים וחמישה', detail: 'סיימת עשרים וחמישה שיעורים', test: (s) => completedIds(s).length >= 25 },
  { id: 'book-done', title: 'ספר שלם', detail: 'סיימת את כל השיעורים של ספר', test: (s) => books.some((b) => b.lessons.every((l) => s.progress[l.id]?.done)) },
  { id: 'explorer', title: 'סקרנות רחבה', detail: 'למדת בחמישה תחומים שונים', test: (s) => categories.filter((c) => categoryMastery(s, c.id).done > 0).length >= 5 },
  { id: 'hour', title: 'שעה של צמיחה', detail: 'שעה של האזנה בסך הכל', test: (s) => totalSeconds(s) >= 3600 },
  { id: 'goal-day', title: 'יעד יומי', detail: 'עמדת ביעד היומי', test: (s) => Object.values(s.log).some((v) => v >= s.dailyGoalMin * 60) },
  { id: 'reflect', title: 'מבט פנימה', detail: 'כתבת שלוש תובנות ביומן', test: (s) => s.journal.length >= 3 },
  { id: 'habit-7', title: 'הרגל מתגבש', detail: 'שבעה סימונים להרגל אחד', test: (s) => s.habits.some((h) => h.checks.length >= 7) },
  { id: 'path-done', title: 'מסלול הושלם', detail: 'השלמת מסלול למידה', test: (s) => curatedPaths.some((p) => p.lessonIds.every((id) => s.progress[id]?.done)) },
]

export function evaluateAchievements(s: AppState) {
  const fresh = achievementList.filter((a) => !s.achievements[a.id] && a.test(s))
  return fresh
}

export function heatmap(s: AppState, weeks = 16) {
  const end = new Date()
  const start = addDays(end, -(weeks * 7 - 1) - end.getDay())
  const cells: { key: string; seconds: number; future: boolean }[] = []
  for (let i = 0; i < weeks * 7 + end.getDay() + 1 && cells.length < (weeks + 1) * 7; i++) {
    const d = addDays(start, i)
    cells.push({ key: dayKey(d), seconds: s.log[dayKey(d)] ?? 0, future: d > end })
  }
  return cells
}
