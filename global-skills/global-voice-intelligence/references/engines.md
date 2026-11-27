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
| **BlueTTS v3** (maxmelichov/BlueTTS) | yes, native focus | see measured table below; no emotion tags; voice cloning from 10 s (consent only) | free | code+weights MIT; stock voices from LibriTTS-R CC BY 4.0 | local CPU, ~2 GB disk, ~1.8× real time on 4 vCPU here |
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

MEASURED_TABLE

## Adding a paid engine (only after approval)
1. User approves the cost and adds the key as an environment secret (never in chat, never in files).
2. Add an adapter in `voice.py` (`ENGINES`), cache by text+voice+model (cost control), print the character count before rendering.
3. Run `qa.py suite` on it, save the report next to the free baseline, and only switch if it wins where it matters.
