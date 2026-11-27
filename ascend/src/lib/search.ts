/* Smart search for a Hebrew library.
   Runs on the device, no network: normalises Hebrew (niqqud, final letters, geresh), strips the one-letter
   prefixes Hebrew glues to words (ו, ה, ב, ל, מ, ש, כ), expands a small concept map so "עושר" also finds books
   about money, and ranks books and individual chapters by where the words were found. */
import type { Book } from '../content/types'

const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' }

/** Lower-case, no niqqud or punctuation, final letters folded, single spaces. */
export function normalize(t: string): string {
  return t
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[׳״"'`’‘“”\-–—_.,:;!?()[\]{}/\\|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const PREFIX_LETTERS = 'ושהבלמכ'

/** A word and the forms it may hide behind prefixes: "והרגלים" → ["והרגלים", "הרגלים", "רגלים", …]. */
export function variants(word: string): string[] {
  const out = [word]
  if (!/[\u05d0-\u05ea]/.test(word)) return out
  let w = word
  // Hebrew glues up to three one-letter prefixes (וכשה…); try every intermediate form
  for (let i = 0; i < 3 && PREFIX_LETTERS.includes(w[0]) && w.length > 3; i++) {
    w = w.slice(1)
    out.push(w)
  }
  // plural and feminine endings: "הרגלים" also matches "הרגל", "שיחות" matches "שיח"
  for (const base of [...out]) {
    const stem = base.replace(/(ימ|ות|ה|ת)$/, '')
    if (stem !== base && stem.length >= 3) out.push(stem)
  }
  return [...new Set(out)]
}

/** Concept groups: a word in a group also finds the others (scored lower than an exact hit). */
const CONCEPTS: string[][] = [
  ['כסף', 'עושר', 'עשיר', 'השקעה', 'השקעות', 'חיסכון', 'כלכלה', 'כלכלי', 'פיננסי', 'הכנסה', 'money', 'wealth'],
  ['הרגל', 'הרגלים', 'שגרה', 'משמעת', 'עקביות', 'habit', 'habits'],
  ['ביטחון', 'בטחון', 'ביטחון עצמי', 'הערכה עצמית', 'confidence'],
  ['פחד', 'חרדה', 'לחץ', 'סטרס', 'דאגה', 'fear', 'anxiety'],
  ['שכנוע', 'השפעה', 'מכירה', 'מכירות', 'משא ומתן', 'persuasion', 'influence'],
  ['מנהיגות', 'מנהיג', 'ניהול', 'מנהל', 'צוות', 'leadership'],
  ['זוגיות', 'משיכה', 'אהבה', 'דייט', 'דייטינג', 'קשר', 'attraction', 'dating'],
  ['מיקוד', 'ריכוז', 'פרודוקטיביות', 'יעילות', 'זמן', 'focus', 'productivity'],
  ['תקשורת', 'שיחה', 'הקשבה', 'דיבור', 'communication'],
  ['עסק', 'יזמות', 'יזם', 'סטארטאפ', 'חברה', 'business', 'startup'],
  ['מיינדסט', 'חשיבה', 'תודעה', 'אמונות', 'mindset'],
  ['רגש', 'רגשות', 'אינטליגנציה רגשית', 'emotion', 'emotional'],
  ['מטרה', 'מטרות', 'יעד', 'יעדים', 'חזון', 'goal', 'goals'],
]

const conceptIndex = new Map<string, string[]>()
for (const g of CONCEPTS) {
  const norm = g.map(normalize)
  for (const w of norm) conceptIndex.set(w, [...(conceptIndex.get(w) ?? []), ...norm.filter((x) => x !== w)])
}

export function relatedTerms(term: string): string[] {
  const out = new Set<string>()
  for (const v of variants(term)) for (const r of conceptIndex.get(v) ?? []) out.add(r)
  return [...out]
}

type Field = { text: string; w: number }
interface Doc {
  kind: 'book' | 'lesson'
  bookId: string
  lessonId?: string
  fields: { norm: string; words: Set<string>; w: number }[]
  raw: string
}

const wordsOf = (norm: string) => {
  const s = new Set<string>()
  for (const w of norm.split(' ')) if (w) for (const v of variants(w)) s.add(v)
  return s
}
const field = (f: Field) => {
  const norm = normalize(f.text)
  return { norm, words: wordsOf(norm), w: f.w }
}

export interface Index {
  docs: Doc[]
}

export function buildIndex(books: Book[], categoryName: (id: Book['category']) => string = () => ''): Index {
  const docs: Doc[] = []
  for (const b of books) {
    docs.push({
      kind: 'book',
      bookId: b.id,
      raw: b.tagline,
      fields: [
        { text: b.title, w: 12 },
        { text: `${b.originalTitle} ${b.author} ${b.authorEn}`, w: 9 },
        { text: `${b.tagline} ${categoryName(b.category)}`, w: 4 },
        { text: b.ideas.map((i) => i.title).join(' '), w: 4 },
        { text: `${b.why} ${b.ideas.map((i) => i.body).join(' ')}`, w: 2 },
      ].map(field),
    })
    for (const l of b.lessons) {
      docs.push({
        kind: 'lesson',
        bookId: b.id,
        lessonId: l.id,
        raw: `${l.takeaway}\n${l.script}`,
        fields: [
          { text: l.title, w: 8 },
          { text: `${l.takeaway} ${(l.ideas ?? []).map((i) => i.h).join(' ')}`, w: 3 },
          { text: `${l.script} ${(l.ideas ?? []).map((i) => i.t).join(' ')} ${(l.steps ?? []).join(' ')}`, w: 1 },
        ].map(field),
      })
    }
  }
  return { docs }
}

/** Score of one query term against a document: best field weight, exact > prefix > related concept. */
function termScore(doc: Doc, term: string): number {
  const vs = variants(term)
  const rel = relatedTerms(term)
  let best = 0
  for (const f of doc.fields) {
    let s = 0
    if (term.includes(' ') ? f.norm.includes(term) : vs.some((v) => f.words.has(v))) s = f.w
    else if (term.length >= 3 && vs.some((v) => v.length >= 3 && f.norm.includes(v))) s = f.w * 0.6
    else if (rel.some((r) => (r.includes(' ') ? f.norm.includes(r) : f.words.has(r)))) s = f.w * 0.35
    if (s > best) best = s
  }
  return best
}

export interface Hit {
  bookId: string
  lessonId?: string
  score: number
  snippet?: string
}

/** Split a query into terms; a quoted phrase stays one term. */
export function terms(q: string): string[] {
  const out: string[] = []
  const re = /"([^"]+)"|“([^”]+)”|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(q))) {
    const t = normalize(m[1] ?? m[2] ?? m[3] ?? '')
    if (t) out.push(t)
  }
  return out
}

