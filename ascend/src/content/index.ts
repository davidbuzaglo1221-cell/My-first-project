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
import { classicBooks } from './books/classics'
import { moreBooks } from './books/more'
import { completeBooks } from './full'
import { parseBook } from './fullbook'

export { categories, categoryById }
const order = categories.map((c) => c.id)
export type * from './types'

const raw: Book[] = [
  ...moneyBooks,
  ...persuasionBooks,
  ...psychologyBooks,
  ...communicationBooks,
  ...confidenceBooks,
  ...disciplineBooks,
  ...businessBooks,
  ...leadershipBooks,
  ...mindsetBooks,
  ...classicBooks,
  ...moreBooks,
]

/** Every book with a complete text gets one lesson per chapter: the whole book, only what matters. */
export const books: Book[] = raw
  .map((b) => (completeBooks[b.id] ? { ...b, lessons: parseBook(b.id, completeBooks[b.id]), complete: true } : b))
  .filter((b) => b.lessons.length > 0)
  .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))

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
    lessonIds: ids(['psychology-of-money', [1, 4, 7]], ['richest-man-in-babylon', [2]], ['rich-dad-poor-dad', [2]], ['millionaire-next-door', [1, 3]], ['simple-path-to-wealth', [5]], ['intelligent-investor', [5, 7]]),
    hue: 152,
    motif: 'rings',
  },
  {
    id: 'path-persuasion',
    title: 'לשכנע בלי ללחוץ',
    subtitle: 'השפעה, משא ומתן ואמון',
    description: 'הפסיכולוגיה של ה״כן״, הטכניקות של משא ומתן בבני ערובה, והדרך להגיע להסכמות בלי להרוס יחסים.',
    lessonIds: ids(['influence', [2, 3, 4]], ['never-split-the-difference', [2, 3, 8]], ['getting-to-yes', [3, 6]], ['made-to-stick', [2]], ['how-to-win-friends', [4]]),
    hue: 164,
    motif: 'arc',
  },
  {
    id: 'path-confidence',
    title: 'ביטחון שקט',
    subtitle: 'נוכחות, הערכה עצמית וחופש',
    description: 'לבנות ביטחון מבפנים: לקיים הבטחות לעצמך, להרגיע את הגוף, ולהפסיק לחיות לפי מה שאחרים חושבים.',
    lessonIds: ids(['six-pillars-self-esteem', [1, 5]], ['charisma-myth', [1, 2]], ['feel-the-fear', [1, 2]], ['courage-to-be-disliked', [3, 4]], ['daring-greatly', [1]], ['magic-of-thinking-big', [3]]),
    hue: 146,
    motif: 'sun',
  },
  {
    id: 'path-discipline',
    title: 'מערכת למשמעת',
    subtitle: 'הרגלים, ריכוז ובחירה',
    description: 'במקום כוח רצון, מערכת: הרגלים קטנים, בלוקים של ריכוז עמוק, והאומץ לומר לא לכל מה שלא חשוב.',
    lessonIds: ids(['atomic-habits', [1, 2, 5, 6]], ['eat-that-frog', [1]], ['essentialism', [3, 4]], ['deep-work', [3]], ['power-of-habit', [3]], ['cant-hurt-me', [5]]),
    hue: 160,
    motif: 'stairs',
  },
  {
    id: 'path-leader',
    title: 'להוביל אנשים',
    subtitle: 'אחריות, כוונה ותקשורת',
    description: 'מנהיגות שמתחילה באחריות מלאה, עוברת דרך חזון ברור, ומתבטאת בשיחות הקשות ביותר.',
    lessonIds: ids(['extreme-ownership', [1, 2]], ['seven-habits', [2, 4]], ['start-with-why', [1]], ['five-dysfunctions', [2, 3]], ['leaders-eat-last', [3]], ['crucial-conversations', [3]], ['21-laws-of-leadership', [2]]),
    hue: 150,
    motif: 'pillar',
  },
  {
    id: 'path-calm',
    title: 'שקט פנימי',
    subtitle: 'סטואה, משמעות ורגש',
    description: 'כלים עתיקים וחדשים לשליטה ברגש, לחיים עם משמעות, ולשקט שלא תלוי בנסיבות.',
    lessonIds: ids(['meditations', [3, 4, 6]], ['mans-search-for-meaning', [2, 5]], ['power-of-now', [1, 4]], ['obstacle-is-the-way', [1]], ['emotional-intelligence', [3]]),
    hue: 168,
    motif: 'orbit',
  },
  {
    id: 'path-builder',
    title: 'לבנות משהו משלך',
    subtitle: 'יזמות מהרעיון ועד המערכת',
    description: 'לבדוק רעיון מהר, למצוא את מה שרק אתה רואה, ולבנות עסק שלא תלוי רק בך.',
    lessonIds: ids(['lean-startup', [1, 3]], ['zero-to-one', [2, 4]], ['blue-ocean-strategy', [1, 3]], ['e-myth-revisited', [4]], ['good-to-great', [5]], ['hard-thing-about-hard-things', [2]]),
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
