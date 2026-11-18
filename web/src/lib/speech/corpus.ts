// Sentences every engine and voice is tested on (speech-quality-testing). Each one targets a
// thing a voice gets wrong when the text is not prepared: gender agreement, ranges, decimals,
// dates, times, abbreviations, quotes, English inside Hebrew, and plain English.
export type CorpusCase = { id: string; text: string; focus: string };

export const CORPUS: CorpusCase[] = [
  { id: "he-gender", text: "היום נעשה 3 סטים של 8 חזרות, ונוח 2 דקות בין סט לסט.", focus: "gender" },
  { id: "he-range", text: "בוחרים טווח של 8 עד 12 חזרות, וכשמגיעים ל-12 מעלים 2.5 ק״ג.", focus: "range+decimal+prefix" },
  { id: "he-protein", text: "כ-1.6 עד 2.2 גרם חלבון לכל ק״ג משקל גוף ביום.", focus: "decimal range+unit" },
  { id: "he-date", text: "האימון הבא נקבע ל-15/11/2026 בשעה 18:30.", focus: "date+time" },
  { id: "he-big", text: "השבוע הרמתם בסך הכול 12,450 ק״ג, שיא חדש של 1,250 ק״ג מעל השבוע שעבר.", focus: "large numbers" },
  { id: "he-percent", text: "גירעון של 15% עד 20% מספיק, ולא יותר מזה.", focus: "percent" },
  { id: "he-abbr", text: "מקורות חלבון: ביצים, טונה, קוטג׳ וכו׳, בד״כ בכל ארוחה.", focus: "abbreviations+geresh" },
  { id: "he-quotes", text: "סט טוב נגמר כשנשארו 1 עד 3 חזרות ״בטנק״.", focus: "quotes" },
  { id: "he-acronym", text: "כמה RIR נשארו לכם בסט האחרון? אם אפס, זה כבר PR.", focus: "english acronyms" },
  { id: "he-en-phrase", text: "המאמנים אומרים keep your core tight, כלומר לשמור על בטן אסופה.", focus: "english phrase in hebrew" },
  { id: "he-question", text: "מוכנים? נתחיל בחימום קל, ואז נעבור לתרגיל המרכזי.", focus: "question intonation" },
  { id: "he-long", text: "השריר נבנה בזמן ההתאוששות ולא בזמן האימון, ולכן שינה של 7 עד 9 שעות, תזונה עם מספיק חלבון ומנוחה בין האימונים הן חלק מהתוכנית בדיוק כמו המשקולות.", focus: "long sentence rhythm" },
  { id: "en-plain", text: "Rest for two minutes, then start your next set of eight reps.", focus: "english" },
  { id: "en-numbers", text: "On November 15, 2026 you lifted 12,450 kilograms in total.", focus: "english numbers+date" },
];
