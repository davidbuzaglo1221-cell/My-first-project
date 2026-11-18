// What the speech normalizer knows about words: the gender of the nouns numbers count, how
// units and abbreviations are said out loud, and how English terms are said inside Hebrew.
// Extend it here, then add a case to normalize.test.ts and listen to it (speech-quality-testing).
import type { Gender } from "./hebrew-numbers";

/** Nouns that follow numbers in this app, singular and plural, with their gender. */
export const NOUN_GENDER: Record<string, Gender> = {
  // masculine
  סט: "m", סטים: "m", יום: "m", ימים: "m", שבוע: "m", שבועות: "m", חודש: "m", חודשים: "m",
  גרם: "m", קילו: "m", קילוגרם: "m", "ק״ג": "m", אחוז: "m", אחוזים: "m", צעד: "m", צעדים: "m",
  תרגיל: "m", תרגילים: "m", אימון: "m", אימונים: "m", מטר: "m", מטרים: "m", קילומטר: "m", סנטימטר: "m",
  ליטר: "m", מיליליטר: "m", כוס: "f", כוסות: "f", פריט: "m", פריטים: "m", שיעור: "m", שיעורים: "m",
  שיא: "m", שיאים: "m", מחזור: "m", מחזורים: "m", קלוריות: "f", קלוריה: "f",
  // feminine
  חזרה: "f", חזרות: "f", דקה: "f", דקות: "f", שנייה: "f", שניות: "f", שעה: "f", שעות: "f",
  פעם: "f", פעמים: "f", ארוחה: "f", ארוחות: "f", שנה: "f", שנים: "f", ביצה: "f", ביצים: "f",
  מנה: "f", מנות: "f", פרוסה: "f", פרוסות: "f", כף: "f", כפות: "f", כפית: "f", כפיות: "f",
  נקודה: "f", נקודות: "f", מדרגה: "f", מדרגות: "f", סדרה: "f", סדרות: "f",
};

/** Units written after a number, and the word that is said. */
export const UNITS: Record<string, string> = {
  "ק״ג": "קילו",
  'ק"ג': "קילו",
  "קג": "קילו",
  kg: "קילו",
  "ג׳": "גרם",
  "גר׳": "גרם",
  "גר'": "גרם",
  g: "גרם",
  "מ״ל": "מיליליטר",
  'מ"ל': "מיליליטר",
  ml: "מיליליטר",
  "ס״מ": "סנטימטר",
  'ס"מ': "סנטימטר",
  cm: "סנטימטר",
  "ק״מ": "קילומטר",
  'ק"מ': "קילומטר",
  km: "קילומטר",
  "דק׳": "דקות",
  "דק'": "דקות",
  "שנ׳": "שניות",
  "קק״ל": "קלוריות",
  'קק"ל': "קלוריות",
  kcal: "קלוריות",
};

/** Abbreviations said in full. */
export const ABBREVIATIONS: Record<string, string> = {
  "וכו׳": "וכולי",
  "וכו'": "וכולי",
  "לדוג׳": "לדוגמה",
  "לדוג'": "לדוגמה",
  "ע״י": "על ידי",
  'ע"י': "על ידי",
  "בד״כ": "בדרך כלל",
  'בד"כ': "בדרך כלל",
  "מס׳": "מספר",
  "מס'": "מספר",
  "ד״ר": "דוקטור",
  "עמ׳": "עמוד",
  "ת״א": "תל אביב",
  "י-ם": "ירושלים",
};

/**
 * English terms as an Israeli says them in a Hebrew sentence. A Hebrew voice reading Latin
 * letters guesses; writing the sound in Hebrew letters keeps one voice and one rhythm.
 * Longer English phrases are not listed here: the segmenter hands them to an English voice.
 */
export const EN_IN_HEBREW: Record<string, string> = {
  RIR: "אר איי אר",
  RPE: "אר פי אי",
  PR: "פי אר",
  "1RM": "וואן אר אם",
  AMRAP: "אמראפ",
  HIIT: "הִיט",
  BMI: "בי אם איי",
  TDEE: "טי די אי אי",
  kcal: "קלוריות",
  app: "אפליקציה",
  OK: "אוקיי",
  ok: "אוקיי",
  AI: "איי איי",
  iPhone: "אייפון",
  Android: "אנדרואיד",
  Google: "גוגל",
  Claude: "קלוד",
  WhatsApp: "וואטסאפ",
  Instagram: "אינסטגרם",
  CrossFit: "קרוספיט",
  TRX: "טי אר אקס",
  Pilates: "פילאטיס",
  "Wi-Fi": "וויי פיי",
};

/** Mid-word geresh / gershayim are part of the spelling (קוטג׳, ק״ג); at word edges they are quotes. */
export const HEB_LETTER = "א-ת";
