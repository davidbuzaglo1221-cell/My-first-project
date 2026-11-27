import { describe, expect, it } from 'vitest'
import { cleanTurns } from './tutor'

describe('cleanTurns', () => {
  it('keeps a valid conversation that ends with the user', () => {
    expect(cleanTurns([{ role: 'user', content: ' שלום ' }])).toEqual([{ role: 'user', content: 'שלום' }])
  })
  it('drops a leading assistant turn', () => {
    expect(cleanTurns([{ role: 'assistant', content: 'a' }, { role: 'user', content: 'b' }])).toEqual([{ role: 'user', content: 'b' }])
  })
  it('rejects other roles, empty text and a conversation not ending with a question', () => {
    expect(cleanTurns([{ role: 'system', content: 'x' }])).toBeNull()
    expect(cleanTurns([{ role: 'user', content: '  ' }])).toBeNull()
    expect(cleanTurns([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }])).toBeNull()
    expect(cleanTurns('nope')).toBeNull()
  })
  it('trims long messages and keeps only the recent turns', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(5000) }))
    many.push({ role: 'user', content: 'last' })
    const out = cleanTurns(many)!
    expect(out.length).toBeLessThanOrEqual(12)
    expect(out.every((t) => t.content.length <= 2000)).toBe(true)
  })
})
