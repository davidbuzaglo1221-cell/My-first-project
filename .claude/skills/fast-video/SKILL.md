---
name: fast-video
description: House standard for every video made for David — fast-cut vertical Reels/TikTok in Hebrew with kinetic captions, a one-second hook, beat-synced edits and an energetic voice. Use for any video, promo, reel, story or animated clip, before writing code.
---

# Fast video standard

Never slow. The viewer decides in the first second.

## Structure
- **Hook 0–1 s**: a bold statement, a question or a striking visual on frame 1 (no logo intro, no fade from black).
- Shots of **0.4–1.2 s**; nothing static longer than 1.5 s — add a push-in, a pan or text motion.
- One idea per beat; end with a clear call to action (book / follow / message) in the last 1.5 s.
- Default length 15–30 s; 9:16, 1080×1920, 30 fps (60 for fast motion). Keep text inside the safe zone (top 250 px and bottom 350 px stay clear for the app UI).

## Editing language
- Cut on the beat: detect beats from the music (or set BPM) and place cuts on them.
- Transitions: whip pan / smear, zoom punch, slide with motion blur, flash frame, match cut. Each ≤ 8 frames. Vary them; never the same one twice in a row.
- Kinetic captions in Hebrew RTL: 1–3 words at a time, big bold font (Heebo/Assistant 900), word-level highlight synced to the voice, slight pop-in (spring), high contrast with stroke/shadow.
- Speed ramps, light camera shake on hits, subtle grain; colour grade consistent across shots.
- Sound design: whooshes on transitions, hits on reveals, music ducked under the voice.

## Voice
- Energetic, alive, presenter-level: short sentences, faster rate (+10–20%), lively pitch, emphasis on key words. Prefer ElevenLabs (multilingual, expressive) when the connection works; otherwise edge-tts `he-IL-AvriNeural` / `he-IL-HilaNeural` with `--rate=+15%` and a slight pitch lift.
- Word timestamps drive the captions (`remotion-captions`).

## Build and check
- Build with Remotion (`remotion-best-practices` routes to the rest); one composition per format.
- Before showing David: render, extract a contact sheet of frames every 0.5 s and look at it; check no shot exceeds 1.5 s, captions never overflow or overlap the safe zones, audio has no clipping (loudnorm −14 LUFS for social), and the hook works with sound off.
- Deliver the MP4 file plus a cover frame, with a Hebrew one-line caption and hashtags ready to paste.
