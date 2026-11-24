# Open Generative AI — סטודיו יצירת מדיה

מקור: https://github.com/Anil-matcha/Open-Generative-AI (MIT). הותקן ונבדק 24.11.2026.

## מה זה באמת
ממשק (Next.js) מעל השירות בתשלום **MuAPI**. כמעט כל יצירה (תמונה, וידאו, אודיו, Lip Sync, Workflows, סוכנים) עוברת דרך api.muapi.ai ועולה קרדיטים.
מודלים מקומיים קיימים רק באפליקציית הדסקטופ (Electron): sd.cpp לתמונות (עובד גם על מעבד, איטי), Wan2GP לוידאו (חייב כרטיס NVIDIA/AMD). בענן שלנו אין GPU ואין מסך, אז מקומי לא רלוונטי כאן.

## איפה זה יושב
- האפליקציה: `/home/user/Open-Generative-AI` — **מחוץ** לפרויקט, לא נוגעת בו. המחשב בענן נמחק בסוף סשן.
- הפעלה בכל סשן: `bash tools/open-generative-ai/start.sh` (משכפל, מתקין, בונה ומפעיל אם חסר). נבדק מאפס ✓.
- כתובת: http://localhost:3000/studio (בתוך המחשב בענן).
- חשוב: השרת חייב `NODE_USE_ENV_PROXY=1` כדי לעבור דרך רשת הענן (הסקריפט עושה את זה).

## חיבור ל-Claude Code (רשמי, מהפרויקט עצמו)
- **MCP**: `.mcp.json` → `muapi mcp serve` (25 כלים: תמונה, וידאו, תמונה→וידאו, אודיו, Lip Sync, Clipping, Workflows, יתרה). נבדק שעולה ✓.
- **CLI**: `muapi` (pip, כי הבינארי של npm חסר ל-Linux בגרסה 0.2.7).
- **סקילים**: 61 סקילים `muapi-*` ב-`.claude/skills`.
- **מפתח**: נשמר כסוד רשת בסביבת הענן (כותרת `x-api-key` ל-api.muapi.ai) ומוזרק אוטומטית. לא בקוד, לא ב-Git. בפקודות: `MUAPI_API_KEY=proxy-injected`.
- לפני כל יצירה בתשלום: אישור מפורש של דוד (חוקי הברזל).

## רשת שנוספה לסביבה
api.muapi.ai, muapi.ai, cdn.muapi.ai, d3adwkbyhxyrtq.cloudfront.net

## בדיקות (24.11.2026)
- `npm run setup` ✓, `npm run build` ✓, `vite build` (דסקטופ) ✓, 92/92 בדיקות ✓.
- 17 הסטודיואים נטענים בדפדפן אמיתי בלי שגיאות JavaScript ✓.
- חלק מתמונות הדוגמה של MuAPI מחזירות Access Denied מהשרת שלהם (לא תקלה אצלנו).
- המפתח הראשון שנשמר נדחה ע"י MuAPI (403) — צריך להחליף במפתח תקין.
