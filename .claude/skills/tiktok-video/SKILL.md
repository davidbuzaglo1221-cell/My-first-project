---
name: tiktok-video
description: >-
  Makes vertical TikTok / Reels / Shorts videos in the user's own signature
  style: Apple-keynote look, deep black background, green word-synced Hebrew
  captions, mint-teal colour shift for the twist, hard cuts, a lively Hebrew
  narrator and an original ambient score, checked by speech recognition before
  delivery. Use whenever the user asks for a TikTok, reel, short, סרטון,
  סירטון טיקטוק, "video with tips", or says "in my style" / "בסטייל שלי".
---

# TikTok video, in the user's style

The user approved this style (book-tips video, Nov 2026): "יפה מאוד עריכה טובה...
זה הסטייל שלי". Their one note was that the narrator should sound livelier
("יותר תוסס"), and the defaults below already include that change. Keep this
look for every video unless they ask for something different.

## The style (do not drift from it)

**Format.** 1080×1920, 30 fps, H.264 + AAC, 45–60 s. Structure: hook question,
title card ("3 טיפים…"), tip 01/02/03, **a twist/bonus** that changes the colour
palette, then a short CTA ("שמרו. תתחילו היום.").

**Colour.**
- Background: pure `#000` with a slow-drifting green radial glow (~15% alpha)
  and very light film grain (5%).
- Headlines are white `#F5F5F7`, secondary text is gray `#86868B`.
- Captions and accents are Apple green `#30D158`. Gradient text runs
  `#B8F27C → #30D158 → #2FD3B4`.
- Twist section: the glow and gradients move to mint/teal
  (`#7CF2D2 → #38D7C0 → #5AC8FA`). Strike-throughs are `#FF453A`.

**Type.**
- Headlines use Heebo 800/900 at 120–200 px. Huge gradient numerals
  ("3", "20", "~30").
- Quotes and book-like paragraphs use Frank Ruhl Libre (a classic serif).
- Eyebrows ("טיפ 01") are Heebo 600, 40 px, green, with only light
  letter-spacing (wide spacing breaks Hebrew).
- Every number that must read left-to-right gets `direction:ltr;unicode-bidi:isolate`.

**Motion.**
- Each sentence gets its own shot, and shots switch on the narrator's words
  as hard cuts.
- Elements enter with opacity, a 34 px rise and a 14 px blur clearing over
  0.55 s (ease-out cubic), staggered 0.12 s.
- Each shot pushes in slowly (scale 1.00 → 1.035).
- Small explainers: a hand-drawn underline, chips that get struck through,
  a counter, a progress bar, two connected circles.
- A thin 3-segment progress indicator at y≈262 shows during the tips only.

**Captions.**
- Heebo 800, 76 px, green, centred, top at y=1300. That keeps them clear of
  TikTok's bottom UI.
- At most 3 words per group, and a new group starts on any pause over 0.22 s.
- Words not yet spoken show at 38% opacity. The active word gets a green
  glow and lifts 4 px.

**Voice.**
- Microsoft neural `he-IL-AvriNeural` via edge-tts at `rate='+17%'`,
  `pitch='+5Hz'`, `volume='+10%'`. This is the "livelier" setting the user
  asked for. The first version used +9% / -2Hz and they found it too flat.
- 0.26 s gap between scenes.
- Add niqqud to any word the voice could misread. Example: אַחֲרֵי, because
  without niqqud it said "acharai". Strip the niqqud from captions
  automatically (timeline.py does this).
- Only two Hebrew voices exist (Avri, Hila), and neither has speaking styles.
  Energy comes from rate, pitch and tighter gaps.

**Sound.**
- An original numpy-synth ambient pad: A-minor add9 for the main part,
  F maj7(9) at the twist, C add9 at the outro.
- A soft 55 Hz thump plus a glassy tick on every cut, and a noise riser into
  the twist.
- The music is side-chain ducked under the voice. The voice gets EQ (+3.5 dB
  at 3.4 kHz, +2 dB air at 9 kHz) and compression. Final loudness is
  -14 LUFS, true peak -1.2 dB.

**Copy.**
- Mature, clean, short sentences, spoken directly to the viewer in plural
  ("קראו", "סגרו").
- No emojis, no hype words.
- One concrete number per tip when possible.

## How to make a new video

1. `engine/setup.sh <work-dir>` copies the engine and the example, fetches
   the fonts from npm, installs edge-tts and faster-whisper, and downloads the
   Hebrew Whisper model (~1.6 GB). Set `WITH_WHISPER=0` to skip the model.
   The work dir goes in the scratchpad.
2. Write `script.json`: one entry per scene, `{"id", "tts"}`, with the same
   scene ids as the example (hook, title, tip1, tip2, tip3, twist, outro).
3. Edit `index.html` from `examples/book-tips/`.
   - Keep the `<style>` block and the engine JS (`seek`, `enter`, captions,
     grain, glow) as they are.
   - Rewrite the scene markup.
   - Point `SHOTS` and `ENTER` at words of the new script with
     `W(scene, word, nth)`.
4. Run, in order, from the work dir:
   1. `python3 tts.py`
   2. `python3 timeline.py`
   3. `node cuts.js`
   4. `python3 music.py`
   5. `python3 mix.py`
   6. `node shots.js 2 6 12 …` (preview stills; check them)
   7. `node render.js` (about 1 frame per second on CPU, so roughly 30 min
      per minute of video; run it in the background)
   8. `ffmpeg -i video_only.mp4 -i audio.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -movflags +faststart -shortest final.mp4`
5. **Verify before delivering. This is required.**
   - Transcribe the final file with `python3 check.py wm final.mp4` and
     compare it with the script word for word. Fix any misread word with
     niqqud, then regenerate.
   - Look at a contact sheet of frames taken across the whole video. Check
     RTL punctuation, LTR numbers, safe zones and caption sync.
6. Send the mp4 to the user. Tell them what was checked, and that it was
   verified by transcription and stills, not by watching it.

## Environment notes

- edge-tts needs the proxy CA. tts.py sets
  `ec._SSL_CTX = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')`.
- Hugging Face's Xet CDN is blocked. Download the model with plain `curl`
  from `/resolve/main/` (setup.sh already does this).
- faster-whisper's own decoder fails with av 19, so check.py decodes with
  ffmpeg.
- GitHub raw and Google Fonts downloads are blocked. Use the npm
  `@fontsource/*` packages.
