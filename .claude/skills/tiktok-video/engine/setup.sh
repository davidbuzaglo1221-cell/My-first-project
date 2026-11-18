#!/usr/bin/env bash
# Prepares a working folder for a new video: engine scripts, fonts, Python deps,
# and (optionally) the Hebrew Whisper model used to verify the narration.
# Usage: setup.sh <work-dir> [example-name]   (example defaults to book-tips)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$1"; EX="${2:-book-tips}"
mkdir -p "$WORK/fonts" && cp "$HERE"/*.py "$HERE"/*.js "$WORK/"
for f in index.html script.json; do [ -e "$WORK/$f" ] || cp "$HERE/../examples/$EX/$f" "$WORK/"; done
pip install -q edge-tts faster-whisper numpy pillow >/dev/null 2>&1 || true
cd "$WORK/fonts"
for p in @fontsource/heebo @fontsource/frank-ruhl-libre; do
  n=$(npm pack "$p" 2>/dev/null | tail -1); d="${n%.tgz}"
  [ -d "$d" ] || { tar xzf "$n" && mv package "$d"; }
done
# index.html links fonts/fontsource-heebo-<ver>/..., normalise to version-less names
for d in fontsource-heebo-* fontsource-frank-ruhl-libre-*; do
  [ -d "$d" ] && [ ! -e "${d%-[0-9]*}" ] && ln -s "$d" "${d%-[0-9]*}"
done
if [ "${WITH_WHISPER:-1}" = 1 ] && [ ! -f "$WORK/wm/model.bin" ]; then
  mkdir -p "$WORK/wm"
  for f in config.json tokenizer.json vocabulary.json preprocessor_config.json model.bin; do
    curl -sSL -o "$WORK/wm/$f" "https://huggingface.co/ivrit-ai/whisper-large-v3-turbo-ct2/resolve/main/$f"
  done
fi
echo "ready: $WORK"
