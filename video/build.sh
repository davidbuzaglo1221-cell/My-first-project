#!/bin/sh
# Builds the full 20-minute video: frames in parallel chunks, original soundtrack, then mux.
# Usage: ./build.sh <output-dir>
set -e
OUT=${1:-out}
mkdir -p "$OUT"
cd "$(dirname "$0")"
seq 0 11 | xargs -P4 -I{} sh -c "python3 render.py chunk \$(({}*3000)) \$(({}*3000+3000)) $OUT/chunk_\$(printf %02d {}).mp4"
python3 audio.py "$OUT/music.wav"
ls "$OUT"/chunk_*.mp4 | sed "s|.*/|file '|; s|$|'|" > "$OUT/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/list.txt" -i "$OUT/music.wav" \
  -map 0:v -map 1:a -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=9 -c:a aac -b:a 192k -ar 44100 \
  -movflags +faststart "$OUT/20-tips.mp4"
echo "$OUT/20-tips.mp4"
