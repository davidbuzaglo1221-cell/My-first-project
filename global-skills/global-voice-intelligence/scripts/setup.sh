#!/usr/bin/env bash
# Install the free local voice engines for GLOBAL VOICE INTELLIGENCE into ~/.local/share/gvi (idempotent).
#   setup.sh          engines + English/Hebrew QA models (~4.5 GB download, ~6 min on a fast link)
#   setup.sh --lite   BlueTTS + edge only, no QA models (~2.2 GB)
# Sources are official only: github.com/maxmelichov/BlueTTS (MIT), huggingface.co/notmax123/BlueV3-onnx (MIT),
# github.com/thewh1teagle/kokoro-onnx releases (Apache-2.0), ivrit-ai/whisper-large-v3-turbo-ct2, Systran/faster-whisper-small.en.
set -euo pipefail
G="${GVI_HOME:-$HOME/.local/share/gvi}"; mkdir -p "$G/models/kokoro"; cd "$G"
command -v ffmpeg >/dev/null || { echo "ffmpeg missing: install it (apt-get install -y ffmpeg / brew install ffmpeg)"; exit 1; }
command -v uv >/dev/null || pip install -q uv
[ -d bluetts ] || git clone -q --depth 1 https://github.com/maxmelichov/BlueTTS.git bluetts
[ -x venv/bin/python ] || uv venv -q -p 3.12 venv
export VIRTUAL_ENV="$G/venv" PATH="$G/venv/bin:$PATH"
uv pip install -q -e "bluetts[hebrew]" edge-tts praat-parselmouth jiwer soundfile librosa num2words kokoro-onnx faster-whisper
[ -f bluev3_onnx/onnx/tts.json ] || [ -d bluev3_onnx/voices ] || \
  hf download notmax123/BlueV3-onnx --include "onnx/*" --include "voices/*" --include "frontend/*" --local-dir ./bluev3_onnx >/dev/null
uv pip install -q --no-index --find-links ./bluev3_onnx/frontend polyg2p==0.1.0 2>/dev/null || echo "polyg2p wheel not available here: BlueTTS English off, Hebrew fine"
if [ "${1:-}" != "--lite" ]; then
  [ -f models/kokoro/voices-v1.0.bin ] || {
    curl -sSL -o models/kokoro/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    curl -sSL -o models/kokoro/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin; }
  [ -f models/ivrit-turbo/model.bin ] || hf download ivrit-ai/whisper-large-v3-turbo-ct2 --local-dir models/ivrit-turbo >/dev/null
  [ -f models/whisper-small-en/model.bin ] || hf download Systran/faster-whisper-small.en --local-dir models/whisper-small-en >/dev/null
fi
echo "GVI ready in $G — try: $G/venv/bin/python ~/.claude/skills/global-voice-intelligence/scripts/voice.py voices"
