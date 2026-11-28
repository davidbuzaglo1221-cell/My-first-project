# Self-mastery system: what is built, what is honest, what comes next (28.11.2026)

## Built and tested (e2e-mastery.cjs: 26 checks; mastery.test.ts)
| Area | What works | Data |
|---|---|---|
| The day (1% better) | one focus, one action, one skill, one stretch, real learning minutes, end-of-day review, plan-vs-done over 7 days | `mastery.days` |
| Spoken tasks | Hebrew dictation (device speech service) or typing → parsed into tasks/ideas with day, time, important/urgent → **confirmed before saving**; three per day, the rest offered for tomorrow | `mastery.tasks` |
| Sleep and routines | bed/wake targets, nightly log (actual times, quality), averages, wake spread, on-target mornings, gradual shift (±15 min after 3 on-target mornings, eased after 2 misses of 3), editable morning/evening routines | `mastery.sleep`, `mastery.routines` |
| Screen time | per-app daily/weekly limits, usage typed from iOS Screen Time (labelled), remaining time, the **scroll pause** opened by an iOS Shortcuts automation, reasons and choices logged | `mastery.limits/usage/pauses` |
| Urges | private vault: AES-GCM, key from the user's code (PBKDF2 210k), code never stored, device only; 6-step protocol (stop, name, context, urge surfing timer, alternative, re-rate); patterns only from real entries | `localStorage['hamasa:vault']` (encrypted) |
| Discipline | graded ladder (4 levels), timed sessions measured while open, up after 3 successes in a row, down after 2 misses of 3 | `mastery.ladder` |
| Speech | consented recording, analysed on device: speaking time, pauses, loudness spread, pitch range (semitones); words/min, fillers and repeats only when the device returns a transcript; audio not stored | `speech` |

## Honest limits
- **Real app blocking** (FamilyControls / ManagedSettings / DeviceActivity) exists only for native iOS apps with Apple's Family Controls entitlement (requested per app from Apple), built in Xcode on a Mac, distributed via TestFlight/App Store (Apple Developer Program, $99/year). A web app installed from Safari cannot read or block other apps. The PWA uses iOS Screen Time (real enforcement, set by the user) + Shortcuts automation (real pause screen).
- **Alarm**: a web app cannot wake the phone; the iOS Clock app is used.
- **Screen-time numbers**: typed by the user from iOS Screen Time; never estimated.

## Evidence notes used in copy (no invented studies)
- Implementation intentions ("when X, I will Y"): meta-analysis Gollwitzer & Sheeran 2006, medium-to-large effect — strong.
- Habit automaticity takes weeks to months (Lally et al. 2010, median 66 days, wide range) — moderate.
- Urge surfing within mindfulness-based relapse prevention (Bowen & Marlatt 2009; MBRP trials) — limited-to-moderate.
- CBT for insomnia, including fixed wake time and gradual changes (meta-analyses, e.g. Trauer et al. 2015) — strong.
- Not claimed: dopamine resets, testosterone changes, defined brain changes from abstinence.

## Next phases
1. Body language and eye contact program (camera only with explicit consent; measure only reliable features).
2. Communication, charisma and confidence programs: knowledge, examples, simulations, real-world tasks.
3. Knowledge tracks (money, business, sales, psychology, decisions...) with levels, quizzes and practice, built on the 51 books.
4. Assistant: topic threads with separate context, connected to all of the above data.
5. Push: evening wind-down and morning routine nudges from the sleep targets.
6. Native iOS shell (optional, needs Mac + Apple developer account + entitlement) for real per-app blocking.
