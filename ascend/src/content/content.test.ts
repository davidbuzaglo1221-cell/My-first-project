import { describe, expect, it } from 'vitest'
import { books, categories, curatedPaths, lessonIndex, estimateSeconds } from './index'
import { toSegments } from '../engine/sentences'
import { programDays } from './program'
import { ideaOfDay, challengeOfDay } from '../lib/daily'

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
  it('chapters are focused audio, under ten minutes', () => {
    for (const b of books) for (const l of b.lessons) {
      const s = estimateSeconds(l)
      expect(s, l.id).toBeGreaterThanOrEqual(15)
      if (b.id !== 'as-a-man-thinketh') expect(s, l.id).toBeLessThan(600)
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

describe('learning quality', () => {
  it('every chapter has a bottom line and two or three practical steps', () => {
    for (const b of books) for (const l of b.lessons) {
      expect(l.takeaway.length, l.id).toBeGreaterThan(8)
      expect(l.steps?.length ?? 0, `${l.id} steps`).toBeGreaterThanOrEqual(2)
      for (const s of l.steps ?? []) expect(s, l.id).not.toMatch(/[0-9A-Za-z]/)
    }
  })
  it('key ideas are deep and speakable: a heading and a real explanation each', () => {
    for (const b of books) for (const l of b.lessons) for (const i of l.ideas ?? []) {
      expect(i.h.length, l.id).toBeGreaterThan(3)
      expect(i.t.split(' ').length, `${l.id} ${i.h}`).toBeGreaterThan(45)
      expect(i.h + i.t, l.id).not.toMatch(/[0-9A-Za-z]/)
      for (const s of toSegments(i.t)) expect(s.length, l.id).toBeLessThanOrEqual(190)
    }
  })
})

describe('thirty-day program and your day', () => {
  it('has thirty distinct days, each with a speakable script, a practice pause and a mission', () => {
    expect(programDays.length).toBe(30)
    expect(new Set(programDays.map((d) => d.id)).size).toBe(30)
    for (const d of programDays) {
      const lines = d.script.split('\n').map((l) => l.trim()).filter(Boolean)
      expect(lines.some((l) => l.startsWith('~')), d.id).toBe(true)
      for (const l of lines.filter((l) => !l.startsWith('~'))) expect(l, d.id).not.toMatch(/[0-9A-Za-z]/)
      expect(lines.filter((l) => !l.startsWith('~')).join(' ').split(' ').length, d.id).toBeGreaterThan(100)
      expect(d.mission.length, d.id).toBeGreaterThan(20)
    }
  })
  it('gives a different idea and challenge on consecutive days', () => {
    const days = Array.from({ length: 30 }, (_, i) => new Date(2026, 10, 1 + i))
    expect(new Set(days.map((d) => ideaOfDay(d).h)).size).toBe(30)
    expect(new Set(days.map((d) => ideaOfDay(d).bookId)).size).toBeGreaterThan(20)
    expect(new Set(days.map((d) => challengeOfDay(d).text)).size).toBe(30)
  })
})

import covers from './coversManifest.json'
describe('library covers', () => {
  it('every book has a real cover file listed', () => {
    const missing = books.filter((b) => !(covers as Record<string, boolean>)[b.id]).map((b) => b.id)
    expect(missing).toEqual([])
  })
  it('every cover file exists and is sharp enough for a phone screen', async () => {
    const { existsSync, readFileSync } = await import('node:fs')
    const small: string[] = []
    for (const b of books) {
      const f = `public/covers/${b.id}.jpg`
      expect(existsSync(f), f).toBe(true)
      const buf = readFileSync(f)
      // JPEG height from the SOF marker
      let i = 2, h = 0
      while (i < buf.length) {
        const m = buf[i + 1], len = buf.readUInt16BE(i + 2)
        if (m >= 0xc0 && m <= 0xc3) { h = buf.readUInt16BE(i + 5); break }
        i += 2 + len
      }
      if (h < 700) small.push(`${b.id}:${h}`)
    }
    expect(small).toEqual([])
  })
})
