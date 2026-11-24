// What each engine can do, checked against its official documentation (24-25.11.2026), plus engines that are
// reachable only from a Claude chat (connectors) and not from the studio server. Shown on the Engines screen.
export const CATALOG = [
  { id: 'aituber', name: 'AITuber', access: 'API ו-MCP רשמיים', t2v: 'כן', i2v: 'כן (קליפים מפריים ראשון)', image: 'כן, לכל סצנה', lipsync: 'כן — אווטאר מדבר', voice: '1,300+ קולות, שיבוט קול', consistency: 'כן — Elements עם תמונת רפרנס', resolution: '1080p, ייצוא 4K', length: 'עד 20 דק׳; קליפים 1–15 שנ׳', free: '100 קרדיטים בהרשמה', price: 'מ-$39 ל-2,500 קרדיטים', source: 'https://aituber.app/api/' },
  { id: 'vaideo', name: 'Vaideo', access: 'API ו-MCP רשמיים', t2v: 'כן', i2v: 'לא', image: 'כן, לכל סצנה (+1 קרדיט)', lipsync: 'לא', voice: 'קריינות ב-29 שפות כולל עברית', consistency: 'לא', resolution: '1080p', length: '6–300 שנ׳', free: '5 קרדיטים ב-API', price: '€0.29 לסרטון עד דקה', source: 'https://app2.vaideo.org/developers' },
  { id: 'korpi', name: 'Korpi', access: 'MCP רשמי', t2v: 'כן (Veo, Kling, Seedance)', i2v: 'כן (animate_image)', image: 'כן (מודלים חינמיים עם תקרה)', lipsync: 'כן (replace_anything, דיבוב)', voice: 'קריינות ElevenLabs, דיבוב', consistency: 'כן — AI influencer', resolution: 'עד 1080p', length: 'לפי מודל', free: 'תסריט ותכנון בלבד; תמונות במודלים חינמיים', price: 'מ-$16.99 לחודש', source: 'https://korpi.ai/mcp/manifest.md' },
  { id: 'seedance', name: 'Dreamina Seedance (BytePlus)', access: 'API רשמי של ByteDance', t2v: 'כן', i2v: 'כן', image: 'לא (Seedream בנפרד)', lipsync: 'סאונד מובנה עם דיאלוג; עברית לא נבדקה', voice: 'סאונד מובנה', consistency: 'כן — עד 9 תמונות רפרנס', resolution: '480p–4K', length: '4–15 שנ׳ לקליפ', free: 'אין מובטח', price: '$0.07–0.23 לשנייה', source: 'https://docs.byteplus.com/en/docs/modelark/seedance-2-0' },
  { id: 'canva', name: 'Canva', access: 'מחבר רשמי ב-Claude (רק מהשיחה, לא מהשרת)', t2v: 'כן (Seedance / h3max)', i2v: 'כן (תמונות רפרנס)', image: 'כן', lipsync: 'כן — מגיש על המסך', voice: 'כן, דיבור שנוצר', consistency: 'כן — עד 8 רפרנסים', resolution: '480p–768p', length: '5–30 שנ׳', free: 'לפי מגבלת ה-AI החודשית של החשבון', price: 'כלול בתוכנית Canva', source: 'מחבר Canva', chatOnly: true },
  { id: 'picsart', name: 'Picsart', access: 'מחבר רשמי ב-Claude (רק מהשיחה)', t2v: 'לא (מושן גרפיקס וסצנות)', i2v: 'לא', image: 'לא בכלים המחוברים', lipsync: 'לא', voice: 'לא', consistency: 'ספריית דמויות לסצנות', resolution: 'לפי סצנה', length: 'לפי סצנה', free: 'יתרה לפי החשבון', price: 'קרדיטים', source: 'מחבר Picsart', chatOnly: true },
  { id: 'local', name: 'מקומי', access: 'רץ אצלנו', t2v: 'אנימציה מתוכנתת — לא AI', i2v: 'תמונת הדמות בתנועה', image: 'לא', lipsync: 'לא', voice: 'קריינות עברית, קול לכל דמות', consistency: 'תמונת הרפרנס השמורה', resolution: '1080p', length: '6–180 שנ׳', free: 'תמיד', price: 'חינם', source: '' },
];

// Which engine to recommend for each kind of task (free first; paid only with approval).
export const RECOMMEND = [
  { task: 'פירות / חיות מדברים עם אותה דמות בכל סצנה', engines: ['aituber', 'seedance', 'korpi'] },
  { task: 'דמות שמדברת למצלמה עם סנכרון שפתיים', engines: ['aituber', 'korpi', 'seedance'] },
  { task: 'קריינות בעברית על סרטון מוגמר', engines: ['vaideo', 'local'] },
  { task: 'קולנועי / היפר־ריאליסטי, תנועה אמיתית', engines: ['seedance', 'korpi'] },
  { task: 'טיוטה מהירה בחינם, בלי מפתחות', engines: ['local'] },
];
