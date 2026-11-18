---
name: natural-human-voice
description: Makes app narration sound like a real person reading - phrasing, pauses, emphasis through structure, non-monotone delivery, sentence-by-sentence continuity. Use when writing or editing text the app will read aloud, choosing a voice or speaking rate, adding a new spoken screen, or when someone says the voice sounds robotic, flat, rushed, or choppy.
---

# Natural human voice

## Role
You are the narration director for this app. A listener should forget they are hearing a machine:
the voice breathes at commas, rests between ideas, slows for a title, and never reads a symbol.

## Goals
- Every spoken sentence is prepared text (see `hebrew-pronunciation`), never raw UI strings.
- Rhythm comes from structure: sentence, paragraph, title, callout - each with its own pause.
- Pitch moves: measured range of at least 4 semitones per sentence (`speech-quality-testing`).
- One persona per listening session, the same voice across Hebrew and English.

## How it works in this project
| Piece | File |
| --- | --- |
| Script builder (sentences, roles, pauses) | `web/src/lib/speech/segment.ts` (`buildScript`) |
| Per-content scripts | `web/src/lib/speech/script.ts` (`lessonScript`) |
| SSML per engine | `web/src/lib/speech/ssml.ts` |
| Voices / personas / speeds | `web/src/lib/speech/voices.ts` |
| Player (gaps scale with speed) | `web/src/lib/speech/player.ts` |

Pauses at 1x (divided by the playback rate): sentence 140 ms, end of paragraph 420 ms, after a title 650 ms.
A dash or bracket becomes a comma, which SSML turns into a 120 ms breath.

## Working instructions
1. Write for the ear. One idea per sentence; 8-25 words is the comfortable range. Split a sentence
   above ~30 words at a natural clause boundary in the source text.
2. Add new spoken content as `ScriptBlock[]` with the right `role`:
   - `title` - read 6% slower, long pause after.
   - `body` - normal.
   - `callout` - give it a spoken `lead` ("לנסות היום") so the listener hears the label the reader sees.
3. Emphasis: Chirp 3 HD ignores `<emphasis>` and Azure he-IL does not support it. Create emphasis
   with placement (key point at the end of the sentence), a lead + pause, or a short sentence on its own.
   Never add CAPS, exclamation marks or repeated punctuation to force emphasis.
4. Questions must be real questions. A `?` inside a quoted UI label is removed by the normalizer so
   intonation does not rise mid-sentence.
5. Speed is applied on the device (`playbackRate`, pitch preserved). Do not change `speakingRate`
   in the request: one cached clip serves every speed.
6. Keep the persona: change voice only through the voice sheet; switching restarts the current
   sentence, never mid-word.

## Quality rules
- No digits, symbols, or quote marks reach a Hebrew voice (enforced by `corpus.test.ts`).
- No sentence-to-sentence gap above 0.8 s at 1x; none below 0.1 s.
- Loudness -16 LUFS +-1, true peak below -1 dBTP (`audio-engineering`).
- Pitch range (10th-90th percentile) of at least 4 semitones on body sentences; below 3 is monotone.
- Hebrew narration at 1x: 12-16 spoken characters per second.

## Examples
| Written | Spoken (what the app sends) | Why |
| --- | --- | --- |
| `כמה לנוח בין סטים` (title) | `<prosody rate="94%">כמה לנוח בין סטים</prosody>` + 650 ms | a title is announced, not rushed |
| callout `תנו לטיימר לרוץ.` | `לנסות היום. תנו לטיימר לרוץ.` | the listener needs the label |
| `ונגעו ב„למה?” כדי לראות` | `ונגעו בלמה כדי לראות` | no rising tone mid-sentence |
| `2 עד 3 דקות - לא פחות` | `שתיים עד שלוש דקות, <break 120ms/> לא פחות` | a dash is a breath |

## Test process
1. `cd web && npx vitest run src/lib/speech` - script, pauses, SSML.
2. Run the audio pipeline in `speech-quality-testing` and read `f0_range_st`, `pause_ratio`, `chars_per_s`.
3. Listen to at least: a title, a long body sentence, a callout, a question, a mixed Hebrew-English sentence.
4. If a sentence sounds flat or rushed, fix the text or the block role first; tune pauses last.

## Official documentation
- Google Chirp 3 HD (SSML subset, pace, markup pauses): https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd
- Google SSML reference: https://docs.cloud.google.com/text-to-speech/docs/ssml
- Azure SSML (voice, prosody, break): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice
- Claude Code skills: https://code.claude.com/docs/en/skills
