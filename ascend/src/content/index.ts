import type { Book, CategoryId, LearningPath, Lesson } from './types'
import { categories, categoryById } from './categories'
import { moneyBooks } from './books/money'
import { persuasionBooks } from './books/persuasion'
import { psychologyBooks } from './books/psychology'
import { communicationBooks } from './books/communication'
import { confidenceBooks } from './books/confidence'
import { disciplineBooks } from './books/discipline'
import { businessBooks } from './books/business'
import { leadershipBooks } from './books/leadership'
import { mindsetBooks } from './books/mindset'

export { categories, categoryById }
export type * from './types'

export const books: Book[] = [
  ...moneyBooks,
  ...persuasionBooks,
  ...psychologyBooks,
  ...communicationBooks,
  ...confidenceBooks,
  ...disciplineBooks,
  ...businessBooks,
  ...leadershipBooks,
  ...mindsetBooks,
]

export const bookById: Record<string, Book> = Object.fromEntries(books.map((b) => [b.id, b]))

export interface LessonRef {
  lesson: Lesson
  book: Book
  index: number
}

export const lessonIndex: Record<string, LessonRef> = {}
for (const book of books) book.lessons.forEach((lesson, index) => (lessonIndex[lesson.id] = { lesson, book, index }))

export const allLessons: LessonRef[] = books.flatMap((book) => book.lessons.map((lesson, index) => ({ lesson, book, index })))

export const booksByCategory = (id: CategoryId) => books.filter((b) => b.category === id)

/** Hebrew narration pace, characters per second at 1× (calibrated at runtime). */
export const BASE_CPS = 12.5

export const scriptChars = (l: Lesson) => l.script.replace(/\s+/g, ' ').length
export const estimateSeconds = (l: Lesson, cps = BASE_CPS) => Math.round(scriptChars(l) / cps + 1.5)
export const bookSeconds = (b: Book) => b.lessons.reduce((s, l) => s + estimateSeconds(l), 0)

const ids = (...pairs: [string, number[]][]) => pairs.flatMap(([book, ns]) => ns.map((n) => `${book}-${n}`))

export const curatedPaths: LearningPath[] = [
  {
    id: 'path-wealth',
    title: 'יסודות העושר',
    subtitle: 'מהתנהגות כלכלית להשקעה נבונה',
    description: 'מסלול שמתחיל באיך אתה חושב על כסף, עובר דרך חיסכון והרגלים, ומסתיים בעקרונות השקעה שמגינים עליך מעצמך.',
    lessonIds: ids(['psychology-of-money', [1, 2, 3]], ['rich-dad-poor-dad', [1, 2]], ['intelligent-investor', [1, 2]], ['think-and-grow-rich', [1]]),
    hue: 152,
    motif: 'rings',
  },
  {
    id: 'path-persuasion',
    title: 'לשכנע בלי ללחוץ',
    subtitle: 'השפעה, משא ומתן ואמון',
    description: 'הפסיכולוגיה של ה״כן״, הטכניקות של משא ומתן בבני ערובה, והדרך להגיע להסכמות בלי להרוס יחסים.',
    lessonIds: ids(['influence', [1, 2]], ['never-split-the-difference', [1, 2, 3]], ['getting-to-yes', [1, 2]], ['how-to-win-friends', [3]]),
    hue: 164,
    motif: 'arc',
  },
  {
    id: 'path-confidence',
    title: 'ביטחון שקט',
    subtitle: 'נוכחות, הערכה עצמית וחופש',
    description: 'לבנות ביטחון מבפנים: לקיים הבטחות לעצמך, להרגיע את הגוף, ולהפסיק לחיות לפי מה שאחרים חושבים.',
    lessonIds: ids(['six-pillars-self-esteem', [1, 2]], ['charisma-myth', [1, 2]], ['courage-to-be-disliked', [1, 2]], ['mindset', [1]]),
    hue: 146,
    motif: 'sun',
  },
  {
    id: 'path-discipline',
    title: 'מערכת למשמעת',
    subtitle: 'הרגלים, ריכוז ובחירה',
    description: 'במקום כוח רצון, מערכת: הרגלים קטנים, בלוקים של ריכוז עמוק, והאומץ לומר לא לכל מה שלא חשוב.',
    lessonIds: ids(['atomic-habits', [1, 2, 3]], ['essentialism', [1, 2]], ['deep-work', [1, 2]], ['six-pillars-self-esteem', [1]]),
    hue: 160,
    motif: 'stairs',
  },
  {
    id: 'path-leader',
    title: 'להוביל אנשים',
    subtitle: 'אחריות, כוונה ותקשורת',
    description: 'מנהיגות שמתחילה באחריות מלאה, עוברת דרך חזון ברור, ומתבטאת בשיחות הקשות ביותר.',
    lessonIds: ids(['extreme-ownership', [1, 2]], ['seven-habits', [1, 2]], ['start-with-why', [1]], ['crucial-conversations', [1]], ['how-to-win-friends', [1]]),
    hue: 150,
    motif: 'pillar',
  },
  {
    id: 'path-calm',
    title: 'שקט פנימי',
    subtitle: 'סטואה, משמעות ורגש',
    description: 'כלים עתיקים וחדשים לשליטה ברגש, לחיים עם משמעות, ולשקט שלא תלוי בנסיבות.',
    lessonIds: ids(['meditations', [1, 2]], ['mans-search-for-meaning', [1, 2]], ['emotional-intelligence', [1]], ['laws-of-human-nature', [1]]),
    hue: 168,
    motif: 'orbit',
  },
  {
    id: 'path-builder',
    title: 'לבנות משהו משלך',
    subtitle: 'יזמות מהרעיון ועד המערכת',
    description: 'לבדוק רעיון מהר, למצוא את מה שרק אתה רואה, ולבנות עסק שלא תלוי רק בך.',
    lessonIds: ids(['lean-startup', [1, 2]], ['zero-to-one', [1, 2]], ['e-myth-revisited', [1]], ['start-with-why', [1]], ['psychology-of-money', [2]]),
    hue: 176,
    motif: 'grid',
  },
]

export const pathById: Record<string, LearningPath> = Object.fromEntries(curatedPaths.map((p) => [p.id, p]))

export function formatMinutes(seconds: number) {
  const m = Math.max(1, Math.round(seconds / 60))
  return m === 1 ? 'דקה' : `${m} דק׳`
}

export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
