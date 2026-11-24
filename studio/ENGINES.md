# מיפוי מנועים (נבדק 24.11.2026 מול התיעוד הרשמי)

רק ממשקים רשמיים. שום חיבור לא הומצא, ושום הגבלה לא נעקפת.

| | AITuber | Vaideo | Korpi | Dreamina Seedance | Canva | Picsart |
|---|---|---|---|---|---|---|
| ממשק רשמי | REST API + MCP | REST API + MCP | MCP | REST API של BytePlus (ByteDance) — לאתר Dreamina אין API | מחבר רשמי ב-Claude | מחבר רשמי ב-Claude |
| זמין מהשרת של הסטודיו | כן | כן | כן | כן | **לא** — רק מתוך שיחה עם Claude | **לא** — רק מתוך שיחה |
| טקסט לווידאו | כן | כן | כן (Veo, Kling, Seedance) | כן | כן (Seedance / h3max) | לא |
| תמונה לווידאו | כן (קליפים מפריים ראשון) | לא | כן (`animate_image`) | כן | כן (תמונות רפרנס) | לא |
| יצירת תמונות | כן, לכל סצנה | כן, לכל סצנה (+1 קרדיט) | כן (`generate_image`) | לא (Seedream בנפרד) | כן | לא בכלים המחוברים |
| סנכרון שפתיים | כן — אווטאר מדבר | לא | כן (`replace_anything`, דיבוב) | סאונד מובנה עם דיאלוג; עברית לא נבדקה | כן — מגיש על המסך | לא |
| קול וקריינות | 1,300+ קולות, שיבוט | 29 שפות כולל עברית | ElevenLabs, דיבוב | סאונד מובנה | דיבור שנוצר | לא |
| עקביות דמויות | Elements עם תמונת רפרנס (`@handle`) | לא | AI influencer | עד 9 תמונות רפרנס | עד 8 רפרנסים | ספריית דמויות לסצנות |
| רזולוציה | 1080p, ייצוא 4K | 1080p | עד 1080p | 480p–4K | 480p–768p | לפי סצנה |
| אורך | עד 20 דק׳; קליפים 1–15 שנ׳ | 6–300 שנ׳ | לפי מודל | 4–15 שנ׳ לקליפ | 5–30 שנ׳ | לפי סצנה |
| חינם | 100 קרדיטים בהרשמה | 5 קרדיטים ב-API | תכנון בלבד; תמונות במודלים חינמיים | אין מובטח | לפי מגבלת ה-AI של החשבון | יתרה לפי החשבון |
| מחיר | מ-$39 ל-2,500 קרדיטים | €0.29 לסרטון עד דקה | מ-$16.99 לחודש | $0.07–0.23 לשנייה | כלול בתוכנית | קרדיטים |

## מצב החיבור (24.11.2026)
- **Vaideo**: מפתח נשמר פעמיים, והשירות דוחה אותו (401). צריך מפתח חדש.
- **AITuber**: מפתח נשמר (24.11), והשירות מחזיר 401. שלישי ברצף (גם Vaideo, ולפני כן Korpi) — ייתכן שהבעיה בשמירה ולא במפתח. חלופה: משתנה סביבה `AITUBER_API_KEY` בהגדרות הסביבה.
- **Korpi, Seedance**: אין עדיין מפתח.
- **Canva**: מחובר, אבל מגבלת ה-AI החודשית נוצלה (`quota_exceeded` ביצירת תמונה).
- **Picsart**: מחובר, יתרה מאומתת: 5 קרדיטים. אין בו כלי טקסט-לווידאו.
- **מקומי**: עובד. אנימציה מתוכנתת, לא AI.

**למה לא useapi.net ודומיו ל-Dreamina:** הם מפעילים את חשבון Dreamina דרך האתר, בלי API רשמי. זה עוקף את תנאי השימוש — לא חיברנו.

## מקורות
- AITuber: aituber.app/api, aituber.app/mcp, app.aituber.app/api/v1/openapi.json (elements, avatars, clip-models)
- Vaideo: app2.vaideo.org/developers, app2.vaideo.org/api/v1/openapi.json
- Korpi: korpi.ai/mcp/manifest.md
- Seedance: docs.byteplus.com/en/docs/modelark/seedance-2-0, docs.byteplus.com/en/docs/modelark/model-pricing
- Dreamina בלי API: github.com/useapi/dreamina-api ("Dreamina itself is a website with no developer API")
