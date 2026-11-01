import type { Area, Goal } from "../lib/types";

export interface CatalogAction {
  id: string;
  area: Area;
  minutes: number;
  title: string;
  detail: string;
  goals: Goal[];
}

// Each action is small, concrete and can be completed in the stated time.
export const ACTIONS: CatalogAction[] = [
  { id: "b-walk", area: "body", minutes: 5, title: "הליכה של 5 דקות אחרי ארוחה גדולה", detail: "הליכה קלה, בלי לחץ על קצב. שים לב איך אתה מרגיש אחרי 5 דקות.", goals: ["health", "sleep", "stress"] },
  { id: "b-sleep", area: "body", minutes: 3, title: "הכנה לשינה: מסכים כבויים 20 דקות לפני השכיבה", detail: "כבה התראות ומסכים, והחלף בפעולה שקטה אחת. זה הצעד היחיד של היום.", goals: ["sleep", "stress"] },
  { id: "b-breath", area: "body", minutes: 4, title: "4 דקות נשימה איטית", detail: "שאיפה דרך האף לספירה של 4, נשיפה לספירה של 6. חזור על זה ברציפות.", goals: ["stress", "health", "confidence"] },
  { id: "b-strength", area: "body", minutes: 8, title: "3 סטים של תרגיל כוח אחד עד קרוב לכישלון", detail: "בחר תרגיל אחד שאתה יכול לעשות בצורה נקייה (שכיבות סמיכה, כפיפות, סקוואט). עצור כשנשאר לך מקום לחזרה נוספת אחת.", goals: ["health", "confidence", "discipline"] },
  { id: "b-water", area: "body", minutes: 2, title: "בדיקת ארוחת בוקר ושתייה", detail: "רשום מה אכלת והאם שתית מים עד הצהריים. בלי שיפוט, רק תצפית.", goals: ["health", "sleep"] },
  { id: "b-run", area: "body", minutes: 10, title: "10 דקות הליכה מהירה או ריצה קלה", detail: "קצב שמאפשר לדבר במשפטים מלאים. זה מתאים לימים שיש בהם יותר זמן.", goals: ["health", "stress", "sleep"] },
  { id: "m-thought", area: "mind", minutes: 5, title: "מחשבה מעיקה: עובדה מול פרשנות", detail: "כתוב מחשבה אחת שמעיקה. הפרד: מה קרה בפועל? מה אני מפרש? איזה צעד קטן זה מצריך?", goals: ["confidence", "stress", "discipline"] },
  { id: "m-assert", area: "mind", minutes: 4, title: "משפט התנגדות אחד ברור", detail: "בחר מצב שבו רצית להגיד 'לא' או לבקש משהו. נסח משפט אחד: 'אני לא יכול/ה ל... כי...'. אמור אותו בקול.", goals: ["communication", "relationships", "confidence"] },
  { id: "m-start", area: "mind", minutes: 2, title: "התחל משימה שנדחית, ל-2 דקות בלבד", detail: "לא צריך לסיים. רק להתחיל. אחרי 2 דקות החלט אם להמשיך.", goals: ["discipline", "confidence"] },
  { id: "m-listen", area: "mind", minutes: 4, title: "שאלה פתוחה, ואז שתיקה של 10 שניות", detail: "בשיחה היום שאל שאלה פתוחה אחת ('מה חשוב לך ב...?'), ואל תמלא את השתיקה שאחריה.", goals: ["relationships", "communication", "sales"] },
  { id: "m-reflect", area: "mind", minutes: 5, title: "שלוש שורות: מה למדתי היום", detail: "כתוב שלוש שורות על משהו שלא ידעת אתמול, ואיך אתה יכול לבדוק אותו.", goals: ["finance", "business", "discipline"] },
  { id: "m-read", area: "mind", minutes: 10, title: "10 דקות קריאה בעיון בשיעור מהספרייה", detail: "קרא שיעור אחד, כתוב הערה אחת, וסמן מה תנסה בפועל.", goals: ["confidence", "sales", "business", "finance", "sleep", "relationships", "communication", "stress", "discipline", "health"] },
  { id: "w-questions", area: "work", minutes: 5, title: "שלוש שאלות גילוי ללקוח פוטנציאלי", detail: "כתוב שלוש שאלות שהיית שואל לפני שמציג הצעה: מה המצב כיום, מה חשוב להם, מה ינתק את התקיעות.", goals: ["sales", "business"] },
  { id: "w-sim", area: "work", minutes: 8, title: "סבב אחד בסימולטור המכירות", detail: "בחר תרחיש ושחק סבב מלא. קרא את המשוב והחלט על דבר אחד לשפר.", goals: ["sales", "communication", "confidence"] },
  { id: "w-followup", area: "work", minutes: 3, title: "הודעת מעקב אחת, מקצועית", detail: "שלח הודעה למי שביקש זמן לחשוב. הודעה קצרה, עם שאלה אחת וצעד הבא מוצע.", goals: ["sales", "business"] },
  { id: "w-unit", area: "work", minutes: 6, title: "חישוב רווח לשעה לפעילות אחת", detail: "כמה שעות לוקח התהליך, מה העלות הישירה, ומה נשאר. חלק את הרווח בשעות. מספר אחד מספיק.", goals: ["finance", "business"] },
  { id: "w-experiment", area: "work", minutes: 10, title: "ניסוי ביקוש: הודעה ל-5 אנשים מתאימים", detail: "שלח הודעה קצרה עם הבעיה והתוצאה, בלי מבצע. ספור כמה ענו. זו המדידה.", goals: ["business", "sales"] },
  { id: "w-focus", area: "work", minutes: 3, title: "בחירת משימה מקצועית אחת לשעה הראשונה", detail: "בחר את הדבר החשוב ביותר לעשות היום בעבודה או בעסק, וכתוב את הצעד הראשון שלו.", goals: ["discipline", "business", "finance"] },
];

export const AREA_LABEL: Record<Area, string> = {
  body: "גוף ושינה",
  mind: "מחשבה והתנהגות",
  work: "עבודה ועסק",
};

export const GOAL_LABEL: Record<Goal, string> = {
  confidence: "ביטחון עצמי",
  discipline: "משמעת ועקביות",
  stress: "ניהול לחץ",
  sleep: "שינה",
  health: "בריאות וכושר",
  relationships: "זוגיות וקשרים",
  communication: "תקשורת",
  sales: "מכירות",
  business: "עסק ושיווק",
  finance: "כלכלה אישית",
};
