/**
 * Every world in the app, grouped for the "עוד" screen. Only topics that exist: each points to a real screen.
 * Progress lines are computed from the user's own data in More.tsx; nothing here is a number.
 */
import type { CategoryId } from './types'

export interface Topic {
  id: string
  title: string
  line: string
  to: string
  img: string
  pos?: string
  category?: CategoryId
  private?: boolean
}
export interface TopicGroup {
  id: string
  title: string
  topics: Topic[]
}

export const TOPIC_GROUPS: TopicGroup[] = [
  {
    id: 'mastery',
    title: 'שליטה עצמית',
    topics: [
      { id: 'urge', title: 'כוח פנימי', line: 'שליטה בדחפים, פרטי ומוצפן', to: '/mastery/urge', img: 'inner-power', pos: '50% 40%', private: true },
      { id: 'discipline', title: 'הרגלים ומשמעת', line: 'אתגרים שעולים איתך', to: '/mastery/discipline', img: 'discipline' },
      { id: 'screen', title: 'זמן מסך ומיקוד', line: 'מגבלות ועצירה לפני גלילה', to: '/mastery/screen', img: 'focus' },
      { id: 'hub', title: 'מרכז השליטה', line: 'כל התחומים במבט אחד', to: '/mastery', img: 'mastery' },
    ],
  },
  {
    id: 'body',
    title: 'גוף ונפש',
    topics: [
      { id: 'sleep', title: 'שינה ושגרה', line: 'לקום בזמן מתחיל בערב', to: '/mastery/sleep', img: 'sleep' },
      { id: 'freedom', title: 'מהישרדות לחופש', line: 'מדיטציות ותוכנית של 30 יום', to: '/freedom', img: 'calm', pos: '50% 62%' },
      { id: 'checkin', title: 'איך אתה מרגיש', line: 'עצירה של דקה ביום', to: '/checkin', img: 'evening', pos: '50% 70%' },
      { id: 'mindset', title: 'מיינדסט וצמיחה', line: 'בריאות, מחשבה וצמיחה אישית', to: '/explore/mindset', img: 'mindset', category: 'mindset' },
    ],
  },
  {
    id: 'presence',
    title: 'נוכחות ותקשורת',
    topics: [
      { id: 'speech', title: 'קול ודיבור', line: 'הקלטה, מדידה ותרגילים', to: '/mastery/speech', img: 'presence' },
      { id: 'confidence', title: 'ביטחון וכריזמה', line: 'הספרים על ביטחון ונוכחות', to: '/explore/confidence', img: 'confidence', category: 'confidence' },
      { id: 'communication', title: 'תקשורת ומערכות יחסים', line: 'להקשיב, לדבר, להתחבר', to: '/explore/communication', img: 'communication', category: 'communication' },
      { id: 'attraction', title: 'משיכה וזוגיות', line: 'מערכות יחסים בריאות', to: '/explore/attraction', img: 'attraction', category: 'attraction' },
      { id: 'situation', title: 'מה היית עושה?', line: 'מצבים אמיתיים מהחיים', to: '/situation', img: 'situation', pos: '38% 50%' },
    ],
  },
  {
    id: 'knowledge',
    title: 'ידע והתפתחות',
    topics: [
      { id: 'library', title: 'הספרייה', line: 'כל הספרים, לקרוא ולהקשיב', to: '/explore', img: 'library' },
      { id: 'psychology', title: 'פסיכולוגיה', line: 'המנגנונים שמניעים אנשים', to: '/explore/psychology', img: 'psych', category: 'psychology' },
      { id: 'leadership', title: 'מנהיגות והשפעה', line: 'להוביל אנשים ולהשפיע', to: '/explore/leadership', img: 'leadership', category: 'leadership' },
      { id: 'productivity', title: 'משמעת ופרודוקטיביות', line: 'הספרים על עבודה עמוקה והרגלים', to: '/explore/discipline', img: 'summit', category: 'discipline' },
      { id: 'notes', title: 'המחברת', line: 'מה שכתבת, אהבת והקלטת', to: '/notes', img: 'notebook' },
    ],
  },
  {
    id: 'money',
    title: 'כסף וקריירה',
    topics: [
      { id: 'money', title: 'כסף ועושר', line: 'איך כסף באמת עובד', to: '/explore/money', img: 'city', category: 'money' },
      { id: 'business', title: 'עסקים ויזמות', line: 'לבנות משהו משלך', to: '/explore/business', img: 'business', category: 'business' },
      { id: 'persuasion', title: 'מכירות ומשא ומתן', line: 'להשיג הסכמה בלי לוותר על עצמך', to: '/explore/persuasion', img: 'wealth', category: 'persuasion' },
    ],
  },
]

/** The photograph for each library category, so category screens open with their own world. */
export const CATEGORY_PHOTO: Record<string, { img: string; pos?: string }> = Object.fromEntries(
  TOPIC_GROUPS.flatMap((g) => g.topics)
    .filter((t) => t.category)
    .map((t) => [t.category!, { img: t.img, pos: t.pos }]),
)
