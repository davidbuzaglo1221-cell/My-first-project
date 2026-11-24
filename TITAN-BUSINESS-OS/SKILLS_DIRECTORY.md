# ספריית הסקילים והכלים

כל הסקילים יושבים ב-`.claude/skills/` (בתוך הפרויקט, נשמרים ב-GitHub). נבדקו: מקור רשמי, פעילות, רישיון, כפילות, סיכון.
בדיקת סביבה (22.11.2026): ענן Linux, 4 מעבדים, 15GB זיכרון, 56GB דיסק, **בלי GPU**. Node 22, Python 3.13, ffmpeg, Chromium, Docker (לא רץ).

## הותקן ונבדק בפועל
| כלי | מקור | רישיון | מה הותקן | בדיקה |
|---|---|---|---|---|
| Superpowers | obra/superpowers | MIT | brainstorming, writing-plans, executing-plans, systematic-debugging, test-driven-development, verification-before-completion, subagent-driven-development, dispatching-parallel-agents | נטען ✓ |
| find-skills + CLI | vercel-labs/skills | MIT | find-skills; ה-CLI רץ ב-`npx skills` | נטען ✓ |
| UI UX Pro Max | nextlevelbuilder/ui-ux-pro-max-skill | MIT | ui-ux-pro-max (מאגר סגנונות, פלטות, פונטים) | חיפוש רץ ✓ |
| Emil Kowalski | emilkowalski/skills | MIT | apple-design, emil-design-eng, improve-animations, review-animations, animation-vocabulary, choreograph, learn-taste | נטען ✓ |
| Impeccable | pbakaus/impeccable | Apache-2.0 | impeccable (polish / critique / audit, תופס "AI slop") | נטען ✓ |
| HyperFrames | heygen-com/hyperframes | Apache-2.0 | hyperframes, hyperframes-cli, hyperframes-registry, reverse-any-video, style-sampling, motion-doctrine, captions-overlay | **רינדור אמיתי 10 שניות ✓** |
| Animate | cth9191/animate | MIT | animate (7 סגנונות ציור) | **רינדור MP4 עם פסקול ✓** |
| code-cartoon | famfamfam/code-cartoon | MIT | code-cartoon (מצויר, קומיקס, 3D) | רץ על HyperFrames ✓ |
| Remotion | remotion-dev/skills | חינם ליחיד ועד 3 עובדים | remotion-* (הותקן קודם) | reel-01..03 ✓ |
| Marketing Skills | coreyhaines31/marketingskills | MIT | 20 מתוך 53: copywriting, social, offers, pricing, launch, content-strategy, competitors, customer-research, marketing-ideas, ad-creative, video, lead-magnets, seo-audit, ai-seo, cold-email, emails, sales-enablement, marketing-psychology, cro, marketing-plan | נטען ✓ |
| agent-browser | vercel-labs/agent-browser | Apache-2.0 | CLI גלובלי 0.43 + סקיל | **פתח דף ב-GitHub וקרא כותרת ✓** |
| Playwright | microsoft/playwright | Apache-2.0 | מותקן מראש בסביבה | ✓ |
| MuAPI (של Open Generative AI) | SamurAIGPT/muapi-skills, muapi-cli | MIT | 61 סקילים `muapi-*` (וידאו, תמונה, אודיו, Lip Sync, Workflows); שרת MCP ב-`.mcp.json`; `.claude/schema_data.json`. לא הותקן: `muapi-selfie-with-celebrities` (תמונות מזויפות של אנשים אמיתיים) | MCP עלה עם 25 כלים ✓ (24.11.2026). דורש מפתח MuAPI בתשלום. ראו `OPEN_GENERATIVE_AI.md` |

**הערות התקנה:** agent-browser ו-HyperFrames צריכים `AGENT_BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`. ל-animate: Playwright באותה גרסה כמו הסביבה (1.63.0). אתרים חדשים צריכים אישור ברשימת הרשת של הסביבה.

## סקילים של הבית (נכתבו כאן)
| סקיל | תפקיד |
|---|---|
| `director` | המוח הראשי, רץ ראשון בכל בקשה |
| `art-direction` | בחירת כיוון אמנותי לכל פרויקט ויזואלי + סף איכות לאתרים, אפליקציות, צילום ופרסומות, CGI (23.11.2026) |
| `david-brand`, `premium-app`, `fast-video`, `social-content`, `money-engine`, `replica-*` | מותג, אפליקציות, וידאו, תוכן, כסף, שכפול אפליקציות |

> לבדיקה עתידית: 76 סקילים, ותיאורי כולם נטענים בכל סשן (~22 אלף תווים). ייתכן שחלקם נחתכים. ניקוי כפילויות (למשל `social` מול `social-content`, `video` מול `fast-video`) רק באישור דוד.

## לא הותקן, ולמה
| כלי | סיבה | מתי כן |
|---|---|---|
| media-use (HyperFrames) | קורא לשירותים בתשלום (HeyGen, fal, Gemini) | רק באישור תשלום מפורש |
| 33 סקילי שיווק נוספים | כפילות או לא רלוונטי (SaaS B2B, paywalls, ASO) | לפי צורך, ב-`npx skills add` |
| MakeMyClip Editor (MIT) | שרת MCP לעריכת צילום אמיתי (חיתוך שקט, כתוביות, ייצוא ל-Premiere). אין עדיין צילומים | כשדוד ישלח צילומים ראשונים |
| n8n | רישיון "Sustainable Use" (לא קוד פתוח מלא; מותר לשימוש פנימי, לא למכירה כשירות). צריך שרת שרץ תמיד; הסביבה הזו נמחקת | על המחשב של דוד או שרת זול, כשתהיה אוטומציה אמיתית |
| ComfyUI + Wan 2.2 | צריך GPU (Wan 2.2 5B: בערך 24GB VRAM). אין GPU | מחשב עם כרטיס מסך חזק |

## הצעות לכלים טובים יותר שלא היו ברשימה
- **Canva** (כבר מחובר): תמונות ריאליסטיות + create-video גנרטיבי. צורך ממכסת ה-AI, רק באישור.
- **FluidSynth + FluidR3_GM**: כלים מוקלטים אמיתיים למוזיקה, חינם, הותקן.
- **Firecrawl** (מחובר): מחקר שוק עם מקורות אמיתיים.
