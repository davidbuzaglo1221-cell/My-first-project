import type { Book } from '../types'
import { asAManThinketh } from '../fulltext/as-a-man-thinketh'

const ch = (i: number) => asAManThinketh.chapters[i]
const script = (i: number) => ch(i).paragraphs.join('\n')

/** Public-domain classics: the complete book, translated, to read and to listen to. */
export const classicBooks: Book[] = [
  {
    id: 'as-a-man-thinketh',
    title: 'כאשר יחשוב אדם',
    originalTitle: 'As a Man Thinketh',
    author: 'ג׳יימס אלן',
    authorEn: 'James Allen',
    year: 1902,
    category: 'mindset',
    level: 'יסודות',
    shade: 1,
    tagline: 'אתה לא מושך את מה שאתה רוצה. אתה מושך את מה שאתה.',
    why: 'אחד מספרי ההתפתחות האישית הראשונים והמשפיעים בהיסטוריה, והשראה ישירה לנפוליאון היל, לדייל קרנגי ולתנועת המיינדסט כולה. הוא קצר, חד ומלא משפטים שנשארים איתך. כאן הוא מופיע בשלמותו, בתרגום חדש לעברית, לקריאה ולהאזנה.',
    ideas: [
      { title: 'המחשבה היא הזרע', body: 'כל מעשה צומח ממחשבה, והנסיבות הן הקציר של מה שזרענו.' },
      { title: 'גן התודעה', body: 'אם לא תזרע מחשבות מועילות, יצמחו בעצמם עשבים שוטים.' },
      { title: 'אחריות מוחלטת', body: 'רק אתה יכול לשנות את מצבך. אף אחד אחר.' },
      { title: 'שלווה היא עוצמה', body: 'מי ששולט במחשבותיו שולט בסערות של הנפש.' },
    ],
    lessons: [
      { id: 'as-a-man-thinketh-1', title: 'פתח דבר ומחשבה ואופי', script: script(0) + '\n' + script(1), takeaway: 'האדם הוא, פשוטו כמשמעו, מה שהוא חושב.', exercise: { task: 'במשך יום אחד, שים לב לשלוש מחשבות שחוזרות אצלך שוב ושוב, וכתוב אותן.', reflect: 'איזו מחשבה חוזרת עיצבה את האופי שלך יותר מכל?' } },
      { id: 'as-a-man-thinketh-2', title: 'השפעת המחשבה על הנסיבות', script: script(2), takeaway: 'הנסיבות לא יוצרות את האדם. הן חושפות אותו לעצמו.', exercise: { task: 'בחר נסיבה אחת בחייך שאתה לא מרוצה ממנה, וכתוב איזו מחשבה שלך מזינה אותה.', habit: 'לעקור מחשבה שלילית אחת ולהחליף אותה במחשבה מועילה' } },
      { id: 'as-a-man-thinketh-3', title: 'המחשבה, הבריאות והגוף', script: script(3), takeaway: 'הגוף הוא המשרת של התודעה.', exercise: { task: 'כשאתה מזהה היום מחשבה של דאגה או כעס, עצור ושים לב איפה היא מורגשת בגוף.' } },
      { id: 'as-a-man-thinketh-4', title: 'מחשבה ומטרה', script: script(4), takeaway: 'עד שהמחשבה מתחברת למטרה, אין הישג.', exercise: { task: 'כתוב מטרה מרכזית אחת לחודש הקרוב, וצעד אחד שתעשה למענה מחר.', habit: 'להתחיל כל בוקר במשפט אחד על המטרה המרכזית שלי' } },
      { id: 'as-a-man-thinketh-5', title: 'גורם המחשבה בהישגים', script: script(5), takeaway: 'מי שרוצה להשיג הרבה, צריך להקריב הרבה.', exercise: { task: 'רשום דבר אחד שאתה מוכן לוותר עליו השבוע כדי להתקרב למטרה שלך.', reflect: 'מה אתה עוד לא מוכן להקריב, ולמה?' } },
      { id: 'as-a-man-thinketh-6', title: 'חזונות ואידיאלים', script: script(6), takeaway: 'חלומות הם השתילים של המציאות.', exercise: { task: 'כתוב פסקה אחת שמתארת את החיים שאתה רוצה בעוד חמש שנים, כאילו הם כבר קורים.' } },
      { id: 'as-a-man-thinketh-7', title: 'שלווה', script: script(7), takeaway: 'שליטה עצמית היא כוח. שלווה היא עוצמה.', exercise: { task: 'בפעם הבאה שמשהו מרגיז אותך, קח שלוש נשימות איטיות לפני שאתה מגיב.', habit: 'שלוש נשימות איטיות לפני כל תגובה רגשית' } },
    ],
  },
]
