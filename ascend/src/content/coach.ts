/**
 * The coach's sessions: short, sharp question sequences that end in one concrete action.
 * Direct, honest, respectful. No empty praise. Each session names which answer becomes the goal or the commitment.
 */
export interface CoachSession {
  id: string
  title: string
  /** One line: when to use it. */
  when: string
  minutes: number
  questions: { q: string; hint?: string }[]
  /** Index of the answer that becomes the next commitment. */
  commitFrom: number
  /** Clarity sets the goal from these answers. */
  goalFrom?: { text: number; why: number }
}

export const coachSessions: CoachSession[] = [
  {
    id: 'clarity',
    title: 'בהירות',
    when: 'כשאין כיוון ברור, או שיש יותר מדי כיוונים',
    minutes: 5,
    questions: [
      { q: 'מה אתה רוצה שיהיה שונה בחיים שלך בעוד 90 יום?', hint: 'משפט אחד. בלי "אולי" ובלי "לנסות".' },
      { q: 'למה זה חשוב לך באמת?', hint: 'תענה, ואז תשאל "ולמה זה?" עוד פעם אחת. התשובה השנייה היא האמיתית.' },
      { q: 'איך תדע שהגעת? מה תראה, תשמע או תמדוד?', hint: 'משהו שאפשר לבדוק, לא תחושה.' },
      { q: 'מה אתה עושה היום שמרחיק אותך מזה?', hint: 'תהיה כן. אף אחד לא קורא את זה חוץ ממך.' },
      { q: 'מה הצעד הכי קטן שתעשה ב-48 השעות הקרובות?', hint: 'קטן מספיק כדי שלא יהיה לך תירוץ.' },
    ],
    commitFrom: 4,
    goalFrom: { text: 0, why: 1 },
  },
  {
    id: 'avoid',
    title: 'מה אתה דוחה',
    when: 'כשמשהו חשוב תקוע כבר יותר מדי זמן',
    minutes: 4,
    questions: [
      { q: 'מה הדבר שאתה יודע שאתה צריך לעשות, ודוחה?' },
      { q: 'מה אתה מספר לעצמך כדי לא לעשות את זה?', hint: '"אין לי זמן", "זה לא הרגע", "אני צריך להתכונן עוד". מה שלך?' },
      { q: 'מה המחיר שאתה משלם על כל שבוע שזה לא קורה?' },
      { q: 'מה הגרסה של שתי דקות של המשימה הזאת?', hint: 'לא לסיים. רק להתחיל.' },
      { q: 'מתי בדיוק תעשה את שתי הדקות? יום ושעה.' },
    ],
    commitFrom: 3,
  },
  {
    id: 'decide',
    title: 'החלטה תקועה',
    when: 'כשאתה מתלבט ולא זז',
    minutes: 5,
    questions: [
      { q: 'על מה אתה צריך להחליט? כתוב את שתי האפשרויות.' },
      { q: 'אם חבר טוב היה מביא לך את הבעיה הזאת, מה היית אומר לו?' },
      { q: 'מה התרחיש הכי גרוע בכל אפשרות, והאם תשרוד אותו?' },
      { q: 'איזו בחירה תכבד בעוד עשר שנים?' },
      { q: 'מה הצעד הראשון שהופך את ההחלטה לאמיתית?' },
    ],
    commitFrom: 4,
  },
  {
    id: 'reset',
    title: 'יום קשה',
    when: 'כשהיום הפיל אותך ואתה צריך לחזור לעצמך',
    minutes: 3,
    questions: [
      { q: 'מה בדיוק קרה? רק עובדות, בלי פרשנות.' },
      { q: 'מה הסיפור שסיפרת לעצמך על מה שקרה?', hint: 'העובדות הן דבר אחד. הסיפור הוא מה שכואב.' },
      { q: 'מה כאן בשליטתך, ומה לא?' },
      { q: 'מה הדבר הקטן שיחזיר לך עשרה אחוז אנרגיה עכשיו?', hint: 'הליכה, מקלחת, שיחה, שינה מוקדמת.' },
    ],
    commitFrom: 3,
  },
  {
    id: 'week',
    title: 'סיכום שבוע',
    when: 'פעם בשבוע, עשר דקות שמכוונות את השבוע הבא',
    minutes: 6,
    questions: [
      { q: 'מה עבד השבוע? מה תעשה יותר?' },
      { q: 'מה לא עבד? מה הלקח, בלי להלקות את עצמך?' },
      { q: 'איפה היית כן עם עצמך השבוע, ואיפה פחות?' },
      { q: 'מה ההתחייבות האחת לשבוע הבא?', hint: 'אחת. לא שלוש.' },
    ],
    commitFrom: 3,
  },
]

export const coachSessionById: Record<string, CoachSession> = Object.fromEntries(coachSessions.map((s) => [s.id, s]))
