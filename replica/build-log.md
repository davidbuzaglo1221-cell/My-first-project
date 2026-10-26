# Build log

Data is local (IndexedDB, Dexie) behind `src/data/repo.ts` and `src/data/nutrition-repo.ts`, whose signatures the Supabase layer will keep. Tests: 39 unit tests (`npm test`), and an end-to-end run of every flow at 390 px and 1440 px, light and dark, with no console errors and no horizontal scroll. Screenshots: `replica/clone-screens/`.

| ID | date | status | missing | harder than expected |
| --- | --- | --- | --- | --- |
| S04 בית | 2026-10-26 | done | cardio in the "עוד" sheet is disabled | the FAB covered content; replaced by a 4th tile |
| S06 מתעד אימון | 2026-10-26 | done | supersets UI, user notes, plate calculator | two "סיום" buttons on one screen (finish vs close keypad); renamed the keypad's to "סגירה" |
| S07 טיימר מנוחה | 2026-10-26 | partial | push when the screen is locked (needs the backend: QStash + Web Push) | wake lock is denied in some browsers; the timer is computed from an end time so it survives sleep |
| S08 בוחר תרגילים | 2026-10-26 | done | equipment filter | |
| S09 ספריית תרגילים | 2026-10-26 | partial | 83 exercises, not 600; no media; muscle + equipment filters done | the open library's licence must be checked before import |
| S10 פרטי תרגיל | 2026-10-26 | done | media | SVG has no `dir`; charts use `direction="ltr"` |
| S12 סיום אימון | 2026-10-26 | done | share card | |
| S13 אימונים | 2026-10-26 | partial | template editor, drag to reorder | |
| S18 התקדמות | 2026-10-26 | done | muscle balance chart | |
| S20 היסטוריה | 2026-10-26 | done | | |
| S26 יעדים | 2026-10-26 | done | | |
| S27 תזונה היום | 2026-10-26 | done | saved meals, water | |
| S28 צילום ארוחה (Calzo) | 2026-10-26 | done | live test with a real key (tested with a mocked response and with an invalid key against the real API) | iPhone photos need EXIF orientation; resized in the browser before upload |
| S29 ברקוד | 2026-10-26 | partial | camera scan on iPhone Safari (no BarcodeDetector there); typing the number works everywhere | |
| S30 פרופיל | 2026-10-26 | done | account (needs the backend) | a dark-theme user saw a light flash on every load; theme now applied before first paint |
| S02/S03 אונבורדינג ותוכנית | 2026-10-26 | done | | plans are generated (full body / upper-lower / PPL × gym / dumbbells / bodyweight); a test checks every combination only uses exercises that exist |
| S14 עורך תבנית + S11 תרגיל מותאם | 2026-10-26 | done | drag to reorder (up/down buttons instead) | two "רגליים" chips on one screen (filter + new exercise); filters hidden while creating |
| S19 ציון כוח | 2026-10-26 | done | muscle balance chart | our own standards per lift; 6-week window; weekly change explained in words |
| S21 עריכת אימון ישן | 2026-10-26 | done | | a corrected typo must also remove the false record: records are recomputed in time order |
| S23 משקל | 2026-10-26 | done | measurements (waist etc.) | |
| PWA | 2026-10-26 | done | | tested offline: pages open and a workout starts with no network |
| S28 צילום ארוחה (fix) | 2026-10-26 | done | | leaving the screen mid-save dropped the last items; the save is now one transaction (found by repeating the e2e run) |
| S01 הרשמה, S15–S17 ספריית תוכניות, S24–S25 תמונות וקרדיו, S28 הרגלים, S29 שיעורים, S32 | — | not started | | |

Round 1 parity (`parity.py`): 64.1, 19 of 31 must-haves.
Round 2 parity: 79.3, 29 of 31 must-haves. Missing: sign-up and sync (needs a Supabase account), and the open exercise library (83 of 600+, licence check pending). 39 unit tests; the e2e run passes 5 times in a row.
