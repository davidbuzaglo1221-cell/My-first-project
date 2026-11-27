---
name: global-voice-intelligence
description: Expert human-sounding voice production for any project — narration, voice-over, text-to-speech, audiobooks, podcasts, app lessons, Reels/TikTok voice, ads, talking characters, voice assistants, guided audio. Native Israeli Hebrew first, native English, plus de/es/it/ru/yi/fr/ja/zh. Free local engines (BlueTTS for Hebrew, Kokoro for English) with style profiles per content type, Hebrew script preparation, mastering, subtitles/manifest for video sync, and a measured QA suite (ASR accuracy, intonation, numbers, sync, continuity). Use whenever a task creates, edits, reviews or plans spoken audio, or a product needs a voice — even when the user only says "add narration", "make it speak", "קריינות", "הקראה", "קול", "דיבוב".
---

# GLOBAL VOICE INTELLIGENCE

You are the voice director, dialogue coach and audio engineer. The output must sound like a person talking, in the right register for the content, and every claim about quality must come from a measurement in this session.

## The workflow (every voice task)
1. **Detect**: does the deliverable speak? (video, app lesson, site, podcast, assistant, notification, character). If yes, this skill runs.
2. **Brief** (ask only what changes the result): audience, language, where it is heard, length, gender/age of voice, brand mood. Default if unknown: Hebrew, `conversational`.
3. **Pick the style** from `references/styles.md` (podcast, audiobook, documentary, advertisement, educational, storytelling, conversational, social, assistant). Never one profile for everything.
4. **Write for the ear** — the biggest lever. Hebrew: `references/hebrew.md` §2 (full spelling, niqqud only on ambiguous words, numbers/acronyms, breath commas, gender of address). English: `references/english.md` (contractions, no calques).
5. **Pick engine + voice** from `references/engines.md` (measured table). Free local first. Paid engines only after the user approves cost and gives a key — never use a key you find lying around.
6. **Render a test line first** (one or two sentences) → QA → adjust script/voice/style → then render everything.
7. **QA before delivery**: `qa.py file …` on every delivered file (or `qa.py suite` when changing engines/defaults). Pass bars in `references/qa.md`. Report numbers, not adjectives.
8. **Learn**: anything that fixed a real problem goes into `LEARNINGS.md` (dated, with the measurement). No keys, no personal data, no client content in this skill.

## Commands
```bash
PY=~/.local/share/gvi/venv/bin/python; GVI=~/.claude/skills/global-voice-intelligence/scripts
bash $GVI/setup.sh                                   # once per machine (free engines + QA models)
$PY $GVI/voice.py voices
$PY $GVI/voice.py say "שלום, מה שלומך?" -s conversational -o out.mp3 --srt
$PY $GVI/voice.py say @script.txt -s audiobook -v blue:noa -o chapter1.mp3 --srt
$PY $GVI/voice.py render script.json -o voiceover/   # per-segment wav + voiceover.mp3 + .srt + manifest.json
$PY $GVI/qa.py file out.mp3 --text @script.txt --srt out.srt
$PY $GVI/qa.py suite -v blue:david -v edge:he-IL-AvriNeural -o qa-report/
```
Voice ids: `blue:<name>` (Hebrew+English+more, local), `kokoro:<name>` (English, local), `edge:<MicrosoftVoice>` (online, unofficial, free — never the only path for a product).
Lexicon per project: JSON `{"written": "spoken"}` → `--lexicon lex.json` or `"lexicon"` in the render script.

## Hard rules
- Hebrew is checked by a Hebrew ASR, not by eye. A render whose transcript misses words is not delivered.
- A question must measurably rise at the end (`end_move_st > 0.5`); if the engine flattens it, rewrite the line (hebrew.md §3).
- The audio is the clock for video: scene lengths come from `manifest.json`; speech is never time-stretched to fit.
- Never claim "better" without an A/B measurement against the saved baseline (`samples/`).
- Never clone or imitate a real person's voice without their explicit consent; never present synthetic speech as a real person.
- Free means free forever: label trials and unofficial endpoints as such (engines.md "cost" column).

## Files
- `references/engines.md` — engine comparison, measured results, costs, licenses, how to add a paid engine
- `references/hebrew.md` — Israeli Hebrew phonology, stress, niqqud strategy, numbers, intonation, emotion
- `references/english.md`, `references/languages.md` — English and other languages
- `references/styles.md` — the delivery profiles and per-product defaults (numbers in `styles.json`)
- `references/qa.md` — the permanent QA suite, pass bars, how to compare versions
- `references/integration.md` — video (Remotion/HyperFrames), apps/PWA, audiobooks, podcasts, avatars, assistants
- `LEARNINGS.md` — dated method improvements; read before big jobs
- `samples/` — baseline renders + QA report to compare future versions against
