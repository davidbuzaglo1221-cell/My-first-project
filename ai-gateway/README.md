# מרכז הבינה (ai-gateway)

שער אחד לכל מודלי ה-AI של האפליקציות: בוחר מודל לפי סוג המשימה, עובר לגיבוי כשמודל לא זמין, ומציג עלויות, שימוש, מכסות ושגיאות.

```
אפליקציה ──(קוד גישה)──▶ ai-gateway (Vercel, מחזיק את כל המפתחות)
                           │  לפי המשימה, לפי הסדר:
                           ├─ Claude (ראשי, בתשלום)
                           ├─ FreeLLMAPI (שרת ניתוב שמאחד עשרות ספקים חינמיים)
                           ├─ Gemini / Groq / Cerebras / Mistral / OpenRouter (חינם עם מפתח)
                           └─ OVH / Kilo (חינם בלי מפתח, גיבוי אחרון, כבוי כברירת מחדל)
```

## איפה מה
- `src/registry.ts`: **המרשם המרכזי**. כל ספק, כל משימה ושרשרת הגיבוי שלה. Claude ראשון בכל שרשרת, וזה לא משתנה בלי אישור.
- `src/router.ts`: מנסה את השרשרת לפי הסדר ומדלג על מה שלא מוגדר, על מודלים שלא רואים תמונות, ועל ספקים ששומרים שיחות כשהבקשה `private`. עובר הלאה על 429, 5xx, מפתח לא תקף, timeout, תשובה ריקה, JSON לא תקין וסירוב.
- `src/status.ts`: בדיקה חיה של כל ספק (רשימת מודלים בלבד, בלי לבזבז טוקנים) ומכסה שנותרה מכותרות הספק.
- `public/index.html`: לוח הבקרה בעברית.
- `freellmapi/`: הפעלת FreeLLMAPI על שרת משלך מאחורי HTTPS.

## שימוש מאפליקציה
```js
const res = await fetch("https://<gateway>/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json", "x-app-token": APP_CODE },
  body: JSON.stringify({
    task: "hebrew",            // hebrew | fast | vision | json | code
    messages: [{ role: "user", content: "שאלה" }],
    private: true,             // מידע אישי: לא נשלח לספקים ששומרים שיחות
  }),
});
const { ok, text, servedBy, fellBack, costUsd, attempts } = await res.json();
```

## אבטחה
- כל מפתח נשמר רק במשתני הסביבה של השרת. הדפדפן שולח רק קוד גישה (`APP_ACCESS_TOKEN`), ובלעדיו השער לא עונה לאף אחד.
- הבדיקות מוודאות שאף מפתח לא מופיע בתשובות או בלוח הבקרה.
- CORS פתוח רק לכתובות שב-`ALLOWED_ORIGINS`.
- `.env*` לא נכנס ל-git.

## פיתוח ובדיקות
```bash
npm install
npm test            # בדיקות יחידה
npm run typecheck
npm run dev         # http://127.0.0.1:3210 (קורא .env.local)
GATEWAY_TOKEN=... npm run e2e   # בדיקה בדפדפן מול שער פועל, כולל שיחות אמיתיות
```
