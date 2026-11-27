/**
 * What the app says to you on its own, every day: a question to stop and feel, a situation to decide,
 * a nudge to keep going. The same day gives everyone the same message, so the notification and the app agree.
 */
import { programDays } from './program'
import { situations } from './situations'

/** Questions for the daily check-in: short, specific, the kind that make you stop. */
export const checkinQuestions: string[] = [
  'מה הדבר שהכי העסיק את הראש שלך היום?',
  'איפה בגוף אתה מרגיש את היום הזה?',
  'מה עשית היום שאתה גאה בו, אפילו קטן?',
  'ממה נמנעת היום, ולמה?',
  'מי שימח אותך היום, ואיך?',
  'אם היום היה צבע, איזה צבע הוא היה?',
  'מה היית אומר לעצמך של הבוקר?',
  'על מה אתה מודה עכשיו, ממש עכשיו?',
  'מה הדאגה שחוזרת אליך השבוע? מה בשליטתך בה?',
  'מתי היום הרגשת הכי חי?',
  'איזה רגש ניסית לא להרגיש היום?',
  'מה הדבר האחד שיהפוך את מחר לטוב יותר?',
  'איזו מחשבה עליך חזרה היום? האם היא נכונה?',
  'למי אתה חייב שיחה שאתה דוחה?',
  'מה למדת היום על עצמך?',
  'מתי היום הקשבת באמת למישהו?',
  'איפה אמרת כן כשרצית לומר לא?',
  'מה מעייף אותך לאחרונה, ומה ממלא אותך?',
  'אם חבר טוב היה מתאר את היום שלך, מה הוא היה אומר?',
  'מה היה הרגע הכי שקט שלך היום?',
  'מה אתה צריך עכשיו, ואיך תיתן את זה לעצמך?',
  'באיזה רגע היום פעלת מתוך פחד, ובאיזה מתוך בחירה?',
  'מה ההרגל הקטן שהכי עוזר לך השבוע?',
  'מה היית עושה מחר אם לא היית מפחד?',
  'איזו פעולה קטנה מקרבת אותך היום לאדם שאתה רוצה להיות?',
  'מה גרם לך לחייך היום?',
  'על מה כעסת היום, ומה מתחת לכעס?',
  'מה אתה דוחה, ומה הצעד של שתי דקות?',
  'מי האדם שאתה רוצה להודות לו השבוע?',
  'איך הייתה האנרגיה שלך היום, מאחת עד עשר, ולמה?',
]

/** One message a day per slot. Morning: something to do or decide. Evening: something to notice and feel. */
export interface Nudge {
  title: string
  body: string
  /** In-app route to open (hash path). */
  url: string
}

const mod = (a: number, n: number) => ((a % n) + n) % n
const dayN = (d: Date) => Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(2026, 0, 1).getTime()) / 86400000)

export const situationOfDay = (d: Date = new Date()) => situations[mod(dayN(d), situations.length)]
export const questionOfDay = (d: Date = new Date()) => checkinQuestions[mod(dayN(d) * 7 + 3, checkinQuestions.length)]

export function morningNudge(d: Date = new Date()): Nudge {
  const n = dayN(d)
  const s = situationOfDay(d)
  const day = programDays[mod(n, programDays.length)]
  const kind = mod(n, 3)
  if (kind === 0) return { title: 'מה היית עושה?', body: `${s.title}. שלוש דרכים להגיב, ורק אחת עובדת באמת.`, url: '#/situation' }
  if (kind === 1) return { title: 'התרגול של היום מחכה לך', body: `${day.title}. שתי דקות שמשנות את היום.`, url: '#/freedom' }
  return { title: 'בוקר טוב. צעד אחד קטן להיום', body: 'פרק אחד, תרגול אחד ורעיון אחד. שלושה צעדים, והיום שלך כבר אחר.', url: '#/' }
}

export function eveningNudge(d: Date = new Date()): Nudge {
  const n = dayN(d)
  const q = questionOfDay(d)
  const kind = mod(n, 4)
  if (kind === 3) return { title: 'התקדמת היום מספיק?', body: 'גם עשר דקות נחשבות. בוא נסגור את היום עם פרק אחד.', url: '#/' }
  return { title: 'איך אתה מרגיש?', body: q, url: '#/checkin' }
}
