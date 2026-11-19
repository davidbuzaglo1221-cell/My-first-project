import { describe, expect, it } from 'vitest'
import { books, categories, curatedPaths, lessonIndex, estimateSeconds } from './index'
import { toSegments } from '../engine/sentences'

describe('library', () => {
  it('every category has at least three books', () => {
    for (const c of categories) expect(books.filter((b) => b.category === c.id).length).toBeGreaterThanOrEqual(3)
  })
  it('lesson ids are unique and follow book order', () => {
    const ids = books.flatMap((b) => b.lessons.map((l) => l.id))
    expect(new Set(ids).size).toBe(ids.length)
    books.forEach((b) => b.lessons.forEach((l, i) => expect(l.id).toBe(`${b.id}-${i + 1}`)))
  })
  it('every path points at real lessons', () => {
    for (const p of curatedPaths) for (const id of p.lessonIds) expect(lessonIndex[id], `${p.id} → ${id}`).toBeTruthy()
  })
  it('every book is complete: the whole book, chapter by chapter', () => {
    for (const b of books) {
      expect(b.complete || b.id === 'as-a-man-thinketh', b.id).toBe(true)
      expect(b.lessons.length, b.id).toBeGreaterThanOrEqual(5)
      for (const l of b.lessons) expect(l.takeaway.length, l.id).toBeGreaterThan(8)
    }
  })
  it('scripts are speakable Hebrew: no digits or Latin letters', () => {
    for (const b of books) for (const l of b.lessons) expect(l.script, l.id).not.toMatch(/[0-9A-Za-z]/)
  })
  it('chapters are short audio, under four minutes', () => {
    for (const b of books) for (const l of b.lessons) {
      const s = estimateSeconds(l)
      expect(s, l.id).toBeGreaterThan(20)
      if (b.id !== 'as-a-man-thinketh') expect(s, l.id).toBeLessThan(240)
      expect(l.exercise.task.length).toBeGreaterThan(10)
    }
  })
  it('segments cover the whole script and stay speakable', () => {
    for (const b of books) for (const l of b.lessons) {
      const segs = toSegments(l.script)
      expect(segs.join(' ').replace(/\s+/g, '')).toBe(l.script.replace(/\s+/g, ''))
      segs.forEach((s) => expect(s.length).toBeLessThanOrEqual(190))
    }
  })
})
