---
name: audio-engineering
description: Audio architecture, performance and playback for the app's speech - clip format, loudness, caching, prefetching, gapless sentence flow, playback speed with preserved pitch, iPhone/Safari audio unlocking, lock-screen controls (Media Session), background playback and failure fallback. Use when changing web/src/lib/speech/player.ts, the /api/tts route, the listening UI, or when audio stutters, is silent on iPhone, has gaps, clips, or costs too much.
---

# Audio engineering

## Role
You make the audio reliable and fast on a phone: it starts on the first tap, flows from sentence to
sentence, pauses and resumes exactly, survives a locked screen, and never plays the same paid clip twice.

## Architecture (web/src/lib/speech/player.ts)
- **One `<audio>` element for the whole app** (`audioElement()`), reused for every sentence. iOS lets an
  element play later only if it was started inside a tap; reusing it keeps that permission, including
  between sentences and with the screen locked.
- **Unlock inside the tap**: `unlockSpeech()` runs synchronously at the top of `play/seek/prev/next/repeat`,
  plays 0.1 s of silence once, and never replaces a loaded clip. For the device engine it speaks an empty
  utterance (iOS requirement).
- **Clips**: one MP3 per sentence, 24 kHz mono (Google `MP3` @ 24000 Hz; Azure `audio-24khz-96kbitrate-mono-mp3`).
- **Cache**: Cache Storage `tts-clips-v1`, key = SHA-256 of voice + role + parts; in-memory promise map per
  session; server-side LRU (300 clips). Repeat / previous / replay never refetch.
- **Prefetch**: when a sentence starts, the next two are fetched.
- **Gaps**: after `ended`, wait `pauseAfterMs / rate`, then play the next clip on the same element.
- **Speed**: `playbackRate` with `preservesPitch` (and `webkitPreservesPitch`), 0.75-1.5x, instant, no refetch.
- **Pause/resume**: cloud resumes mid-sentence; device speech restarts the sentence (iOS `speechSynthesis.pause`
  is unreliable).
- **Lock screen**: Media Session metadata (lesson title) and play / pause / previous / next / seekbackward (= repeat).
  External pauses (phone call, lock screen) update the UI through the element's `pause` event.
- **Fallback**: a cloud error mid-session switches to the device voice from the same sentence, with a notice.
- **Service worker** (`web/public/sw.js`): a deploy clears old app caches but keeps `tts-*` clip caches.
- **Position**: saved per content in localStorage (`speech-pos:<id>`), cleared when finished.

## Goals and budgets
| Metric | Target |
| --- | --- |
| Tap to first sound (cloud, uncached) | < 1.2 s on 4G |
| Gap between sentences | the planned pause +- 100 ms (prefetch must win) |
| Loudness | -16 LUFS +- 1 (integrated, measured per EBU R 128; mobile/podcast practice), true peak < -1 dBTP |
| Clip size | ~12 KB/s of speech (MP3 96 kbps mono) |
| Repeat / previous | 0 network requests |

## Working instructions
1. Never create a second `Audio()`; never `await` before `unlockSpeech()` in a tap handler.
2. Any new control must call a controller method that unlocks (`seek`, `play`, ...), not set `src` itself.
3. Keep requests idempotent and cacheable: speed stays client-side; `speakingRate` stays 1.
4. If an engine returns audio far from -16 LUFS, normalise on the server (ffmpeg `loudnorm`) or
   adjust `volumeGainDb` (Google) - measure first with `audio_metrics.py`.
5. Respect the service worker: `/api/*` is never cached by `public/sw.js`; clips are cached by the player.
6. Any change here re-runs `node web/e2e-listen.cjs` (every control, both engines, fallback).

## Quality rules
- No control without a working action; disabled states must be real (first/last sentence).
- Media controls keep left-to-right order (`dir="ltr"`) in RTL, per platform media conventions.
- No console errors in the e2e run; no horizontal overflow at 390 px.

## Examples
- *"Silent on first tap on iPhone"* -> a code path awaited before unlocking, or created a new element.
- *"Resume starts the sentence over"* -> `unlockSpeech` replaced the loaded clip (fixed: it skips loaded clips).
- *"Gap before each sentence"* -> prefetch missing or cache key changed between prefetch and play.

## Test process
1. `cd web && npm run build && npx next start -p 3100 & node e2e-listen.cjs`
   (with `CLIPS_DIR` + `CORPUS` from `speech-quality-testing` to play real speech).
2. `python audio_metrics.py manifest.json metrics.json` - loudness, peak, pauses.
3. On a real iPhone (Safari and home-screen app): first tap plays, lock the screen mid-lesson, use lock-screen
   pause/next, take a call, switch to silent mode.

## Official documentation
- Media Session API: https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
- HTMLMediaElement.preservesPitch: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch
- Cache Storage: https://developer.mozilla.org/en-US/docs/Web/API/Cache
- EBU R 128 (loudness measurement): https://tech.ebu.ch/publications/r128
- Google audio config (encoding, sample rate, volume gain): https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/AudioConfig
- Azure output formats: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech
- expo-audio (only if a native Expo app is added; this app is a web PWA): https://docs.expo.dev/versions/latest/sdk/audio/
