#!/usr/bin/env bash
# Grade, grain, upscale to 1080x1920 and mux with the score. Usage: finish.sh FRAMES_DIR AUDIO_WAV OUT_MP4
set -euo pipefail
F=$1; A=$2; O=$3
ffmpeg -v error -y -framerate 24 -i "$F/f_%04d.png" -i "$A" \
  -filter_complex "[0:v]scale=1080:1920:flags=lanczos,\
curves=all='0/0 0.08/0.035 0.5/0.47 0.85/0.88 1/0.97',\
colorbalance=rs=0.03:bs=-0.04:rh=0.02:bh=-0.03,\
vignette=angle=0.55,\
noise=c0s=9:c0f=t+u:c1s=3:c2s=3,format=yuv420p[v];\
[1:a]loudnorm=I=-14:TP=-1.5:LRA=11[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 16 -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$O"
echo "done $O"
