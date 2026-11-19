import type { Lesson } from './types'

/**
 * Parses a complete book written in the ALEXANDRIA chapter format into lessons (one lesson per chapter).
 *
 *   # Chapter title
 *   Paragraph… (blank line between paragraphs)
 *   > takeaway        ! practical task
 *   + habit (opt.)    ? reflection question (opt.)
 */
export function parseBook(bookId: string, text: string): Lesson[] {
  return text
    .split(/^# /m)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((chunk, i) => {
      const [title, ...rest] = chunk.split('\n')
      const paras: string[] = []
      let cur: string[] = []
      let takeaway = ''
      let task = ''
      let habit: string | undefined
      let reflect: string | undefined
      const flush = () => (cur.length && paras.push(cur.join(' ')), (cur = []))
      for (const raw of rest) {
        const line = raw.trim()
        if (!line) flush()
        else if (line.startsWith('> ')) (flush(), (takeaway = line.slice(2).trim()))
        else if (line.startsWith('! ')) (flush(), (task = line.slice(2).trim()))
        else if (line.startsWith('+ ')) (flush(), (habit = line.slice(2).trim()))
        else if (line.startsWith('? ')) (flush(), (reflect = line.slice(2).trim()))
        else cur.push(line)
      }
      flush()
      return {
        id: `${bookId}-${i + 1}`,
        title: title.trim(),
        script: paras.join('\n'),
        takeaway: takeaway || paras[paras.length - 1]?.split('. ')[0] || title,
        exercise: { task: task || 'כתוב במשפט אחד מה הרעיון החשוב ביותר בפרק הזה, ואיפה תיישם אותו השבוע.', habit, reflect },
      }
    })
}
