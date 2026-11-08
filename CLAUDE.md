# Working agreement with the owner (GAVRIEL FITNESS)

These are standing instructions from the owner. Follow them in every session, without being reminded.

## Language
- Every message to the owner is written in **Hebrew**. (Code, commits and file contents may stay in English.)

## Voice and narration
- **Never use a robotic or synthetic-sounding voice.** No browser `speechSynthesis`, no espeak, no low-quality TTS — not even as a fallback.
- Narration must sound like a human narrator recorded it: natural pacing, human intonation and emotion.
- Preferred voice: **male, deep, documentary style** (chosen for the fat-journey film). Ask only if a project clearly calls for something else.
- Acceptable sources: a high-quality neural voice service (ElevenLabs is the chosen one; key goes in the environment as a network secret for `api.elevenlabs.io`) or a real recorded voice.
- If no human-quality voice is available, ship **music + captions only** and say so plainly. Do not fall back to a robotic voice.

## Quality bar
- Always deliver the best possible result on the first try: professional, polished, cinematic. Not generic, not template-looking.
- Check the work yourself before handing it over (render it, look at it, listen to the mix through spectrograms and loudness) so the owner does not need to correct anything.
- Audio: clean mixes, few and purposeful sound effects, loudness-normalized (about -14 LUFS for social video).
- Video for social: vertical 1080×1920, 60fps, H.264 high quality, large Hebrew captions inside the safe zones, a strong hook in the first seconds.

## Project notes
- The fat-journey film lives in `animations/` (`src/` template, `tools/` build, score, narration and video renderer). Rendered MP4s go to `video/` (git-ignored).
