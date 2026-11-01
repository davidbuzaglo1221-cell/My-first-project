export interface OfferInput {
  product: string;
  customer: string;
  problem: string;
  price: string;
  desiredResult: string;
}

export interface OfferOutput {
  statement: string;
  valueProposition: string;
  customerProfile: string[];
  messages: string[];
  contentIdeas: string[];
  acquisitionPlan: string[];
  experiment: string;
  caveat: string;
}

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

/**
 * Turns the user's inputs into a structured draft. This is template-based and does not predict revenue.
 * The draft is meant to be edited and tested with real people.
 */
export function buildOffer(input: OfferInput): OfferOutput {
  const product = clean(input.product);
  const customer = clean(input.customer);
  const problem = clean(input.problem);
  const result = clean(input.desiredResult);
  const price = clean(input.price);

  return {
    statement: `${product} עבור ${customer}, שמטרתם ${result}. ההצעה מתאימה למי שמתמודד עם: ${problem}.`,
    valueProposition: `במקום להתמודד לבד עם ${problem}, ${customer} מקבלים ${product} שמתמקד ב-${result}. המחיר (${price}) מתייחס לתוצאה המוגדרת, לא לשעות בלבד.`,
    customerProfile: [
      `מי הוא: ${customer}.`,
      `הכאב העיקרי: ${problem}.`,
      `מה חשוב לו: ${result}.`,
      `מה עוזר לו להחליט: דוגמה ממשית, תהליך ברור, ומספר מוגדר של שלבים.`,
      `מה מונע ממנו לקנות: חשש מסיכון, תקציב לא ברור, או תחושה שזה לא מתאים לו.`,
    ],
    messages: [
      `${customer}, אם ${problem} עולה לכם כל שבוע, שווה לבדוק איך לפתור את זה. אני עוזר/ת ל${result}.`,
      `${product}: שלבים קצרים, מטרה אחת, ותוצאה שאפשר למדוד. מתאים לכם לשוחח 15 דקות השבוע?`,
      `מה הכי קשה עכשיו ב${problem}? אני שואל/ת כי זה מה שמעצב את ההצעה שאציע.`,
    ],
    contentIdeas: [
      `סיפור לקוח אמיתי (אחרי אישור) על ${problem} והדרך שבה התמודדו.`,
      `שלוש טעויות נפוצות שרואים אצל ${customer} בנושא ${problem}.`,
      `הסבר של 60 שניות: איך נראית תוצאה טובה של ${result}.`,
      `שאלה פתוחה לקהל: מה ניסיתם כבר כדי לפתור ${problem}?`,
      `סרטון 'מה הייתי עושה אם הייתי מתחיל מאפס' על הבעיה.`,
    ],
    acquisitionPlan: [
      `שבוע 1: לרשום 20 אנשים שמתאימים לתיאור הלקוח, ולשלוח להם שאלה אחת על הבעיה.`,
      `שבוע 2: לקבוע 5 שיחות גילוי קצרות, ולתעד את המילים שהלקוחות משתמשים בהן.`,
      `שבוע 3: לנסח את ההצעה מחדש לפי המילים שלהם, ולהציע לקבוצה קטנה גישה ניסיונית.`,
      `שבוע 4: לסכם כמה התחילו תהליך, מה עזר להם להחליט, ומה לשנות בהצעה.`,
    ],
    experiment: `שלח את ההודעה השנייה ל-10 אנשים מתאימים. מדידה: כמה ענו, כמה קבעו שיחה, וכמה ביקשו פרטים על המחיר. אם אף אחד לא ענה, בדוק קודם את הבעיה ואת הקהל לפני שאתה משנה את המחיר.`,
    caveat: "זו טיוטה לבדיקה, לא הערכה של הכנסה. אין כאן תחזית לתוצאה. התוצאה נקבעת לפי מה שאנשים אמיתיים עושים.",
  };
}
