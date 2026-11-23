# צוות הסוכנים

דוד ביקש 19 תפקידים. לא יצרנו 19 סוכנים: כל סוכן נפרד מתחיל מאפס, קורא שוב את ההקשר, ועולה זמן ומשאבים. במקום זה: **השיחה הראשית היא המנהל**, ו-7 סוכנים מתמחים מכסים את כל 19 התפקידים. הקבצים שלהם: `.claude/agents/`.

| סוכן | קובץ | התפקידים שהוא מכסה | מתי מפעילים |
|---|---|---|---|
| **Chief Orchestrator** | השיחה הראשית + סקיל `director` | 1 מנהל, 7 Creative Director | תמיד |
| `strategist` | strategist.md | 2 Business Strategist, 3 Market Researcher, 14 Sales Specialist | מחקר שוק, מתחרים, הערכת רעיון, הצעת מחיר |
| `product-builder` | product-builder.md | 4 Product Architect, 5 Senior Developer | אפליקציה, אתר, מערכת הזמנות, Micro-SaaS |
| `designer` | designer.md | 6 UI/UX Designer | עיצוב מסכים, ביקורת עיצוב |
| `video-studio` | video-studio.md | 8 Video Director, 9 Editor, 10 Animation, 11 Motion, 12 Sound | כל סרטון |
| `marketer` | marketer.md | 13 Marketing Strategist, 15 SEO | קמפיין, תוכן, דף נחיתה, SEO |
| `automation-engineer` | automation-engineer.md | 16 Automation Engineer, 17 Browser Agent | אוטומציות, פעולות בדפדפן |
| `qa-security` | qa-security.md | 18 QA, 19 Security | לפני כל משלוח, לפני התקנת קוד חיצוני |

**כלל:** משימה קטנה → המנהל עושה לבד. משימה עם כמה חלקים עצמאיים (למשל מחקר מתחרים + עיצוב + קוד) → סוכנים במקביל. אף סוכן לא שולח, מפרסם או קונה כלום.


## Ruflo (נוסף 23.11.2026)
81 סוכני פיתוח ותיאום של Ruflo יושבים בתיקיות-משנה של `.claude/agents/`. הם **מצטרפים** לסוכני הבית רק במשימות פיתוח, בדיקה ואבטחה, עד 6 סוכנים בסך הכול. טבלת הניתוב והכללים: `RUFLO.md`.
