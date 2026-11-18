---
name: speech-quality-testing
description: Tests speech quality with real audio - synthesizes a Hebrew/English test corpus (offline open voices or the cloud engine through /api/tts), listens back with Hebrew Whisper to score pronunciation word by word, measures loudness, pitch range (monotony), pauses and pace, and runs the player end to end. Use before declaring any speech change done, when comparing TTS engines or voices, or when someone reports a mispronunciation.
allowed-tools: Bash(npx vitest *) Bash(node e2e-listen.cjs*) Bash(ffmpeg *)
---

# Speech quality testing

## Role
You are the listening QA. Nothing about the voice is "done" until real audio was produced, transcribed
back, measured, and the controls were exercised in a browser. Code that compiles is not a test.

## Goals
- Every corpus sentence comes back from transcription word-perfect (WER 0) on numbers, dates and units.
- Prepared text (`app`) measurably beats raw text (`raw`) on the same voice.
- Engines and voices are chosen on this evidence, not on marketing.

## Tools (all in `scripts/`)
| Script | Does |
| --- | --- |
| `synth_local.py MODELS corpus.json OUT [--only-raw-diff]` | Offline Hebrew (Phonikud + Piper "shaul") and English (Piper lessac) audio, `raw` and `app` variants |
| `cloud_synth.py BASE corpus.json OUT [--voices all]` | Same corpus through the app's own `/api/tts` (Google or Azure, needs a key) |
| `asr.py WHISPER_DIR manifest.json asr.json` | Transcribes every clip (ivrit-ai Whisper large-v3-turbo for Hebrew) |
| `audio_metrics.py manifest.json metrics.json` | LUFS, true peak, pitch range in semitones, pause ratio, pace |
| `web/src/lib/speech/corpus.test.ts` | Exports the corpus; scores transcripts (WER per sentence, per engine/variant) |
| `web/e2e-listen.cjs` | Every player control, both engines, fallback, continue-listening, iPhone-size screenshots |

The corpus = `web/src/lib/speech/corpus.ts` (hard cases) + every sentence of every lesson.

## One-time setup (outside the repo, in a scratch folder)
```bash
uv venv --python 3.12 venv        # phonikud supports Python < 3.13
VIRTUAL_ENV=$PWD/venv uv pip install phonikud-onnx piper-onnx faster-whisper soundfile numpy \
  "phonikud @ git+https://github.com/thewh1teagle/phonikud.git"
mkdir models && cd models
curl -LO https://huggingface.co/Phonikud/phonikud-onnx/resolve/main/phonikud-1.0.int8.onnx
curl -LO https://huggingface.co/Phonikud/phonikud-tts-checkpoints/resolve/main/shaul.onnx
curl -LO https://huggingface.co/Phonikud/phonikud-tts-checkpoints/resolve/main/model.config.json
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
mkdir whisper && for f in config.json preprocessor_config.json tokenizer.json vocabulary.json model.bin; do
  curl -L -o whisper/$f https://huggingface.co/ivrit-ai/whisper-large-v3-turbo-ct2/resolve/main/$f; done
```
Needs `ffmpeg`. Run Python with `-I` and keep downloaded models in their own folder.

## Test process
1. Unit + corpus checks: `cd web && npx vitest run src/lib/speech`
2. Export: `SPEECH_CORPUS_OUT=$S/corpus.json npx vitest run src/lib/speech/corpus.test.ts`
3. Synthesize:
   - offline: `venv/bin/python -I scripts/synth_local.py models corpus.json audio --only-raw-diff`
   - cloud: start `next dev` with the key, `python cloud_synth.py http://localhost:3200 corpus.json cloud --voices all`
4. Listen back: `venv/bin/python -I scripts/asr.py models/whisper audio/manifest.json asr.json`
5. Score: `SPEECH_SCORE_IN=asr.json SPEECH_SCORE_OUT=report.json npx vitest run src/lib/speech/corpus.test.ts`
6. Measure: `venv/bin/python -I scripts/audio_metrics.py audio/manifest.json metrics.json`
7. Player: `npm run build && npx next start -p 3100 &` then
   `CLIPS_DIR=$S/audio CORPUS=$S/corpus.json node e2e-listen.cjs` (plays the real clips in Chromium).
8. Listen yourself to every sentence whose WER > 0 and to one of each `focus` type; write down what you heard.

## Quality rules (pass / fail)
- `corpus.test.ts` green: no digits, `%`, `×` or edge quote marks reach a Hebrew voice.
- Mean WER of `app` < mean WER of `raw` on the same voice; WER 0 on `gender`, `range`, `date+time`,
  `percent`, `large numbers` cases for the production engine.
- Loudness -16 +- 1 LUFS, true peak < -1 dBTP (after server normalisation if the engine misses it).
- Body sentences: pitch range >= 4 semitones (monotone below 3); pace 12-16 Hebrew chars/s at 1x.
- e2e: all controls pass, `errors: none`.

## Reading the scores honestly
- Whisper rewrites numbers as digits; the scorer re-normalizes transcripts, so a wrong *gender* said by the
  voice can still score 0. Gender is therefore also asserted in unit tests and checked by ear.
- The offline voice is a test instrument for the text pipeline. It is not the production voice; its scores
  do not rate Chirp 3 HD or Azure. Run step 3 (cloud) for that.
- Whisper can mishear clean audio (prefix letters ב/ל/ו, homographs). Listen before blaming the voice.

## Official documentation
- Chirp 3 HD: https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd
- Google voices list: https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types
- Azure language support: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
- Hebrew Whisper (ivrit.ai): https://huggingface.co/ivrit-ai/whisper-large-v3-turbo-ct2
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
- Phonikud (Hebrew G2P + TTS): https://huggingface.co/Phonikud/phonikud-onnx
- Piper voices: https://huggingface.co/rhasspy/piper-voices
- EBU R 128 (how loudness is measured; its -23 LUFS target is for broadcast, apps and podcasts use about -16): https://tech.ebu.ch/publications/r128
