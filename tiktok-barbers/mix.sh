#!/bin/bash
# Stage 3: voice polish + sidechain ducking + loudness normalization (-14 LUFS for TikTok)
set -e
ffmpeg -y -hide_banner -loglevel error -i build/voice_raw.wav -i build/music.wav -i build/sfx.wav -filter_complex "
[0:a]aresample=48000:resampler=soxr,highpass=f=75,afftdn=nf=-35,
 equalizer=f=160:t=q:w=1:g=2.5,equalizer=f=450:t=q:w=1.2:g=-2,equalizer=f=3200:t=q:w=1:g=3.5,
 aexciter=level_in=1:level_out=1:amount=2.2:drive=7:blend=0:freq=3800:ceil=16000,
 acompressor=threshold=-20dB:ratio=3.5:attack=4:release=90:makeup=3,
 aecho=0.9:0.5:22|37:0.10|0.06,alimiter=limit=0.9,pan=stereo|c0=c0|c1=c0,asplit=2[v][key];
[1:a]volume=0.30[m];
[m][key]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350:makeup=1[mduck];
[2:a]volume=0.9[s];
[v][mduck][s]amix=inputs=3:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.2:LRA=9,aresample=48000[out]" \
 -map "[out]" -c:a pcm_s16le build/mix.wav
echo mixed
