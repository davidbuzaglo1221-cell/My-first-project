#!/usr/bin/env bash
# Finish a talking-character clip for Reels: 1080x1920, slow push-in, punch-in at the punchline,
# burned Hebrew word-timed captions (ASS from captions.py), loudness -14 LUFS.
# Usage: bash finish.sh talk.mp4 voice.mp3 captions.ass out.mp4 [punch_seconds]
set -euo pipefail
IN="$1"; VOICE="$2"; ASS="$3"; OUT="$4"; PUNCH="${5:-}"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VOICE")
# gentle 4% push-in over the clip; +8% snap zoom from the punchline on
Z="1+0.04*t/${DUR}"
[ -n "$PUNCH" ] && Z="${Z}+if(gte(t\,${PUNCH})\,0.08\,0)"
ffmpeg -y -v error -i "$IN" -i "$VOICE" \
  -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,\
scale=w='trunc(1080*(${Z})/2)*2':h='trunc(1920*(${Z})/2)*2':eval=frame,crop=1080:1920:(iw-1080)/2:(ih-1920)*0.35,\
ass=${ASS}[v];[1:a]loudnorm=I=-14:TP=-1.5:LRA=7[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k \
  -t "$DUR" -movflags +faststart "$OUT"
echo "[finish] $OUT"
