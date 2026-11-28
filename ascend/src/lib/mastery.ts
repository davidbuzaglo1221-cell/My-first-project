/**
 * Self-mastery: the day (1% better), tasks spoken in Hebrew, sleep and routines, scroll pauses and the discipline
 * ladder. Every number shown comes from what the user did or entered; nothing is estimated or invented.
 */
import { addDays, dayKey } from './dates'
import { store, uid, type AppState } from './store'

/* ---------- types ---------- */
export interface Task {
  id: string
  text: string
  day: string // the day key it is planned for
  time?: string // HH:MM
  important: boolean
  urgent: boolean
  kind: 'task' | 'idea'
  done?: number // timestamp when the user marked it done
  at: number
}
export interface DayPlan {
  focus?: string // the one main goal
  action?: string // one execution task
  skill?: string // one skill practice
  stretch?: string // one thing out of the comfort zone
  done?: { action?: boolean; skill?: boolean; stretch?: boolean }
  review?: { went: string; learn: string; adjust: string; at: number }
}
export interface SleepLog {
  bed: string // HH:MM actual
  wake: string // HH:MM actual
  quality?: number // 1-5, self-rated
}
export interface Mastery {
  tasks?: Task[]
  days?: Record<string, DayPlan>
  sleep?: { bed: string; wake: string; goalWake?: string; step?: number; logs?: Record<string, SleepLog> }
  routines?: { morning: string[]; evening: string[]; done?: Record<string, { m: string[]; e: string[] }> }
  pauses?: { at: number; app: string; why?: string; choice: 'closed' | 'alternative' | 'continued' }[]
  limits?: { app: string; daily: number; weekly?: number }[]
  usage?: Record<string, Record<string, number>> // minutes per app per day, copied by the user from iOS Screen Time
  ladder?: { level: number; log: { at: number; id: string; ok: boolean; minutes?: number }[] }
}

export const MAX_TASKS_PER_DAY = 3 // the most important things; the rest waits
export const mastery = (s: AppState): Mastery => s.mastery ?? {}
const set = (fn: (m: Mastery) => Mastery) => store.set((s) => ({ mastery: fn(s.mastery ?? {}) }), { immediate: true })

/* ---------- spoken tasks: Hebrew text -> proposed tasks ---------- */
const NUM: Record<string, number> = { אחת: 1, שתיים: 2, שלוש: 3, ארבע: 4, חמש: 5, שש: 6, שבע: 7, שמונה: 8, תשע: 9, עשר: 10, 'אחת עשרה': 11, 'שתים עשרה': 12 }
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const IDEA = /^(אולי|רעיון|כדאי|אפשר|לחשוב על|מעניין)/
const URGENT = /(דחוף|חייב היום|עד היום|מיד|בהקדם)/
const IMPORTANT = /(חשוב|קריטי|הכי חשוב|עדיפות)/

