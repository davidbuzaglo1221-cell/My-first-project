# Ruflo — שכבת התיאום של TITAN

Ruflo (לשעבר claude-flow, github.com/ruvnet/ruflo, רישיון MIT) הותקן בהתקנת ה-CLI המלאה, גרסה **3.80.1** (נעולה), ב-23.11.2026.
הוא **לא מחליף** את TITAN: השיחה הראשית + `director` נשארים המנהל, ו-7 הסוכנים של הבית מובילים את העבודה. Ruflo מוסיף זיכרון משותף בין סוכנים, ניהול משימות ונחיל (swarm), הגנה על פקודות מסוכנות, ו-81 סוכני פיתוח.

## מה מותקן
| רכיב | איפה | מצב |
|---|---|---|
| שרת MCP `claude-flow` | `.mcp.json` (`npx -y ruflo@3.80.1 mcp start`) | עובד ✓ — מצומצם ל-103 כלים (מתוך 394) |
| Hooks (6 סוגים) | `.claude/settings.json` → `.claude/helpers/` | עובד ✓ |
| 40 סקילים | `.claude/skills/` (agentdb-*, swarm-*, sparc, v3-* ...) | נטענים ✓ |
| 89 קובצי סוכנים / 81 שמות ייחודיים | `.claude/agents/<קטגוריה>/` | נטענים ✓ |
| 21 קבוצות פקודות | `.claude/commands/` (`/swarm`, `/sparc`, `/hive-mind` ...) | נטענות ✓ |
| הגדרות וזיכרון | `.claude-flow/config.yaml`, `.swarm/memory.db` | ✓ |

## כללי חיסכון (חובה)
- **לא מפעילים נחיל לכל בקשה.** משימה קטנה → המנהל לבד. 2–3 חלקים עצמאיים → 2–3 סוכנים. **תקרה: 6 סוכנים** (`maxAgents: 6`).
- כל סוכן נוסף ≈ עלות הקשר מלאה מחדש (בערך 20–40 אלף טוקנים לפתיחה). לכן סוכן רק כשהוא חוסך זמן או משפר איכות.
- כלי ה-MCP נטענים "לפי דרישה" (Tool Search), אז הם לא אוכלים הקשר עד שמשתמשים בהם.
- `agent_execute` ו-`managed_agent_*` קוראים ל-API של Anthropic בתשלום ודורשים `ANTHROPIC_API_KEY` — **אין מפתח ולא מוסיפים**. סוכנים רצים דרך הכלי Agent הרגיל של Claude Code (במנוי).
- `flow-nexus-*`, Cognitum, federation, sponsored proxy — שירותי ענן עם הרשמה. **לא בשימוש.**

## ניתוב לפי סוג משימה
| משימה | מוביל (בית) | סוכני Ruflo שמצטרפים רק כשצריך | כלי Ruflo |
|---|---|---|---|
| פיתוח אפליקציה / אתר | `product-builder` | `planner`, `system-architect`, `backend-dev`, `mobile-dev`, `tdd-london-swarm`, `production-validator` | `swarm_init` (hierarchical, 3–5), `task_*`, `memory_*` |
| סרטון | `video-studio` | — (אין ל-Ruflo סוכני וידאו) | `memory_store` לבריף ולתסריט, `task_*` למעקב |
| עיצוב | `designer` | — | `memory_*` לשמירת החלטות עיצוב |
| שיווק ותוכן | `marketer` | — | `memory_*` (הוקים, מה עבד) |
| מכירות והצעות מחיר | `strategist` | — | `memory_*` |
| מחקר עסקי | `strategist` | `analyst` (ניתוח נתונים), `sublinear-goal-planner` (תכנון יעדים) | `memory_search` על מחקרים קודמים |
| בדיקה ואבטחה לפני משלוח | `qa-security` | `code-analyzer`, `security-architect`, `injection-analyst`, `pii-detector` | `aidefence_scan` על טקסט חיצוני |
| GitHub / שחרור גרסה | `product-builder` | `pr-manager`, `release-manager` | — |

**איך הסוכנים משתפים פעולה:** המנהל שומר בריף ב-`memory_store` (namespace `titan`, מפתח לפי פרויקט), כל סוכן קורא אותו עם `memory_retrieve`, כותב את התוצר שלו למפתח משלו, והמנהל מאחד. כך אף סוכן לא צריך את כל השיחה.

## איך מפעילים
- בשיחה רגילה: פשוט מבקשים. המנהל מחליט אם צריך סוכנים.
- לבקש במפורש: "תפעיל נחיל של 3 סוכנים ל..." או `/swarm`, `/sparc`.
- בטרמינל: `ruflo doctor` (בדיקת בריאות), `ruflo memory list`, `ruflo swarm status`.

## מה שונה מההגדרות של Ruflo (ולמה)
- הוסר ההוק `UserPromptSubmit route`: ניתב כל בקשה בעברית ל-`coder` (ביטחון 30%) והוסיף טקסט לכל הודעה. הניתוב נעשה ע"י `director`.
- כובו הודעות פרסום / "funnel" (`RUFLO_FUNNEL=0`) והפעלה אוטומטית שכותבת להגדרות הגלובליות (`RUFLO_NO_AUTO_ENABLE=1`).
- לא הופעלו ה-"mods" (פלאגינים שרצים בהרשאות החשבון ולא נסרקו) ולא שרתי הענן (`--cloud-mcp`).
- `maxAgents` ירד מ-15 ל-6.
- גיבוי לפני ההתקנה: commit `33fe2c6` (תגית מקומית `pre-ruflo-backup`). שחזור: `git checkout 33fe2c6 -- .claude CLAUDE.md .gitignore`.

## מגבלות שנבדקו
- Ruflo מפרסם "98 סוכנים"; ההתקנה המלאה (`--full --all-agents`) מתקינה בפועל **89 קבצים = 81 שמות ייחודיים** (8 כפולים בתוך Ruflo עצמו, וקובץ דפדפן אחד בפורמט yaml שלא נטען כסוכן). אין התנגשות עם 7 הסוכנים או 75 הסקילים של הבית.
- הסוכנים של Ruflo כולם לפיתוח תוכנה ותיאום. לסרטונים, עיצוב, שיווק ומכירות — סוכני הבית.
- בסביבת ענן חדשה, הפעלה ראשונה של ה-MCP מורידה את החבילה (~דקה).
