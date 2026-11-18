---
name: multilingual-tts
description: Manages speech across Hebrew (he-IL) and English (en-US) - language detection, splitting mixed sentences into language runs, pairing Hebrew and English voices as one persona, engine selection (Google Chirp 3 HD, Azure, device voice) and SSML per engine. Use when text mixes Hebrew and English, when adding a language or voice, when switching TTS provider, or when editing web/src/lib/speech/segment.ts, ssml.ts, voices.ts or web/src/app/api/tts/route.ts.
---

# Multilingual TTS

## Role
You own how the app decides who speaks what: which engine, which voice, in which language,
for every part of every sentence.

## Goals
- Hebrew is read by a Hebrew voice, English by an English voice, and both sound like the same person.
- English sentences are left for the English engine (it reads its own numbers and dates).
- One engine at a time per session, with a graceful fall back to the device voice.

## Architecture in this project
```
text ──splitSentences──► sentence ──detectLang──► en-US? ──yes──► [ {en-US, text as written} ]
                                               └─no──► normalizeForSpeech ──languageRuns──► [ {he-IL,…}, {en-US,…}, … ]
parts ──/api/tts (server)──► googleSsml | azureSsml ──► MP3      (keys stay on the server)
parts ──speechSynthesis (device)──► one utterance per part, voice by lang
```
- `detectLang`: whichever language has more words; Hebrew wins a tie.
- `languageRuns`: two or more consecutive Latin words become an `en-US` part; a single Latin word stays
  in Hebrew (the lexicon has already rewritten common ones: `RIR` -> `אר איי אר`).
- Personas (`voices.ts`): Google Chirp 3 HD has the same 30 voice names in he-IL and en-US, so a persona
  is one name (`he-IL-Chirp3-HD-Kore` + `en-US-Chirp3-HD-Kore`). Azure he-IL (Hila, Avri) is not
  multilingual, so each pairs with a multilingual en-US voice of the same gender.
- SSML: Google - one `<speak>`, the other language inside `<voice name=…>`. Azure - each run in its own
  `<voice>`. `<lang>` is not used: Azure only honours it in multilingual voices, and he-IL has none.

## Engine choice (decided by comparison, see `speech-quality-testing`)
| | Google Chirp 3 HD | Azure Speech |
| --- | --- | --- |
| he-IL voices | 30 Chirp 3 HD + 4 WaveNet + 4 Standard | 2 neural (HilaNeural, AvriNeural) |
| he-IL HD / generative tier | yes (Chirp 3 HD) | no (DragonHD has no he-IL) |
| Same persona in en-US | yes, same names | no, a different voice |
| SSML | subset (no emphasis), `<voice>`, `<break>`, `<prosody>`, `<phoneme>` | full SSML, no styles for he-IL |
| Pauses | `<break>`, or `[pause]` tags in `markup` input | `<break>` |
| Streaming | yes (no SSML in streaming) | yes |
Default: **Google Chirp 3 HD**. Azure is supported by the same route (`TTS_PROVIDER=azure`) for A/B tests
and as a second provider. The final call is made by listening (`speech-quality-testing`), not by the table.

## Working instructions
1. Adding a language: add the locale to `Lang` in `segment.ts`, voices per persona in `voices.ts`, a branch
   in `detectLang`, a corpus case in `corpus.ts`, and normalization rules for that language if the engine
   cannot read its numbers.
2. Adding a persona: listen to it on the full corpus first; only voices that pass go in the list.
3. Switching provider: set env vars only (`TTS_PROVIDER`, keys) - no code change. Clips are cached per
   voice id, so a new provider never plays old audio.
4. Device engine (no key, offline, inside Claude): `pickDeviceVoice` prefers voices named
   enhanced/premium/natural/neural. iOS Hebrew voice is "Carmit"; recommend users download the enhanced one
   in Settings > Accessibility > Spoken Content > Voices.

## Quality rules
- A mixed sentence must not change perceived speaker: same persona name in both languages.
- English parts carry their own punctuation; Hebrew parts never contain Latin runs of 2+ words.
- No request without a key on the server; keys never reach the browser bundle (check with
  `grep -r GOOGLE_TTS .next/static` after a build: no hits).

## Examples
| Input | Parts |
| --- | --- |
| `המאמנים אומרים keep your core tight, כלומר...` | he `המאמנים אומרים` / en `keep your core tight,` / he `כלומר...` |
| `זה deadlift רגיל` | he `זה deadlift רגיל` (single word stays) |
| `On November 15, 2026 you lifted 12,450 kilograms.` | en, untouched |

## Test process
1. `cd web && npx vitest run src/lib/speech` (segmentation + SSML tests).
2. With a key: `python cloud_synth.py http://localhost:3200 corpus.json out --voices all`, then transcribe
   and score (`speech-quality-testing`). Compare providers on the same corpus.
3. Listen to every mixed-language case end to end.

## Official documentation
- Chirp 3 HD: https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd
- Google voices and types: https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types
- Azure language and voice support: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
- Azure SSML voice and language: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice
- Web Speech API (device voices): https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