/** Day key for a Hebrew day phrase relative to `now`; undefined when none is said. */
export function parseDay(text: string, now = new Date()): string | undefined {
  if (/מחרתיים/.test(text)) return dayKey(addDays(now, 2))
  if (/מחר/.test(text)) return dayKey(addDays(now, 1))
  if (/היום|הערב|הבוקר/.test(text)) return dayKey(now)
  const m = text.match(/ביום (ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/) ?? text.match(/\b(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\b/)
  if (m) {
    const target = DAYS.indexOf(m[1])
    const diff = (target - now.getDay() + 7) % 7 || 7
    return dayKey(addDays(now, diff))
  }
  return undefined
}

/** HH:MM from "ב-8", "בשמונה", "ב 18:30", "בשמונה בערב"; undefined when no time is said. */
export function parseTime(text: string): string | undefined {
  let h: number | undefined
  let mnt = 0
  const d = text.match(/ב[-־\s]?(\d{1,2})(?::(\d{2}))?/)
  if (d) (h = +d[1]), (mnt = d[2] ? +d[2] : 0)
  else {
    const w = Object.keys(NUM).sort((a, b) => b.length - a.length).find((k) => new RegExp(`ב${k}(\\s|$|,)`).test(text))
    if (w) h = NUM[w]
  }
  if (h === undefined || h > 23) return undefined
  if (/חצי/.test(text)) mnt = 30
  if (h < 12 && /(בערב|בלילה|אחה"צ|אחרי הצהריים)/.test(text)) h += 12
  return `${String(h).padStart(2, '0')}:${String(mnt).padStart(2, '0')}`
}

/** Split a spoken sentence into proposed items. The user confirms before anything is saved. */
export function parseSpoken(text: string, now = new Date()): Omit<Task, 'id' | 'at'>[] {
  const day = parseDay(text, now) ?? dayKey(now)
  const clean = text.replace(/(מחרתיים|מחר|היום|הערב|הבוקר|ביום (ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת))/g, ' ')
  const lead = /^(אני )?(רוצה|צריך|חייב|מתכנן|הולך)\s+/
  const parts = clean
    .split(/[,.;\n]| ו(?=ל|ג|ע|ק|ת|ס|ח|ש|ה|מ|ב|כ|נ|פ|צ|ר|ד|א|י)| וגם |, וגם /)
    .map((p) => p.trim().replace(lead, '').trim())
    .filter((p) => p.length > 1)
  return parts.map((p) => ({
    text: p.replace(/ב[-־\s]?\d{1,2}(:\d{2})?( בערב| בבוקר| בלילה)?/, '').replace(/\s+/g, ' ').trim(),
    day,
    time: parseTime(p),
    important: IMPORTANT.test(p),
    urgent: URGENT.test(p),
    kind: IDEA.test(p) ? 'idea' : 'task',
  }))
}

export const tasksFor = (s: AppState, day = dayKey()) => (mastery(s).tasks ?? []).filter((t) => t.day === day && t.kind === 'task')
export function addTasks(items: Omit<Task, 'id' | 'at'>[]) {
  set((m) => ({ ...m, tasks: [...(m.tasks ?? []), ...items.map((t) => ({ ...t, id: uid(), at: Date.now() }))] }))
}
export const toggleTask = (id: string) => set((m) => ({ ...m, tasks: (m.tasks ?? []).map((t) => (t.id === id ? { ...t, done: t.done ? undefined : Date.now() } : t)) }))
export const removeTask = (id: string) => set((m) => ({ ...m, tasks: (m.tasks ?? []).filter((t) => t.id !== id) }))
export const moveTask = (id: string, day: string) => set((m) => ({ ...m, tasks: (m.tasks ?? []).map((t) => (t.id === id ? { ...t, day } : t)) }))

/** Eisenhower order: important first, then urgent; the top three are "today's three". */
export const rank = (t: Task) => (t.important ? 2 : 0) + (t.urgent ? 1 : 0)

/* ---------- the day ---------- */
export const dayPlan = (s: AppState, day = dayKey()): DayPlan => mastery(s).days?.[day] ?? {}
export const setDay = (patch: Partial<DayPlan>, day = dayKey()) => set((m) => ({ ...m, days: { ...m.days, [day]: { ...m.days?.[day], ...patch } } }))

/** Plan vs. execution over the last n days: only days that had a plan count. */
export function planFollowThrough(s: AppState, n = 7, now = new Date()) {
  let planned = 0
  let done = 0
  for (let i = 0; i < n; i++) {
    const k = dayKey(addDays(now, -i))
    const d = mastery(s).days?.[k]
    for (const key of ['action', 'skill', 'stretch'] as const)
      if (d?.[key]) {
        planned++
        if (d.done?.[key]) done++
      }
    for (const t of (mastery(s).tasks ?? []).filter((t) => t.day === k && t.kind === 'task')) {
      planned++
      if (t.done) done++
    }
  }
  return { planned, done }
}

/* ---------- sleep ---------- */
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const fmtMin = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
}
/** Hours slept for a bed/wake pair that may cross midnight. */
export const sleptHours = (l: SleepLog) => (((toMin(l.wake) - toMin(l.bed)) % 1440) + 1440) % 1440 / 60

/** Consistency from real logs: how far wake times stray from their own average (minutes), and on-target days. */
export function sleepStats(s: AppState, n = 14, now = new Date()) {
  const sl = mastery(s).sleep
  const logs = Array.from({ length: n }, (_, i) => sl?.logs?.[dayKey(addDays(now, -i))]).filter((x): x is SleepLog => !!x)
  if (!logs.length) return null
  const wakes = logs.map((l) => toMin(l.wake))
  const avgWake = wakes.reduce((a, b) => a + b, 0) / wakes.length
  const spread = Math.sqrt(wakes.reduce((a, w) => a + (w - avgWake) ** 2, 0) / wakes.length)
  const target = sl?.wake ? toMin(sl.wake) : undefined
  const onTarget = target === undefined ? 0 : wakes.filter((w) => w <= target + 15).length
  const hours = logs.map(sleptHours)
  const q = logs.map((l) => l.quality).filter((x): x is number => !!x)
  return {
    nights: logs.length,
    avgHours: hours.reduce((a, b) => a + b, 0) / hours.length,
    avgWake: fmtMin(avgWake),
    spread: Math.round(spread),
    onTarget,
    quality: q.length ? q.reduce((a, b) => a + b, 0) / q.length : null,
  }
}

/**
 * Gradual shift toward a goal wake time: move by `step` minutes, and only after three nights in a row on the current
 * target (15 minutes grace). Two misses in the last three nights move the target back one step.
 */
export function nextWakeTarget(s: AppState, now = new Date()) {
  const sl = mastery(s).sleep
  if (!sl?.wake || !sl.goalWake) return null
  const step = sl.step ?? 15
  const cur = toMin(sl.wake)
  const goal = toMin(sl.goalWake)
  const last3 = [0, 1, 2].map((i) => sl.logs?.[dayKey(addDays(now, -i))])
  const hits = last3.filter((l) => l && toMin(l.wake) <= cur + 15).length
  const misses = last3.filter((l) => l && toMin(l.wake) > cur + 15).length
  if (cur === goal) return { target: fmtMin(cur), reached: true, change: 0 }
  if (hits === 3) return { target: fmtMin(cur > goal ? Math.max(goal, cur - step) : Math.min(goal, cur + step)), reached: false, change: cur > goal ? -step : step }
  if (misses >= 2) return { target: fmtMin(cur + (cur > goal ? step : -step)), reached: false, change: cur > goal ? step : -step, eased: true }
  return { target: fmtMin(cur), reached: false, change: 0 }
}
export const setSleep = (patch: Partial<NonNullable<Mastery['sleep']>>) => set((m) => ({ ...m, sleep: { bed: '23:30', wake: '07:00', ...m.sleep, ...patch } }))
export const logSleep = (day: string, l: SleepLog) => set((m) => ({ ...m, sleep: { bed: '23:30', wake: '07:00', ...m.sleep, logs: { ...m.sleep?.logs, [day]: l } } }))

export const DEFAULT_ROUTINES = {
  morning: ['לקום מהמיטה בלי נודניק', 'כוס מים', 'חמש דקות אור יום בחוץ', 'להתארגן', 'תנועה של עשר דקות', 'לבחור את שלושת הדברים של היום'],
  evening: ['לכתוב את המשימות של מחר', 'לסגור משימות פתוחות', 'הטלפון מחוץ לחדר השינה', 'להכין את הסביבה לבוקר', 'עשר דקות של הירגעות'],
}
export const routines = (s: AppState) => mastery(s).routines ?? { ...DEFAULT_ROUTINES }
export function toggleRoutine(kind: 'm' | 'e', item: string, day = dayKey()) {
  set((m) => {
    const r = m.routines ?? { ...DEFAULT_ROUTINES }
    const d = r.done?.[day] ?? { m: [], e: [] }
    const list = d[kind].includes(item) ? d[kind].filter((x) => x !== item) : [...d[kind], item]
    return { ...m, routines: { ...r, done: { ...r.done, [day]: { ...d, [kind]: list } } } }
  })
}
export const setRoutineItems = (kind: 'morning' | 'evening', items: string[]) => set((m) => ({ ...m, routines: { ...(m.routines ?? { ...DEFAULT_ROUTINES }), [kind]: items } }))

/* ---------- scroll pauses and screen time ---------- */
export const logPause = (app: string, choice: 'closed' | 'alternative' | 'continued', why?: string) =>
  set((m) => ({ ...m, pauses: [...(m.pauses ?? []), { at: Date.now(), app, why, choice }].slice(-500) }))
export function pauseStats(s: AppState, days = 7, now = Date.now()) {
  const p = (mastery(s).pauses ?? []).filter((x) => now - x.at < days * 86400000)
  const by = (c: string) => p.filter((x) => x.choice === c).length
  const reasons: Record<string, number> = {}
  p.forEach((x) => x.why && (reasons[x.why] = (reasons[x.why] ?? 0) + 1))
  return { total: p.length, closed: by('closed'), alternative: by('alternative'), continued: by('continued'), reasons }
}
export const setLimits = (limits: Mastery['limits']) => set((m) => ({ ...m, limits }))
export const setUsage = (day: string, app: string, minutes: number) => set((m) => ({ ...m, usage: { ...m.usage, [day]: { ...m.usage?.[day], [app]: minutes } } }))
export function weekUsage(s: AppState, app: string, now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => mastery(s).usage?.[dayKey(addDays(now, -i))]?.[app]).filter((x): x is number => x !== undefined)
}

/* ---------- discipline ladder: graded, adapted to the user's real results ---------- */
export interface Challenge {
  id: string
  level: number
  title: string
  how: string
  minutes?: number // a timed session the app measures while open
}
export const LADDER: Challenge[] = [
  { id: 'focus10', level: 1, title: '10 דקות למידה בלי טלפון', how: 'הטלפון בחדר אחר. טיימר של 10 דקות, ספר או פרק אחד.', minutes: 10 },
  { id: 'wait2', level: 1, title: 'שתי דקות המתנה לפני דחף', how: 'בפעם הבאה שיש דחף לבדוק משהו, חכה שתי דקות ורק אז תחליט.' },
  { id: 'bored5', level: 1, title: 'חמש דקות של שעמום', how: 'לשבת חמש דקות בלי טלפון, בלי מוזיקה, בלי לעשות כלום. רק לשים לב.', minutes: 5 },
  { id: 'focus20', level: 2, title: '20 דקות עבודה ממוקדת', how: 'משימה אחת, טיימר של 20 דקות, כל ההתראות כבויות.', minutes: 20 },
  { id: 'avoided', level: 2, title: 'המשימה שאתה דוחה', how: 'לבחור משימה שנדחתה כמה ימים, ולעבוד עליה עשר דקות בלבד.', minutes: 10 },
  { id: 'wait10', level: 2, title: 'עשר דקות לפני רכישה או הודעה אימפולסיבית', how: 'לכתוב את הדחף, לחכות עשר דקות, ואז להחליט.' },
  { id: 'focus45', level: 3, title: '45 דקות עבודה עמוקה', how: 'בלוק אחד, דבר אחד, בלי לבדוק כלום.', minutes: 45 },
  { id: 'nophone-am', level: 3, title: 'שעה ראשונה של הבוקר בלי טלפון', how: 'הטלפון נשאר במצב טיסה עד שהשגרה של הבוקר נגמרת.' },
  { id: 'hard-first', level: 3, title: 'הדבר הקשה קודם', how: 'המשימה הכי לא נעימה של היום, לפני כל דבר אחר.', minutes: 25 },
  { id: 'focus90', level: 4, title: '90 דקות של עומק', how: 'בלוק אחד ארוך, עם הפסקה של חמש דקות באמצע אם צריך.', minutes: 90 },
  { id: 'day-nofeed', level: 4, title: 'יום בלי פיד', how: 'יום שלם בלי רשתות עם גלילה. הודעות כן, פיד לא.' },
]
export function ladderState(s: AppState) {
  const l = mastery(s).ladder ?? { level: 1, log: [] }
  const atLevel = l.log.filter((x) => LADDER.find((c) => c.id === x.id)?.level === l.level)
  const recent = atLevel.slice(-5)
  return { level: l.level, ok: recent.filter((x) => x.ok).length, tries: recent.length, log: l.log }
}
/** Up a level after 3 successes at the current one; down after 2 misses in the last 3 (never below 1). */
export function logChallenge(id: string, ok: boolean, minutes?: number) {
  set((m) => {
    const l = m.ladder ?? { level: 1, log: [] }
    const log = [...l.log, { at: Date.now(), id, ok, minutes }].slice(-300)
    const atLevel = log.filter((x) => LADDER.find((c) => c.id === x.id)?.level === l.level)
    const last3 = atLevel.slice(-3)
    let level = l.level
    if (atLevel.filter((x) => x.ok).length >= 3 && last3.every((x) => x.ok)) level = Math.min(4, level + 1)
    else if (last3.length >= 3 && last3.filter((x) => !x.ok).length >= 2) level = Math.max(1, level - 1)
    return { ...m, ladder: { level, log } }
  })
}
