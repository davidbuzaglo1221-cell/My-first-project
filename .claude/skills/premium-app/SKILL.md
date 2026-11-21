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
- Use Microsoft neural Hebrew voices (`he-IL-AvriNeural`, `he-IL-HilaNeural`) via `edge-tts`; synthesize sentence by sentence, cache by hash, assemble one file per book with exact sentence offsets, master with loudnorm −16 LUFS.
- Offer only **real** choices (Avri, Hila, and Avri+Hila alternating by paragraph). Never label one voice as several.
- Reject truncated clips (bytes ≥ 130 × characters) and rescan durations after synthesis; check with `ivrit-ai/whisper-large-v3-turbo` (WER/CER) before publishing.
- Edge voices are for personal use; commercial release needs the same voices through Azure Speech.

## 5. Content
- Whole book, only what matters: chapter headings that each carry a real part of the book.
- Every chapter: **title → in brief (one sentence) → the essential text → in practice (2–3 concrete steps) → exercise**. Narration ends each chapter with "השורה התחתונה" and "ובפועל".
- Depth, not a summary: every chapter also gets **three key ideas in depth** (a heading + ~90–120 words each: the book's real models, stories, studies and examples). A book should be ~2,000+ words (~15–25 min of listening), never a 7-minute skim. Show the value: idea counts, a book map with every chapter's ideas, and the library's size (books · chapters · ideas · hours).
- Numbers and abbreviations spelled out for narration. No Latin letters or digits inside spoken text (tests enforce it).
- No steering or questionnaires: show the whole catalogue, let the user choose, show learning in percent.

## 6. Release checklist
1. `npx tsc -b --noEmit`, `npx vitest run`, Playwright feature tests (`scripts/e2e-features.cjs`, `scripts/e2e-audio.cjs`) all green.
2. Build, push to the work branch and `main`, wait for the Pages run, then verify the live URL (assets, audio range 206, a real browser playback).
3. Tell the user in Hebrew what changed, what was verified, and anything still limited — honestly.