/** The sentence that best shows why a chapter matched, trimmed to a readable length. */
export function snippet(raw: string, ts: string[], max = 150): string {
  const sentences = raw.split(/(?<=[.!?״"])\s+|\n+/).filter((s) => s.trim().length > 12)
  let best = sentences[0] ?? ''
  let bestN = -1
  for (const s of sentences) {
    const n = normalize(s)
    const k = ts.reduce((acc, t) => acc + (variants(t).some((v) => v.length >= 2 && n.includes(v)) ? 1 : 0), 0)
    if (k > bestN) (best = s), (bestN = k)
  }
  best = best.trim()
  return best.length > max ? best.slice(0, max).replace(/\s+\S*$/, '') + '…' : best
}

/** Every term must match (AND). Returns books and chapters, best first. */
export function search(index: Index, q: string, limit = { books: 60, lessons: 12 }) {
  const ts = terms(q)
  const books: Hit[] = []
  const lessons: Hit[] = []
  if (!ts.length) return { books, lessons, terms: ts }
  const bookBest = new Map<string, number>()
  const chapterHits = new Map<string, { strong: number; weak: number; best: number }>()
  for (const d of index.docs) {
    let total = 0
    let ok = true
    for (const t of ts) {
      const s = termScore(d, t)
      if (!s) {
        ok = false
        break
      }
      total += s
    }
    if (!ok) continue
    if (d.kind === 'book') bookBest.set(d.bookId, Math.max(bookBest.get(d.bookId) ?? 0, total))
    else {
      lessons.push({ bookId: d.bookId, lessonId: d.lessonId, score: total, snippet: snippet(d.raw, ts) })
      // A chapter makes its book a result only when the topic is in a heading or the takeaway,
      // or when it runs through several chapters; one passing mention in the text is not enough.
      const strong = total >= ts.length * 3
      const prev = chapterHits.get(d.bookId) ?? { strong: 0, weak: 0, best: 0 }
      chapterHits.set(d.bookId, { strong: prev.strong + (strong ? 1 : 0), weak: prev.weak + (strong ? 0 : 1), best: Math.max(prev.best, total) })
    }
  }
  for (const [bookId, h] of chapterHits) {
    if (h.strong === 0 && h.weak < 3) continue
    bookBest.set(bookId, Math.max(bookBest.get(bookId) ?? 0, h.best * 0.5 + h.strong + h.weak * 0.2))
  }
  for (const [bookId, score] of bookBest) books.push({ bookId, score })
  books.sort((a, b) => b.score - a.score)
  lessons.sort((a, b) => b.score - a.score)
  return { books: books.slice(0, limit.books), lessons: lessons.slice(0, limit.lessons), terms: ts }
}
