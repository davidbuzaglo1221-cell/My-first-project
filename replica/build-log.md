# Build log

Data is local (IndexedDB, Dexie) behind `src/data/repo.ts` and `src/data/nutrition-repo.ts`, whose signatures the Supabase layer will keep. Tests: 21 unit tests (`npm test`), and an end-to-end run of every flow at 390 px and 1440 px, light and dark, with no console errors and no horizontal scroll. Screenshots: `replica/clone-screens/`.

| ID | date | status | missing | harder than expected |
| --- | --- | --- | --- | --- |
| S04 בית | 2026-10-26 | done | cardio and weigh-in in the "עוד" sheet are disabled | the FAB covered content; replaced by a 4th tile |
| S06 מתעד אימון | 2026-10-26 | done | supersets UI, user notes, plate calculator | two "סיום" buttons on one screen (finish vs close keypad); renamed the keypad's to "סגירה" |
| S07 טיימר מנוחה | 2026-10-26 | partial | push when the screen is locked (needs the backend: QStash + Web Push) | wake lock is denied in some browsers; the timer is computed from an end time so it survives sleep |
| S08 בוחר תרגילים | 2026-10-26 | done | equipment filter | |
| S09 ספריית תרגילים | 2026-10-26 | partial | 38 exercises, not 600; no media | the open library's licence must be checked before import |
| S10 פרטי תרגיל | 2026-10-26 | done | media | SVG has no `dir`; charts use `direction="ltr"` |
| S12 סיום אימון | 2026-10-26 | done | share card | |
| S13 אימונים | 2026-10-26 | partial | template editor, drag to reorder | |
| S18 התקדמות | 2026-10-26 | partial | Strength Score, muscle balance | Strength Score needs strength standards per lift; specified, not built |
| S20 היסטוריה | 2026-10-26 | done | | |
| S21 פרטי אימון | 2026-10-26 | partial | editing old sets | |
| S26 יעדים | 2026-10-26 | done | | |
| S27 תזונה היום | 2026-10-26 | done | saved meals, water | |
| S28 צילום ארוחה (Calzo) | 2026-10-26 | done | live test with a real key (tested with a mocked response and with an invalid key against the real API) | iPhone photos need EXIF orientation; resized in the browser before upload |
| S29 ברקוד | 2026-10-26 | partial | camera scan on iPhone Safari (no BarcodeDetector there); typing the number works everywhere | |
| S30 פרופיל | 2026-10-26 | done | account (needs the backend) | a dark-theme user saw a light flash on every load; theme now applied before first paint |
| S01 הרשמה, S02 אונבורדינג, S15–S17 תוכניות, S23–S25 גוף וקרדיו, S28 הרגלים, S29 שיעורים, S32 | — | not started | | |

Parity (`parity.py`): 64.1, 19 of 31 must-haves. Missing must-haves: sign-up (backend), suggested plan after onboarding, Strength Score and its transparent formula, the open exercise library, push for the locked-screen timer, custom exercise UI, template editor, history editing, bodyweight log.
