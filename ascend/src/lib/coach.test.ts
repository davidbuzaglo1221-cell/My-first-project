import { describe, expect, it } from 'vitest'
import { coachSessions } from '../content/coach'
import { coachNotes, weekFacts } from './coach'
import { addDays, dayKey } from './dates'
import { initialState, type AppState } from './store'

const NOW = new Date(2026, 10, 24, 12).getTime() // a Tuesday
const DAY = 86400000
const base = (): AppState => ({ ...initialState() })

describe('coach', () => {
  it('every session ends in an action and asks real questions', () => {
    for (const s of coachSessions) {
      expect(s.questions.length).toBeGreaterThanOrEqual(4)
      expect(s.commitFrom).toBeLessThan(s.questions.length)
      for (const q of s.questions) expect(q.q.length).toBeGreaterThan(10)
    }
  })

  it('asks for a goal when there is none', () => {
    expect(coachNotes(base(), NOW).some((n) => n.id === 'nogoal')).toBe(true)
  })

  it('follows up on a commitment left open for days, and only then', () => {
    const s = base()
    s.coach = { goal: { text: 'x', at: NOW }, commits: [{ id: 'a', text: 'לשלוח הצעת מחיר', at: NOW - 3 * DAY, status: 'open' }] }
    const n = coachNotes(s, NOW).find((x) => x.id === 'stale')
    expect(n?.text).toContain('לשלוח הצעת מחיר')
    expect(n?.text).toContain('3 ימים')
    s.coach.commits![0].at = NOW - 3600000
    expect(coachNotes(s, NOW).some((x) => x.id === 'stale')).toBe(false)
  })

  it('notices low moods and drift from the goal area, from real data only', () => {
    const s = base()
    s.checkins = {}
    for (let i = 0; i < 3; i++) s.checkins[dayKey(addDays(new Date(NOW), -i))] = { mood: 1, q: '', a: '', at: NOW }
    expect(coachNotes(s, NOW).some((x) => x.id === 'low')).toBe(true)
  })

  it('names a pattern only when commitments were really done', () => {
    const s = base()
    s.coach = { goal: { text: 'x', at: NOW }, commits: [1, 2, 3].map((i) => ({ id: String(i), text: 't', at: NOW - i * DAY, status: 'done' as const })) }
    expect(coachNotes(s, NOW).some((x) => x.id === 'pattern')).toBe(true)
    s.coach.commits![0].status = 'dropped'
    expect(coachNotes(s, NOW).some((x) => x.id === 'pattern')).toBe(false)
  })

  it('weekly facts count only the last seven days', () => {
    const s = base()
    s.log = { [dayKey(new Date(NOW))]: 600, [dayKey(addDays(new Date(NOW), -10))]: 6000 }
    const f = weekFacts(s, NOW)
    expect(f.minutes).toBe(10)
    expect(f.active).toBe(1)
  })
})
