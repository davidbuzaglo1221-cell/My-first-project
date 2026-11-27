# Engines — quality, cost and license kept apart

Researched 27.11.2026. Prices change: re-check the official page before telling anyone a number. "Free" below means free with no time limit; trials and unofficial endpoints are labeled.

## Decision (default routing)
| Need | Engine | Why |
|---|---|---|
| Hebrew, any product | **BlueTTS v3 (local)** | best measured Hebrew pronunciation here, context-aware G2P, 15 voices, MIT weights, CPU-only, commercial use OK (voices CC BY 4.0 → credit "voices: LibriTTS-R, CC BY 4.0" in product credits) |
| English, any product | **Kokoro-82M (local)** | native-sounding English, Apache-2.0, CPU, many voices |
| Hebrew + English with one voice | BlueTTS (same voice speaks both; inline Latin words read in English) | |
| Quick drafts / extra voices | Microsoft voices via edge-tts | free, no key, but unofficial endpoint (can break, ToS gray) — never the only path |
| Real emotion control, voice design, top-tier English | ElevenLabs (paid) | only with user approval; vendored guide in `vendor/elevenlabs-text-to-speech/` |

## Comparison
| Engine | Hebrew | Quality notes (measured here unless marked) | Cost | License / commercial | Runs |
|---|---|---|---|---|---|
| **BlueTTS v3** (maxmelichov/BlueTTS) | yes, native focus | see measured table below; no emotion tags; voice cloning from 10 s (consent only) | free | code+weights MIT; stock voices from LibriTTS-R CC BY 4.0 | local CPU, ~2 GB disk, ~1.8× faster than real time per take on 4 vCPU here (3 takes ≈ 0.6× real time; `GVI_TAKES=1` for drafts) |
| **Kokoro-82M** (hexgrad; kokoro-onnx) | **no** | strong English; en/es/fr/it/pt/ja/zh/hi | free | Apache-2.0 | local CPU, 350 MB |
| Phonikud + Piper (Hebrew) | yes | used before in the "ascend" app: ~7–9 % WER there; robotic next to BlueTTS | free | checkpoints **non-commercial** | local CPU |
| Microsoft he-IL Avri/Hila + Multilingual (edge-tts) | yes | see table; no he-IL speaking styles | free via unofficial Edge endpoint | output use unclear for commercial work; no SLA | online |
| Azure AI Speech (same voices, official) | yes | same voices as above + SSML, official | free tier F0: 0.5 M characters/month neural (per Azure pricing page, re-check); then pay-as-you-go | commercial OK under Azure terms | online, needs Azure account + key |
| Google Cloud TTS (Chirp 3 HD, WaveNet, Neural2) | he-IL WaveNet/Standard exist; Chirp 3 HD Hebrew not confirmed | not tested (no key) | Chirp 3 HD: 1 M chars/month free then $30/M (per Google pricing page, re-check) | commercial OK | online, needs GCP billing account |
| ElevenLabs (eleven_v3 / v4, multilingual v2) | yes (multilingual) | not tested (no key); industry reference for expressiveness, `[tags]` emotion control in v3 | Free plan 10 k credits/month **non-commercial with attribution**; commercial from the Starter plan | paid plans = commercial rights | online, key |
| OpenAI gpt-4o-mini-tts | Hebrew not officially confirmed | not tested; steerable with "instructions" | ≈ $0.015 / minute (token-billed: $0.60/M text in, $12/M audio out) | commercial OK | online, key, paid only |
| Qwen3-TTS, Chatterbox, F5, XTTS | no or weak Hebrew | ascend measured Chatterbox Hebrew at 74 % WER — unusable | free | various (XTTS non-commercial) | GPU preferred |

## Measured on this skill's suite (27.11.2026)
Filled from `samples/2026-11-27/` — see that report for every number and transcript.

### Voice screening — raw engine output (no style processing), 6 Hebrew lines per voice
Hebrew ASR: ivrit-ai whisper-large-v3-turbo. "question end" = pitch movement at the end of a yes/no question (should be > +0.5). Single render per line: BlueTTS varies per render, so treat ±3 st as noise.

| Voice | median pitch | Hebrew CER | pitch range st | question end st | brand names in Hebrew |
|---|---|---|---|---|---|
| edge:en-US-EmmaMultilingualNeural | 185 Hz (high) | 3.2% | 9.2 | +4.2 | FAIL |
| edge:en-US-BrianMultilingualNeural | 129 Hz (low) | 5.3% | 8.1 | +6.3 | FAIL |
| blue:adam | 106 Hz (low) | 0.0% | 7.8 | -1.7 | ok |
| blue:ariel | 134 Hz (low) | 0.0% | 9.4 | +0.5 | ok |
| blue:daniel | 138 Hz (low) | 0.8% | 7.9 | +5.4 | ok |
| blue:david | 103 Hz (low) | 0.0% | 9.9 | +4.9 | ok |
| blue:emma | 202 Hz (high) | 0.0% | 7.0 | -0.4 | ok |
| blue:ethan | 166 Hz (mid) | 0.0% | 8.3 | +0.6 | ok |
| blue:jonathan | 122 Hz (low) | 0.0% | 8.6 | +4.2 | ok |
| blue:lily | 207 Hz (high) | 0.0% | 8.2 | +0.6 | ok |
| blue:maya | 199 Hz (high) | 0.0% | 7.1 | -2.6 | ok |
| blue:michael | 134 Hz (low) | 0.0% | 10.3 | -6.1 | ok |
| blue:noa | 197 Hz (high) | 0.8% | 7.4 | +3.1 | ok |
| blue:sara | 191 Hz (high) | 0.0% | 8.2 | +7.3 | ok |
| blue:shira | 207 Hz (high) | 0.2% | 8.3 | +2.0 | ok |
| blue:tamar | 202 Hz (high) | 0.4% | 9.5 | -0.7 | ok |
| blue:yael | 188 Hz (high) | 0.0% | 9.6 | -7.8 | ok |
| edge:he-IL-AvriNeural | 105 Hz (low) | 4.8% | 7.7 | +9.0 | FAIL |
| edge:he-IL-HilaNeural | 207 Hz (high) | 3.4% | 5.1 | +6.7 | FAIL |

