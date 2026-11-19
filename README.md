# ASCEND

אפליקציית הלמידה נמצאת בתיקייה `ascend`.

## להתקין את ASCEND באייפון עם האייקון והשם

1. נכנסים ל-https://vercel.com/signup ובוחרים **Continue with GitHub**.
2. **Add New → Project**, ובוחרים את המאגר `My-first-project`.
3. ב-**Root Directory** לוחצים **Edit** ובוחרים `ascend`. שאר ההגדרות כבר מוגדרות בקובץ `ascend/vercel.json`.
4. בוחרים ב-**Branch** את `claude/ascend-app-build-52sxwe` (או ממזגים אותו ל-main), ולוחצים **Deploy**.
5. מקבלים כתובת כמו `https://ascend-xxxx.vercel.app`. פותחים אותה ב-**Safari** באייפון, לוחצים על כפתור השיתוף ואז **הוסף למסך הבית**. האייקון הזהוב והשם ASCEND יופיעו במסך הבית.

---

# My-first-project

אפליקציית אימונים ותזונה בעברית: יומן אימונים עם יעדים מוצעים, שיאים וסופרסטים, יומן אוכל עם זיהוי מתמונה וברקוד, משקל גוף, תמונות התקדמות, קרדיו, שיעורים והישגים. הקוד נמצא בתיקייה `web`.

## האפליקציה בתוך Claude (בלי שרת ובלי מפתח)

האפליקציה מפורסמת כ-artifact בחשבון Claude: https://claude.ai/artifact/6qSJpjP4Xm1gx1Eei94ypv
הנתונים נשמרים בחשבון Claude (פרטיים), מסתנכרנים בין מכשירים, וזיהוי האוכל מתמונה נעשה על ידי Claude עצמו.
בנייה מחדש: `cd web && npm run build:artifact` (יוצר `dist-artifact/app.html`), ובדיקה: `node e2e-artifact.cjs`.

## העלאה לשרת משלך (Vercel, לא חובה)

1. נכנסים ל-https://vercel.com/signup ובוחרים **Continue with GitHub**.
2. **Add New → Project**, ובוחרים את המאגר `My-first-project` (אם הוא לא מופיע: **Adjust GitHub App Permissions** ומאשרים גישה אליו).
3. ב-**Root Directory** לוחצים **Edit** ובוחרים `web`.
4. ב-**Environment Variables** מוסיפים שניים (רק לזיהוי מתמונה; בלעדיהם כל השאר עובד):
   - `ANTHROPIC_API_KEY`: המפתח מ-https://console.anthropic.com/settings/keys
   - `APP_ACCESS_TOKEN`: סיסמה ארוכה שתבחרו בעצמכם. בלעדיה הזיהוי מתמונה כבוי, כדי שזרים לא ישתמשו במפתח שלכם.
5. **Deploy**. בסוף מקבלים כתובת כמו `https://my-first-project-xxxx.vercel.app`.

## התקנה בטלפון

- **iPhone (Safari):** פותחים את הכתובת, לוחצים על כפתור השיתוף, ואז **הוספה למסך הבית**.
- **Android (Chrome):** פותחים את הכתובת, תפריט ⋮, ואז **התקנת האפליקציה**.
- בפרופיל באפליקציה מזינים את `APP_ACCESS_TOKEN` בשדה "קוד גישה לזיהוי מתמונה".

## הנתונים שלכם

כל הנתונים נשמרים בטלפון בלבד, אין חשבון ואין שרת שמחזיק אותם. לכן:
- פעם בשבוע: פרופיל, **שמירת גיבוי לקובץ**, ושומרים את הקובץ ב-iCloud או ב-Google Drive.
- בטלפון חדש: פרופיל, **שחזור מגיבוי**.
- ב-iPhone, השתמשו באפליקציה מהמסך הבית ולא מלשונית רגילה ב-Safari, כדי שהדפדפן לא ימחק את הנתונים.

## פיתוח

```bash
cd web
npm install
npm run dev      # http://localhost:3000
npm test         # בדיקות יחידה
npm run e2e      # בדיקה מקצה לקצה (מול next start -p 3100)
```
