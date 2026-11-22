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

## Genre playbook (think outside the box, look human, never try-hard)
The rule for every genre: **attention-grabbing but effortless**. Real moments, confident rhythm, humour where it fits; no stock-photo look, no over-decorated templates.
- **Barber / personal brand**: POV shots ("POV: you finally found your barber"), satisfying transformation (before → hard cut on the beat → after), ASMR close-ups of clippers and razor lines, guard numbers as kinetic text, a reveal with a mirror turn. Series mix: one for clients (offer + CTA), one for views (satisfying / trend audio), one for laughs (client situations, "types of clients in the chair"), one for trust (process, hygiene, tips).
- **Fitness**: rep-synced cuts, counters and timers on screen, myth vs fact, 3-move mini workouts, before/after progress with dates.
- **Kids**: bright saturated palette, round friendly shapes, bouncy springs (overshoot), slower cuts (1–2 s) with big clear words, sing-along rhythm, sound effects (boing, pop), characters that are original. Calm endings; no flashing or scary moments.
- **Action / fight style**: speed ramps (slow → fast on impact), impact frames (1–2 frames of inverted or white flash), heavy camera shake on hits, motion-blur whips, bass drops on punches, comic-style hit words. Choreographed or animated only — never real violence against real people.
- **Comedy / situations**: setup → pause (silence beat) → punchline cut; zoom-in on the reaction; caption-as-inner-voice; meme-timing.
- **Human feel**: handheld micro-shake, natural grain, imperfect real footage from David's phone beats any perfect render. When realistic people are needed and no footage exists, use AI video generation through the connected tools (Canva / Picsart) only if the result is convincing; otherwise use stylised graphics rather than uncanny fake humans.

## Reference build
`reels/reel-01` — 15 s, 120 BPM, drop at 3 s, a hit every beat: original synthesized beat (`tools/music.py`), Heebo fonts bundled locally, Remotion composition with zoom/whip/drop entries, chroma split, beat pulse, shake on hits, grain and flash frames. Render with the local headless shell:
`npx remotion render src/index.ts Reel out/reel.mp4 --browser-executable=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell --concurrency=2 --timeout=120000`
Notes: edge-tts cannot connect from the cloud container (the proxy blocks WebSockets); ElevenLabs currently rejects the key. Until fixed, reels are music + kinetic text, or narration rendered elsewhere.

## Looks human, not AI (David's rule — reel-02 is the reference)
The "AI look" = gold-on-black luxury, centred giant word on every beat, chroma split, synthetic beeps. Avoid it. Human editors:
- **Breathe**: not every beat is a cut. Mix fast cuts with one hold, one freeze, one silence.
- **Editing moves people recognise**: tape stop into silence, typing an app-style caption (white box, black text), hand-drawn marker circles/arrows/strike-throughs, a word crossed out and rewritten by hand, inverted flash cards, a camcorder REC + timecode, gate weave, dust, film grain.
- **Off-centre, editorial type**: a serif (Frank Ruhl Libre 900) for statements, a plain sans for captions, a marker hand (Amatic SC) for notes. Text right-aligned (RTL), allowed to sit at an edge.
- **Monochrome + one accent** (marker red) instead of gold everything.
- **Real sound**: recorded-sample instruments (FluidSynth + FluidR3_GM soundfont: `apt-get install fluidsynth fluid-soundfont-gm`), trending genre (phonk: pitched cowbell = GM Agogo program 112, 808 with glide, halftime drums, triplet hat rolls), vinyl crackle, foley (typing, shutter, marker). Never pure synthesized beeps.
- **Words**: charismatic, short, certain. State, don't persuade. No sales lines, no exclamation marks, no emojis on screen. Example voice: "לא הולך אחרי העדר. יוצר אותו." / "לא מסביר. לא מתנצל. עושה."
