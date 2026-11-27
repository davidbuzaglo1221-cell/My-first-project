import { describe, expect, it } from 'vitest'
import { books, categoryById } from '../content'
import { buildIndex, normalize, search, snippet, terms, variants } from './search'

const index = buildIndex(books, (id) => categoryById[id].name)

describe('normalize', () => {
  it('folds niqqud, final letters and punctuation', () => {
    expect(normalize('שָׁלוֹם')).toBe('שלומ')
    expect(normalize('ח"כ  של׳')).toBe('ח כ של')
  })
})

describe('variants', () => {
  it('strips glued prefixes and plural endings', () => {
    const v = variants(normalize('והרגלים'))
    expect(v).toContain('הרגלימ')
    expect(v).toContain('הרגל')
  })
  it('leaves latin words alone', () => {
    expect(variants('habits')).toEqual(['habits'])
  })
})

describe('terms', () => {
  it('keeps quoted phrases together', () => {
    expect(terms('"ביטחון עצמי" כסף')).toEqual(['ביטחונ עצמי', 'כספ'])
  })
})

describe('search', () => {
  it('finds a book by its Hebrew title, first', () => {
    const r = search(index, 'הרגלים אטומיים')
    expect(r.books[0].bookId).toBe('atomic-habits')
  })
  it('finds a book by its English author name', () => {
    expect(search(index, 'james clear').books[0].bookId).toBe('atomic-habits')
  })
  it('matches through a prefix', () => {
    expect(search(index, 'ובהרגלים').books.length).toBeGreaterThan(0)
  })
  it('finds chapters with a readable snippet', () => {
    const r = search(index, 'הרגל')
    expect(r.lessons.length).toBeGreaterThan(0)
    expect(r.lessons[0].snippet!.length).toBeGreaterThan(10)
  })
  it('a related concept finds books that never use the exact word', () => {
    const r = search(index, 'עושר')
    expect(r.books.some((b) => books.find((x) => x.id === b.bookId)?.category === 'money')).toBe(true)
  })
  it('requires every word to match', () => {
    expect(search(index, 'הרגל קסקסקסקס').books).toHaveLength(0)
  })
  it('returns nothing for an empty query', () => {
    expect(search(index, '   ').books).toHaveLength(0)
  })
})

describe('snippet', () => {
  it('picks the sentence with the term and trims it', () => {
    const s = snippet('משפט ראשון ארוך מספיק. כאן מדברים על הרגלים קטנים שמצטברים. סוף הטקסט כאן.', ['הרגל'])
    expect(s).toContain('הרגלים')
  })
})

describe('search relevance', () => {
  it('a word mentioned in passing does not pull in most of the library', () => {
    const n = search(index, 'הרגל').books.length
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThan(20)
  })
})
