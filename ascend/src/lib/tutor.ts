/* The tutor's instructions, shared by every AI provider (the Claude viewer on the device, or the app's own server).
   Built from the library's content, so the server never accepts a system prompt from the client. */
import type { Book } from '../content/types'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

const STYLE =
  'ענה תמיד בעברית טבעית וברורה, בקצרה (עד כמאה וחמישים מילה, אלא אם התבקש יותר). היה מעשי: דוגמאות מהחיים וצעדים לביצוע. בלי כותרות, בלי רשימות ממוספרות ארוכות ובלי סימוני עיצוב, כי התשובה עשויה להיות מוקראת בקול.'

/** A tutor for one book, grounded in all of its chapters. */
export function bookTutor(b: Book): string {
  const context = [
    `ספר: ${b.title} (${b.originalTitle}), מאת ${b.author}.`,
    ...b.lessons.map((l, i) => `פרק ${i + 1}: ${l.title}\n${l.script}\nהשורה התחתונה: ${l.takeaway}`),
  ]
    .join('\n\n')
    .slice(0, 60000)
  return `אתה מורה פרטי חכם וחם באפליקציית לימוד בשם הספריה. התלמיד לומד את הספר שלהלן. ${STYLE} בסס את התשובות על תוכן הספר. אם שואלים משהו שאינו בספר, אמור זאת וענה בזהירות מהידע הכללי שלך.\n\nתוכן הספר:\n${context}`
}

/** A guide to the whole library: recommends books and chapters that exist in the catalogue. */
export function libraryGuide(books: Book[]): string {
  const catalogue = books
    .map((b) => `- ${b.title} (${b.author}) [${b.id}]: ${b.tagline} פרקים: ${b.lessons.map((l) => l.title).join('; ')}`)
    .join('\n')
    .slice(0, 60000)
  return `אתה המדריך של הספריה, אפליקציה של ספרי צמיחה אישית בעברית. עזור למשתמש לבחור מה ללמוד ולהבין רעיונות. ${STYLE} המלץ רק על ספרים מהקטלוג שלהלן, בשמם העברי המדויק, ואמור בכל המלצה למה דווקא הספר הזה ובאיזה פרק להתחיל. אם אין ספר מתאים, אמור זאת.\n\nהקטלוג:\n${catalogue}`
}

/** Keep a conversation inside safe bounds before it leaves the device or reaches the model. */
export function cleanTurns(turns: unknown, maxTurns = 12, maxChars = 2000): ChatTurn[] | null {
  if (!Array.isArray(turns) || turns.length === 0 || turns.length > 40) return null
  const out: ChatTurn[] = []
  for (const t of turns.slice(-maxTurns)) {
    if (!t || typeof t !== 'object') return null
    const { role, content } = t as Record<string, unknown>
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null
    const c = content.trim().slice(0, maxChars)
    if (!c) return null
    out.push({ role, content: c })
  }
  // the API needs the conversation to start with the user and end with the user's question
  while (out.length && out[0].role !== 'user') out.shift()
  if (!out.length || out[out.length - 1].role !== 'user') return null
  return out
}
