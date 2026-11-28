/**
 * The app's own voice: short, sure, declarative. No exclamation marks, no emoji, no slogans about "believing".
 * One line per part of the day, changing every day, so opening the app never reads the same twice in a row.
 */
const LINES: Record<'morning' | 'noon' | 'evening' | 'night', string[]> = {
  morning: [
    'הבוקר קובע את הקצב. אתה קובע את הבוקר.',
    'לא צריך מוטיבציה. צריך התחלה.',
    'מה שתעשה בשעה הקרובה יגדיר את היום.',
    'קם, בוחר, עושה. בסדר הזה.',
    'יום חדש. אותו אדם, גרסה חדה יותר.',
  ],
  noon: [
    'חצי יום מאחוריך. החצי השני עוד פתוח.',
    'עכשיו זה הזמן לדבר האחד שדחית.',
    'קצר, ממוקד, גמור. ככה נראים צהריים טובים.',
    'אל תחכה לשעה הנכונה. זו השעה.',
  ],
  evening: [
    'ערב הוא המקום שבו מחר מתחיל.',
    'סגור את היום לפני שהוא סוגר אותך.',
    'מה עבד היום? את זה לוקחים למחר.',
    'ההחלטות הקטנות של הערב בונות את הבוקר.',
  ],
  night: [
    'הלילה בונה את מה שהיום התחיל.',
    'מסך כבוי, ראש שקט, בוקר חזק.',
    'מספיק להיום. גם שקט הוא אימון.',
    'מה שלא נגמר היום, מחכה לך רענן מחר.',
  ],
}

export function partOfDay(d = new Date()) {
  const h = d.getHours()
  return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'noon' : h >= 17 && h < 22 ? 'evening' : 'night'
}

export function voiceLine(d = new Date()) {
  const list = LINES[partOfDay(d)]
  const day = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000)
  return list[day % list.length]
}
