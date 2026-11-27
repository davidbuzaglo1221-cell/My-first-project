"""Studio master for David's own voice recordings (phone memos -> app-ready).
Usage: python3 david_master.py in.(webm|m4a|wav) out.wav
1) shorten pauses longer than 0.75 s to 0.7 s, 2) widen intonation 25% around the median and deepen 1.5% (Praat PSOLA,
formants kept), 3) warm/present EQ, de-esser, compressor, a soft room, -16 LUFS. Check afterwards with Hebrew ASR."""
import re, subprocess, sys, tempfile, os
import numpy as np, parselmouth, soundfile as sf
from parselmouth.praat import call

CHAIN = ("highpass=f=60,equalizer=f=110:t=q:w=0.9:g=2.5,equalizer=f=320:t=q:w=1.2:g=-2,equalizer=f=3200:t=q:w=1.3:g=2.5,"
         "deesser=i=0.35:f=0.55,highshelf=f=9000:g=2,acompressor=threshold=-22dB:ratio=3:attack=6:release=150:makeup=2,"
         "aecho=0.8:0.85:28|47:0.06|0.04,loudnorm=I=-16:TP=-1.5:LRA=7")

def main(src, dst, k=1.25, shift=0.985):
    tmp = tempfile.mkdtemp()
    wav = os.path.join(tmp, 'in.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ar', '48000', '-ac', '1', wav], check=True)
    w, sr = sf.read(wav); w = w.astype(np.float32)
    log = subprocess.run(['ffmpeg', '-hide_banner', '-i', wav, '-af', 'silencedetect=noise=-38dB:d=0.75', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', log)]
    en = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', log)]
    keep, cur = [], 0.0
    for a, b in zip(st, en):
        if a < 0.05: cur = max(cur, b - 0.25); continue
        keep.append((cur, a + 0.35)); cur = b - 0.35
    keep.append((cur, len(w) / sr))
    fade = int(0.015 * sr); parts = []
    for a, b in keep:
        seg = w[int(a * sr):int(b * sr)].copy()
        if len(seg) > 2 * fade: seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
        parts.append(seg)
    t = np.concatenate(parts)
    snd = parselmouth.Sound(t.astype(np.float64), sampling_frequency=sr)
    man = call(snd, 'To Manipulation', 0.01, 60, 300)
    med = call(snd.to_pitch(time_step=0.01, pitch_floor=60, pitch_ceiling=300), 'Get quantile', 0, 0, 0.5, 'Hertz')
    pt = call(man, 'Extract pitch tier'); call(pt, 'Formula', f'{med * shift} * (self / {med}) ^ {k}'); call([pt, man], 'Replace pitch tier')
    live = os.path.join(tmp, 'live.wav')
    sf.write(live, call(man, 'Get resynthesis (overlap-add)').values[0].astype(np.float32), sr)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', live, '-af', CHAIN, '-ar', '48000', dst], check=True)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
