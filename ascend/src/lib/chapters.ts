import { fullTexts } from '../content/fulltext'
import type { Book } from '../content/types'

export interface Chapter {
  title: string
  paragraphs: string[]
  /** The lesson that narrates this chapter, if any. */
  lessonId?: string
  takeaway?: string
  steps?: string[]
  task?: string
  ideas?: { h: string; t: string }[]
}

/** The readable text of a book: the full public-domain translation, or the הספריה edition built from its lessons. */
export function bookChapters(b: Book): { chapters: Chapter[]; full: boolean; note: string } {
  const full = fullTexts[b.id]
  if (full) {
    const chapters: Chapter[] = full.chapters.map((c) => ({ title: c.title, paragraphs: c.paragraphs }))
    // chapter 0 (foreword) and 1 share the first lesson; the rest map one to one
    chapters.forEach((c, i) => (c.lessonId = b.lessons[Math.max(0, i - 1)]?.id))
    chapters.forEach((c, i) => {
      const l = i > 0 ? b.lessons[i - 1] : undefined
      if (l) Object.assign(c, { takeaway: l.takeaway, steps: l.steps, task: l.exercise.task })
    })
    return { chapters, full: true, note: full.source }
  }
  if (b.complete)
    return {
      chapters: b.lessons.map((l) => ({ title: l.title, paragraphs: l.script.split(/\n+/), lessonId: l.id, takeaway: l.takeaway, steps: l.steps, task: l.exercise.task, ideas: l.ideas })),
      full: true,
      note: 'כל הספר, רק העיקר: כל הפרקים והרעיונות של הספר, בניסוח מקורי ומתומצת של הספריה, בלי מילוי. זה לא תרגום מילולי של הספר.',
    }
  const intro: Chapter = { title: 'למה הספר הזה', paragraphs: [b.tagline, b.why, ...b.ideas.map((i) => `${i.title}. ${i.body}`)] }
  return {
    chapters: [intro, ...b.lessons.map((l) => ({ title: l.title, paragraphs: l.script.split(/\n+/), lessonId: l.id }))],
    full: false,
    note: 'מהדורת הספריה: הסבר מקורי של רעיונות הספר, לא הטקסט של הספר עצמו. את הספר המלא אפשר לרכוש מההוצאה.',
  }
}

