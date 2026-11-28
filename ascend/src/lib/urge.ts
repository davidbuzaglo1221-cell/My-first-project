/**
 * Urges: what the user writes down when an urge shows up, and the patterns in it. Lives only inside the encrypted
 * vault. Language is non-judging: an urge that was acted on is information, not failure.
 */
export interface UrgeEntry {
  id: string
  at: number
  area: string // what the user chose to work on, in their words
  intensity: number // 1-10 before
  after?: number // 1-10 after the delay
  feeling?: string
  states: string[] // tired, bored, stressed, alone...
  trigger?: string
  delayed?: number // minutes of urge surfing actually done (measured by the timer)
  alternative?: string
  outcome: 'passed' | 'acted' | 'open'
  note?: string
}
export interface UrgeVault {
  goals: string[]
  entries: UrgeEntry[]
}

export const STATES = ['עייף', 'משועמם', 'לחוץ', 'לבד', 'עצוב', 'כועס', 'בלילה במיטה', 'אחרי גלילה']
export const ALTERNATIVES = ['לצאת מהחדר לשתי דקות', 'עשר שכיבות סמיכה', 'מקלחת קרה קצרה', 'להתקשר למישהו', 'הליכה קצרה בחוץ', 'נשימה 4-6 לשלוש דקות', 'לכתוב מה אני מרגיש עכשיו', 'להניח את הטלפון בחדר אחר']
export const GOAL_SUGGESTIONS = ['פחות צפייה בפורנוגרפיה', 'פחות גלילה לתוכן מיני', 'לעצור התנהגות כפייתית', 'להתמודד עם דחפים בלילה', 'שליטה עצמית לפי הערכים שלי']

const hourBand = (h: number) => (h < 6 ? 'לילה (00-06)' : h < 12 ? 'בוקר (06-12)' : h < 18 ? 'צהריים (12-18)' : h < 22 ? 'ערב (18-22)' : 'לילה מאוחר (22-24)')

/** Patterns from real entries only. Nothing is shown before there is enough to say something honest. */
export function urgePatterns(v: UrgeVault, now = Date.now()) {
  const week = v.entries.filter((e) => now - e.at < 7 * 86400000)
  const all = v.entries
  const count = <T extends string>(xs: T[]) => Object.entries(xs.reduce<Record<string, number>>((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1])
  const bands = count(all.map((e) => hourBand(new Date(e.at).getHours())))
  const states = count(all.flatMap((e) => e.states))
  const surfed = all.filter((e) => e.after !== undefined)
  const drop = surfed.length ? surfed.reduce((a, e) => a + (e.intensity - (e.after ?? e.intensity)), 0) / surfed.length : null
  // where control is better: share of "passed" per state, with at least 3 entries
  const byState = STATES.map((st) => {
    const xs = all.filter((e) => e.states.includes(st) && e.outcome !== 'open')
    return { st, n: xs.length, passed: xs.filter((e) => e.outcome === 'passed').length }
  }).filter((x) => x.n >= 3)
  return {
    total: all.length,
    week: { total: week.length, passed: week.filter((e) => e.outcome === 'passed').length, acted: week.filter((e) => e.outcome === 'acted').length },
    topBand: all.length >= 4 ? bands[0] : undefined,
    topStates: all.length >= 4 ? states.slice(0, 3) : [],
    avgDrop: surfed.length >= 3 ? drop : null,
    byState,
  }
}
