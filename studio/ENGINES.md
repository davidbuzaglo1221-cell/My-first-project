# דוח תאימות: מנועי וידאו (נבדק 24.11.2026)

נבדק מול האתרים והתיעוד הרשמי של כל שירות. שום חיבור לא הומצא. אין עקיפה של הגבלות.

| | Korpi AI | AITuber | Vaideo | Dreamina |
|---|---|---|---|---|
| API / MCP רשמי | **MCP רשמי** (`backend.korpi.ai/mcp`, 37 כלים). אין REST API ציבורי | **REST API + MCP רשמיים** (`app.aituber.app/api/v1`, `mcp.aituber.app`) | **REST API + MCP רשמיים** (`app2.vaideo.org/api/v1`, `/mcp`) | **לאתר עצמו אין API.** הדרך הרשמית: **BytePlus ModelArk** של ByteDance, שמריץ את אותם מודלים (Seedance 2.0 / 2.5) |
| הפעלה מתוך Claude Code | כן (MCP, ובסטודיו דרך לקוח MCP) | כן (MCP וגם REST) | כן (MCP וגם REST) | כן, דרך ה-API של ModelArk (REST) |
| חינם | **תכנון בלבד**: `write_script` ו-`plan_storyboard` חינם בכל חשבון (~30 בשעה). הפקת וידאו תמיד בקרדיטים בתשלום | **100 קרדיטים** בהרשמה, בלי כרטיס (~35 קרדיטים לסרטון 30 שנ׳) | **5 קרדיטים ל-API** בהרשמה (קרדיט = סרטון עד דקה). באפליקציה: 3 סרטונים ואז 1 בשבוע | אין מסלול חינמי מובטח ל-Seedance 2.x. BytePlus נותנת לפעמים טוקנים חינמיים לחשבון חדש, בעיקר לדגמי 1.x — נבדק רק אחרי פתיחת חשבון |
| וידאו מטקסט בלבד | כן | כן (`inputType: idea`) | כן (`prompt`) | כן (text-to-video) |
| MP4 להורדה | כן (קישור לקובץ) | כן (`/exports` → קישור חתום ל-2 דקות; הייצוא חינם) | כן (`/download`, קישור חתום ל-24 שעות, 1080p בלי סימן מים) | כן (`content.video_url`, נשמר 24 שעות) |
| מפתח / חשבון נפרד | חשבון Korpi + טוקן MCP (`korpi_mcp_…`) או התחברות OAuth | חשבון + מפתח `ak_…` | חשבון + מפתח `vd_live_…` | חשבון BytePlus + מפתח ARK (דורש אימות וחיוב לפני שימוש) |
| מה הוא מחזיר | קליפ גולמי (Veo / Kling / Seedance) או סרטון נישה מוגמר | סרטון מוגמר: תסריט, קול, תמונות AI, כתוביות | סרטון מוגמר: תסריט, קריינות (**כולל עברית**), סטוק או תמונות AI, מוזיקה, כתוביות | קליפ גולמי 5–12 שנ׳, וידאו גנרטיבי אמיתי, סאונד אופציונלי |
| עלות | לפי מודל, מוצג ע"י `list_video_models` | תוכנית ראשונה $39 ל-2,500 קרדיטים | חבילות: €29 ל-100 קרדיטים (€0.29 לסרטון) | Seedance 2.0 מהיר ‎$0.07/שנ׳, 2.0 ‎$0.15/שנ׳, 2.5 ‎$0.23/שנ׳ |

**למה לא useapi.net ודומיו ל-Dreamina:** הם מפעילים את חשבון Dreamina שלך דרך האתר (בלי API רשמי). זה עוקף את תנאי השימוש — לא חיברנו.

## מקורות
- Korpi: korpi.ai/mcp, korpi.ai/mcp/manifest.md
- AITuber: aituber.app/api, aituber.app/mcp, app.aituber.app/api/v1/openapi.json
- Vaideo: app2.vaideo.org/developers, app2.vaideo.org/api/v1/openapi.json
- Dreamina / Seedance: docs.byteplus.com/en/docs/modelark/video-generation-tutorial, docs.byteplus.com/en/docs/modelark/model-pricing, github.com/useapi/dreamina-api ("Dreamina itself is a website with no developer API")
