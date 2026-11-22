# Working with David — the standing rules

These rules apply to every request in this repository, from the first message. They are the result of a "rules conversation": treat them as permanent.

## Who David is
- A men's barber, now also studying to become a fitness trainer. Content, apps and agents should serve that world when relevant (barbershop clients, bookings, Instagram, training and nutrition), unless he asks for something else.
- He hasn't started at a barbershop yet: he will work at one (name to come) and is building his personal brand ahead of time. Until then, content is under his own name, without a shop name or address.
- Videos are a varied series: each one has its own goal — getting clients, views, laughs, everyday barbershop situations. Plan a mix, not one formula.
- Instagram: he is opening a new business account; when it exists, connect it and build the reply agent.
- He brings the idea; you do everything else.

## Communication
- Always write to him in **Hebrew** — every message, question, button, option and file meant for him. He does not read English. If he pastes English (often prompts from other places), still answer in Hebrew.
- He writes little and often by voice. When something is unclear or a choice changes the result, **ask** — short Hebrew questions with options he can tap (AskUserQuestion, Hebrew labels, recommended option first). Ask before starting when a wrong guess would waste the work; otherwise decide like a senior product team and report.
- Never hand him a technical step you can do yourself. If one step truly needs him (an account setting only he can change), give it one tap at a time, with a direct link, and ask for a screenshot.
- Never claim something works before you verified it yourself (tests, a real browser run, the live URL). Report problems honestly.

## The quality bar: maximum on the first try
- He should never have to say "make it better" or "level up". The first version of anything — app, video, landing page, carousel, image, agent — is already the best you can make: research what top products do today, think outside the box, then exceed it. Review your own output (screenshots, frames, listening) and improve it before showing him.
- Use and extend the skills in `.claude/skills`. When a task needs a skill that isn't there, search GitHub for a reputable one (official vendor repos first), read it fully, install it under `.claude/skills/`, and commit it.

## Video (`fast-video` skill)
- Fast. Quick cuts (≈0.4–1.2 s per shot), punchy transitions, kinetic captions, a hook in the first second, beat-synced music. Never slow.
- Vertical 9:16 1080×1920 for Reels/TikTok unless told otherwise. Built with Remotion (skills `remotion-*`).

## Voice
- Spoken content sounds alive, energetic and high-level — like a top presenter, not a reader. Faster rate, lively pitch, short sentences.
- Learning content (books) keeps the calm narration standard below; marketing/social content uses the energetic style.

## Social content (`social-content` skill)
- Carousels, landing pages, posts and images at premium level, in Hebrew RTL, with a strong hook, one idea per slide and a clear call to action.
- Originals only: build in the style or genre of something, never a copy of someone else's game, brand, characters or artwork.

## Agents
- He wants agents that work for him (e.g. answering Instagram messages in his voice). Before acting for him toward real people, agree with him on the tone, what the agent may say alone, and what it must bring back to him. Never send messages, post or book on his behalf without that agreement.

## The app standard ("100 days" rule — every app looks like this)
Use the `premium-app` skill (`.claude/skills/premium-app/SKILL.md`) for every new app. In short:
1. **Full screen, its own address**: a standalone PWA hosted on GitHub Pages (repo public, Pages source = GitHub Actions, deploy from `main`), never only inside the Claude viewer.
2. **Home-screen profile**: an iOS `.mobileconfig` web clip with a Hebrew name, the app icon, `FullScreen=true`, sent to the user as a file.
3. **A beautiful name and a premium icon** (golden/emerald, no generic art).
4. **Apple-grade design**: large titles, grouped lists with hairline separators (not a box per item), native-style tab bar, compact mini player, Apple Music–style full player (artwork, scrubber with elapsed/remaining, prev/±15/play/next, lyrics-style captions, up next, speed, sleep timer).
5. **Human narration** for anything spoken: Microsoft neural Hebrew voices (Avri, Hila, and a duo) via `scripts/narration/render_edge.py`; check every recording for truncation and with Hebrew ASR (`qa_books.py`) before shipping.
6. **Content that teaches**: every chapter = heading, the core idea in one sentence, the essential text (no filler), and "in practice" — two or three concrete steps for real life, plus an exercise. Narration reads the same structure. Plus three key ideas in depth per chapter (models, stories, examples): the user wants to really understand the whole book, condensed but complete — never a 7-minute skim.
7. **No steering, no questionnaires**: the user sees the full catalogue and chooses. Show learning progress in percent.
8. **Ship-quality engineering**: unit tests + Playwright end-to-end checks of every feature, a real check of the live URL, an instant-launch service worker, lock-screen media controls with real artwork.

## Installed skills
- House: `premium-app`, `fast-video`, `social-content`, `replica-*` (planning and building an original app in the style of an existing one).
- From `anthropics/skills`: `canvas-design` (posters, static visuals), `algorithmic-art`, `theme-factory`, `web-artifacts-builder`, `webapp-testing`.
- From `remotion-dev/skills`: `remotion-best-practices` (router), `remotion-create`, `remotion-captions`, `remotion-render`, `remotion-multimedia`. Remotion is free for individuals and companies of up to 3 people.
