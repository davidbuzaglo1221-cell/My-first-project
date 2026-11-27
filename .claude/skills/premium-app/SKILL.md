---
name: premium-app
description: The house standard for every app built for David — a full-screen, App-Store-quality Hebrew PWA with a home-screen profile, Apple-grade design, human narration, practical content and verified releases. Use at the start of any new app or major feature, before writing code.
---

# Premium app standard

Build the first version as if a senior Apple team worked on it for months. The user should never have to ask twice for quality.

## 1. Foundation (day one)
- Vite + React + TypeScript, RTL Hebrew (`dir="rtl"`, `lang="he"`), Assistant + Frank Ruhl Libre fonts, CSS tokens with dark theme.
- Hash router, small external store with `useSyncExternalStore` and localStorage persistence. **Selectors must return stable values** (never `filter`/`?? []` inside a selector: it causes React error #185).
- PWA: `manifest.json`, apple-touch-icon 180, icons 192/512, `apple-mobile-web-app-capable`, `viewport-fit=cover`, safe-area insets, and a service worker that serves the shell from cache (stale-while-revalidate) and never caches audio or range requests.

## 2. Distribution (no Claude bar, real full screen)
- **The permanent install rule**: one link, Safari → Share → Add to Home Screen, full screen with no Safari bars, premium icon (180px apple-touch-icon, 192/512/1024 manifest icons, maskable), Hebrew `name`/`short_name`/`apple-mobile-web-app-title`. iOS Web Push works only in this installed mode (iOS 16.4+), so this is also the way to get notifications.
- **Notifications**: Web Push from the app (service worker `push` + `notificationclick`), VAPID keys created and kept by the sender workflow, subscriptions relayed to it, an hourly GitHub Actions sender with a daily message bank. Never substitute calendar events for app notifications.
- Host on **GitHub Pages**: repository public, Settings → Pages → Source = GitHub Actions, workflow deploys from `main` only (a second trigger branch cancels the run).
- Allow the Pages host in the cloud environment so the live site can be verified with curl and Playwright (via `HTTPS_PROXY`).
- Make an iOS `.mobileconfig` web clip: Hebrew `Label`, PNG icon, `URL` = Pages address, `FullScreen=true`, `IgnoreManifestScope=true`, stable `PayloadIdentifier` (so a new profile replaces the old one). Send it with Hebrew install steps.

## 3. Design language (Apple Music / Spotify level)
- Large bold titles; section heads 22px; generous spacing.
- Lists as **one grouped container with hairline separators**, not a separate card per row. Quick actions as round icons with a label under them.
- Native tab bar: full width, translucent, hairline on top, 5 tabs max.
- Mini player: 56px, artwork 40px, title + subtitle, play + next, 2px progress line, floating above the tab bar.
- Full player: blurred artwork background, swipe-down handle, artwork that shrinks when paused, title/author, current caption line, thin scrubber with elapsed and `-remaining`, transport (prev chapter, -15, play, +15, next chapter), tools row (speed, narrator, lyrics, up next, sleep timer). Lyrics pane: big bold lines, current one white, tap to jump. Up next pane: the rest of the chapters.
- Media Session: real cover artwork, next/previous track = chapters, seek ±15.
- Screenshot every new screen at 390×844 and look at it before shipping.

## 4. Voice
- **Measure, don't guess.** Hebrew listener votes exist: `ivrit-ai/tts-arena-preferences` on Hugging Face (2,257+ pairwise votes). A logistic model on simple acoustics (spectral centroid, voicing continuity, pitch variation, pauses; `features.py`) predicts the winner ~68% of the time. Score every candidate on the same sentences, plus Hebrew ASR (`ivrit-ai/whisper-large-v3-turbo-ct2`) for WER/CER and a joined-words test (וכשהוא, שבבית, לכשתחליט…).
- **Current best free voices**: Microsoft multilingual "Copilot" voices through `edge-tts` — Emma (presented as **מאיה**) and Brian (**יואב**), plus a duo. They beat he-IL Avri/Hila on joined words and naturalness. Andrew stumbles on joins. Adding niqqud (Phonikud) made Edge voices worse.
- **Make it lively**: master with presence EQ (`equalizer=f=3200:g=2.5, highshelf=f=7000:g=3`), and widen each sentence's pitch movement ×1.4 with a slight lift (Praat PSOLA, `prosody.py`): + ~4–5 points of predicted preference, no intelligibility cost. Faster pace does not help.
- Synthesize sentence by sentence, cache by hash, assemble one file per book with exact sentence offsets, loudnorm −16 LUFS. Reject truncated clips and rescan durations; rephrase a line a voice cannot render.
- Paid voices still lead (Gemini 3.1 Flash TTS, ElevenLabs v3); say so honestly when asked.

## 5. Content
- Whole book, only what matters: chapter headings that each carry a real part of the book.
- Every chapter: **title → in brief (one sentence) → the essential text → in practice (2–3 concrete steps) → exercise**. Narration ends each chapter with "השורה התחתונה" and "ובפועל".
- Depth, not a summary: every chapter also gets **three key ideas in depth** (a heading + ~90–120 words each: the book's real models, stories, studies and examples). A book should be ~2,000+ words (~15–25 min of listening), never a 7-minute skim. Show the value: idea counts, a book map with every chapter's ideas, and the library's size (books · chapters · ideas · hours).
- Numbers and abbreviations spelled out for narration. No Latin letters or digits inside spoken text (tests enforce it).
- No steering or questionnaires: show the whole catalogue, let the user choose, show learning in percent.

## 6. Every day something new (retention)
- Home starts with **"היום שלך"**: three small steps that change daily (today's practice, one chapter, the idea of the day from the key ideas) + a challenge of the day + a ring (x/3) and minutes vs goal.
- A narrated **30-day program** (body → mind → action → people & meaning), each day ~2 min with a guided practice and a mission; a 30-tile grid; completion recorded when heard to the end.
- **Daily reminder**: generated `.ics` calendars (one per time slot, 120 days, a different message each day, alert + link), regenerated on every build; and, with the Calendar connector, a recurring daily event in the user's own calendar.

## 7. Release checklist
1. `npx tsc -b --noEmit`, `npx vitest run`, Playwright feature tests (`scripts/e2e-features.cjs`, `scripts/e2e-audio.cjs`) all green.
2. Build, push to the work branch and `main`, wait for the Pages run, then verify the live URL (assets, audio range 206, a real browser playback).
3. Tell the user in Hebrew what changed, what was verified, and anything still limited — honestly.

## Premium from the first version (rule, 27.11.2026)
- Every main screen opens with a real, licensed photograph (Unsplash License or owner-supplied), chosen for that world and processed to WebP locally; credits in `public/photos/CREDITS.json`.
- The entrance shows the product from outside: one striking full-bleed image, the mark, the name, and a scroll of "what waits inside" (a photo per world) before the enter button.
- The icon: if the owner sends an image and says "this", use that image itself (clean crop, no grey corners, upscale). Otherwise make an original rendered icon. The home-screen icon does not appear inside the app unless asked.
- The tab bar holds the interesting worlds (home, library, personal assistant, freedom, journey), not utility pages like notes.
- An e2e check asserts that each main route has a photograph near the top.
