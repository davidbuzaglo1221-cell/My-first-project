import { describe, expect, it } from 'vitest'
import { addDays, dayKey } from './dates'
import { LADDER, nextWakeTarget, parseDay, parseSpoken, parseTime, sleepStats, sleptHours } from './mastery'
import { analyze, wordStats } from './speech'
import { initialState, type AppState } from './store'
import { urgePatterns, type UrgeVault } from './urge'

const NOW = new Date(2026, 10, 24, 10) // Tuesday
const base = (): AppState => ({ ...initialState() })

describe('spoken tasks', () => {
  it('finds days and times in Hebrew', () => {
    expect(parseDay('מחר אני רוצה להתאמן', NOW)).toBe(dayKey(addDays(NOW, 1)))
    expect(parseDay('ביום חמישי', NOW)).toBe(dayKey(addDays(NOW, 2)))
    expect(parseTime('להתאמן ב-8 בערב')).toBe('20:00')
    expect(parseTime('לקום בשש וחצי')).toBe('06:30')
    expect(parseTime('לקרוא קצת')).toBeUndefined()
  })
  it('splits a sentence into tasks and ideas, without saving anything', () => {
    const t = parseSpoken('מחר אני רוצה להתאמן, לקרוא, לתרגל דיבור ולחפש דירה. אולי לבשל משהו חדש', NOW)
    expect(t.map((x) => x.text)).toEqual(['להתאמן', 'לקרוא', 'לתרגל דיבור', 'לחפש דירה', 'אולי לבשל משהו חדש'])
    expect(t.every((x) => x.day === dayKey(addDays(NOW, 1)))).toBe(true)
    expect(t[4].kind).toBe('idea')
  })
  it('marks important and urgent', () => {
    const [a] = parseSpoken('דחוף לשלם חשבון חשמל היום', NOW)
    expect(a.urgent).toBe(true)
    expect(a.day).toBe(dayKey(NOW))
  })
})

describe('sleep', () => {
  it('counts hours across midnight', () => {
    expect(sleptHours({ bed: '23:30', wake: '07:00' })).toBe(7.5)
  })
  it('moves the wake target only after three nights on target, and eases after misses', () => {
    const s = base()
    const logs: Record<string, { bed: string; wake: string }> = {}
    for (let i = 0; i < 3; i++) logs[dayKey(addDays(NOW, -i))] = { bed: '00:30', wake: '08:05' }
    s.mastery = { sleep: { bed: '00:30', wake: '08:00', goalWake: '06:30', step: 15, logs } }
    expect(nextWakeTarget(s, NOW)).toMatchObject({ target: '07:45', change: -15 })
    for (let i = 0; i < 2; i++) logs[dayKey(addDays(NOW, -i))] = { bed: '01:30', wake: '09:10' }
    expect(nextWakeTarget(s, NOW)).toMatchObject({ target: '08:15', eased: true })
    expect(sleepStats(s, 14, NOW)?.nights).toBe(3)
  })
  it('shows nothing without real logs', () => {
    expect(sleepStats(base(), 14, NOW)).toBeNull()
  })
})

describe('urges', () => {
  it('reports patterns only from real entries, and only when there are enough', () => {
    const v: UrgeVault = { goals: [], entries: [] }
    expect(urgePatterns(v).topBand).toBeUndefined()
    for (let i = 0; i < 5; i++)
      v.entries.push({ id: String(i), at: new Date(2026, 10, 20 + i, 23).getTime(), area: 'x', intensity: 8, after: 4, states: ['עייף'], outcome: i < 3 ? 'passed' : 'acted' })
    const p = urgePatterns(v, new Date(2026, 10, 25).getTime())
    expect(p.topBand?.[0]).toContain('לילה מאוחר')
    expect(p.avgDrop).toBe(4)
    expect(p.byState[0]).toMatchObject({ st: 'עייף', n: 5, passed: 3 })
  })
})

describe('speech', () => {
  it('measures pauses and pitch from a synthetic recording', () => {
    const sr = 16000
    const tone = (sec: number, f: number) => Float32Array.from({ length: sr * sec }, (_, i) => 0.3 * Math.sin((2 * Math.PI * f * i) / sr))
    const sil = (sec: number) => new Float32Array(sr * sec).map(() => (Math.random() - 0.5) * 0.001)
    const x = new Float32Array([...tone(1, 120), ...sil(1), ...tone(1, 150), ...sil(0.5), ...tone(1, 180)])
    const m = analyze(x, sr)
    expect(m.pauses).toBe(2)
    expect(m.longestPause).toBeGreaterThan(0.9)
    expect(m.pitchMedian).toBeGreaterThan(130)
    expect(m.pitchRange).toBeGreaterThan(4)
  })
  it('counts words, pace and fillers only from a transcript', () => {
    const w = wordStats('אז כאילו אני בעצם רוצה רוצה להגיד משהו', 6)
    expect(w.words).toBe(8)
    expect(w.wpm).toBe(80)
    expect(w.fillers?.map((f) => f.word)).toEqual(expect.arrayContaining(['כאילו', 'בעצם']))
    expect(w.repeats?.[0]).toEqual({ word: 'רוצה', n: 1 })
  })
})

describe('discipline ladder', () => {
  it('has graded levels', () => {
    expect(new Set(LADDER.map((c) => c.level)).size).toBeGreaterThanOrEqual(4)
  })
})
