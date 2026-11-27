# Putting voice into products

All paths below assume the skill at `~/.claude/skills/global-voice-intelligence` and engines in `~/.local/share/gvi` (`scripts/setup.sh`). `PY=~/.local/share/gvi/venv/bin/python`, `GVI=~/.claude/skills/global-voice-intelligence/scripts`.

## Video (Remotion / HyperFrames / ffmpeg)
1. Write the script as segments, one per scene (`render` JSON, see `voice.py` docstring).
2. `$PY $GVI/voice.py render script.json -o public/voiceover/` → `<id>.wav` per scene, `voiceover.mp3`, `voiceover.srt`, `manifest.json` (start/duration per segment and per caption cue).
3. The audio is the clock: set each scene's duration from `manifest.json` (`Math.ceil(duration * fps)`), never stretch speech to fit.
4. Captions: use `manifest.json` → `cues` (exact chunk times). For word-level karaoke run `faster-whisper` with `word_timestamps=True` on the final file (see `remotion-captions`), and show digits in captions even when the voice says words.
5. Music ducks under voice by 10–14 dB; final mix −14 LUFS for social.
6. QA: `qa.py file voiceover.mp3 --text @script.txt --srt voiceover.srt`.

## Apps and websites (PWA)
- Pre-render, don't synthesize in the browser: the Web Speech API's Hebrew voices differ per device and sound robotic.
- Per lesson: one MP3 (mono, 40–64 kbps is enough for speech) + JSON of sentence start times for highlighting and seeking.
- Lock-screen controls: Media Session API with artwork; preload the next track.
- Cache audio in the service worker on first play, not at install.

## Audiobooks and podcasts
- Render chapter by chapter; cache is per sentence, so fixing one word re-renders one sentence.
- Audiobook delivery: −19 LUFS integrated, −1.5 dBTP, 0.5–1 s head/tail room tone, 44.1 kHz MP3 128 kbps (ACX-style). Podcast: −16 LUFS stereo / −19 mono.
- Duo: alternate voices by paragraph (`segments` with their own `voice`).

## Talking characters / avatars
- Voice first (this skill), then lip-sync tools take the WAV. Keep one voice per character in a `voices.json` inside the project.
- Never present a generated voice as a real person. Voice cloning (BlueTTS `ref_wav`) only from a recording the person gave for this purpose, with their consent.

## Voice assistants (real time)
- BlueTTS `tts.stream(text, lang)` yields chunks: first audio after the first chunk (CPU ~5× faster than real time on 2 vCPU per BlueTTS docs).
- BlueTTS ships an OpenAI-compatible HTTP server (`examples/openai_server.py`, extra `server`): any client that speaks the OpenAI `/v1/audio/speech` API can use the local voice for free.
- Keep replies short (assistant style) and stream sentence by sentence.

## Notifications
Short spoken prompts (≤ 6 s) pre-rendered per message template; dynamic parts (names, times) rendered at build time, not on device.