### English screening, 4 lines per voice (Whisper small.en)
Kokoro's 2.6 % was one line ("$45", "2:30"), fixed in textprep → 0 % after the fix.

| Voice | English CER | pitch range st | question end st |
|---|---|---|---|
| kokoro:af_heart | 2.6% | 8.3 | +3.7 |
| kokoro:af_bella | 0.8% | 8.6 | -14.1 |
| kokoro:bf_emma | 2.6% | 5.8 | -3.6 |
| kokoro:am_michael | 2.6% | 8.4 | -4.0 |
| kokoro:am_puck | 2.6% | 9.4 | -5.0 |
| kokoro:am_fenrir | 2.7% | 12.8 | -6.2 |
| kokoro:bm_george | 2.6% | 10.1 | -11.6 |
| blue:david | 1.8% | 10.1 | +8.4 |
| blue:sara | 1.8% | 9.0 | +6.5 |
| edge:en-US-AndrewMultilingualNeural | 4.1% | 11.2 | +1.0 |
| edge:en-US-AvaMultilingualNeural | 1.8% | 8.7 | +8.1 |


### Full suite on the final settings (3 takes, continuity anchoring, final styles)
Voices: blue:david and blue:sara (local, the Hebrew defaults), kokoro:af_heart (English default), edge:he-IL-AvriNeural (Microsoft, for comparison). Every file and transcript: `samples/2026-11-27/suite/`.

| voice | he CER | en CER | numbers CER | foreign CER | long CER | pitch range st | question rises | statement falls | sync | continuity loud/drift |
|---|---|---|---|---|---|---|---|---|---|---|
| blue:david | 0.4% | 0.0% | 0.0% | 4.8% | 0.0% | 10.6 | NO | yes | 35/35 | 0.64 dB / 3.5% |
| blue:sara | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 10.0 | yes | yes | 35/35 | 0.66 dB / 1.6% |
| kokoro:af_heart | — | 0.0% | 0.0% | — | 0.0% | 9.6 | yes | — | 10/10 | — |
| edge:he-IL-AvriNeural | 1.7% | — | 0.0% | 17.5% | 0.9% | 10.1 | yes | yes | 25/25 | 0.15 dB / 3.0% |

## Emotion (same line, three styles: must differ)
- blue:david: advertisement: 13.4 st, 7.1 ch/s, audiobook: 7.7 st, 6.1 ch/s, storytelling: 11.5 st, 5.8 ch/s
- blue:sara: advertisement: 9.5 st, 6.7 ch/s, audiobook: 10.1 st, 5.9 ch/s, storytelling: 10.9 st, 5.8 ch/s
- edge:he-IL-AvriNeural: advertisement: 12.3 st, 7.4 ch/s, audiobook: 11.8 st, 6.0 ch/s, storytelling: 12.2 st, 5.9 ch/s

Reading it:
- Hebrew intelligibility: local BlueTTS 0–0.4 % CER; Microsoft Avri 1.7 % and 17.5 % on English brand names inside Hebrew (fails "Google Drive", "iPhone", "ChatGPT"). blue:david's 4.8 % "foreign" is ASR casing of "GPT" — counted, since fixed in qa.py.
- Every Hebrew yes/no question rose and every statement fell (both local voices). blue:david's **English** question ended at +0.5 st, exactly on the bar → for English questions prefer kokoro:af_heart or blue:sara, or check the take.
- Continuity: pitch drift 1.6–3.5 %, loudness spread ≤ 0.7 dB. Sync: 105/105 caption cues within 0.12 s.
- Emotion: pace differs clearly between styles (advertisement ~7 ch/s vs. audiobook/storytelling ~5.8–6.1); pitch range differs strongly for blue:david (7.7–13.4 st) but only 9.5–10.9 st for blue:sara. Emotion without emotion tags is limited; for strong acting use script rhythm and pauses (hebrew.md §5) or a paid engine with tags (approval needed).



## Adding a paid engine (only after approval)
1. User approves the cost and adds the key as an environment secret (never in chat, never in files).
2. Add an adapter in `voice.py` (`ENGINES`), cache by text+voice+model (cost control), print the character count before rendering.
3. Run `qa.py suite` on it, save the report next to the free baseline, and only switch if it wins where it matters.
