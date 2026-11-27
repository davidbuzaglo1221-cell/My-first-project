# Working with David — the standing rules

These rules apply to every app built in this repository, from the first request.

## Communication
- Always write to the user in **Hebrew**. He does not read English.
- He brings the idea; you do everything else: code, design, content, audio, testing, publishing, profiles. Never hand him a technical step you can do yourself. If one step truly needs him (an account setting only he can change), give it one tap at a time, with a direct link, and ask for a screenshot.
- Never claim something works before you have verified it yourself (tests, a real browser run, the live URL). Report problems honestly.
- Do not stop to ask for confirmation on the obvious; decide like a senior product team would, then report.

## The app standard ("100 days" rule — every app looks like this)
Use the `premium-app` skill (`.claude/skills/premium-app/SKILL.md`) for every new app. In short:
1. **Full screen, its own address**: a standalone PWA hosted on GitHub Pages (repo public, Pages source = GitHub Actions, deploy from `main`), never only inside the Claude viewer.
2. **Home-screen profile**: an iOS `.mobileconfig` web clip with a Hebrew name, the app icon, `FullScreen=true`, sent to the user as a file.
3. **A beautiful name and a premium icon** (golden/emerald, no generic art).
4. **Apple-grade design**: large titles, grouped lists with hairline separators (not a box per item), native-style tab bar, compact mini player, Apple Music–style full player (artwork, scrubber with elapsed/remaining, prev/±15/play/next, lyrics-style captions, up next, speed, sleep timer).
5. **Human-sounding narration**, chosen by measurement against Hebrew listener votes: Maya and Yoav (Microsoft multilingual voices via `scripts/narration/render_edge.py`) with presence EQ and livelier intonation (`prosody.py`), plus a duo; check every recording for truncation and with Hebrew ASR (`qa_books.py`) before shipping. The user wants a narrator full of energy: calm, happy, alive.
6. **Content that teaches**: every chapter = heading, the core idea in one sentence, the essential text (no filler), and "in practice" — two or three concrete steps for real life, plus an exercise. Narration reads the same structure. Plus three key ideas in depth per chapter (models, stories, examples): the user wants to really understand the whole book, condensed but complete — never a 7-minute skim.
7. **No steering, no questionnaires**: the user sees the full catalogue and chooses. Show learning progress in percent.
8. **Every day something new**: a daily "היום שלך" card, a narrated multi-day program, and a daily reminder (calendar) that brings the user back.
9. **Ship-quality engineering**: unit tests + Playwright end-to-end checks of every feature, a real check of the live URL, an instant-launch service worker, lock-screen media controls with real artwork.
