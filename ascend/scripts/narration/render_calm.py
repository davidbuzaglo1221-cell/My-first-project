"""Render the guided practices: slow narration, the written silences, a soft brown-noise bed and a bell at both ends.
Writes public/audio/calm/<id>.mp3 + .json (sentence times). Usage: render_calm.py [id]"""
import json, os, subprocess, sys, numpy as np
sys.path.insert(0, '/home/user/tts')
from he_tts import say, flush_cache
OUT = '/home/user/My-first-project/ascend/public/audio/calm'
os.makedirs(OUT, exist_ok=True)
SR = 22050
def bell(sr=SR):
    t = np.arange(int(sr * 5.5)) / sr
    tone = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in [(528, .5, .9), (1056, .18, 1.6), (1584, .08, 2.4), (792, .12, 1.2)])
    return (tone * 0.17).astype(np.float32)
for it in json.load(open('/home/user/tts/calm.json')):
    if len(sys.argv) > 1 and it['id'] != sys.argv[1]: continue
    chunks = [bell(), np.zeros(int(.8 * SR), np.float32)]; cur = sum(len(c) for c in chunks) / SR; segs = []
    for line in it['lines']:
        if line.startswith('~'):
            sec = float(line[1:].strip() or 3); chunks.append(np.zeros(int(sec * SR), np.float32)); cur += sec; continue
        w, sr = say(line, 'michael', 1.32)
        idx = np.where(np.abs(w) > 0.008)[0]
        if len(idx): w = w[max(0, idx[0] - 200): idx[-1] + 600]
        segs.append({'t': round(cur, 2), 'text': line}); chunks.append(w); cur += len(w) / sr
        chunks.append(np.zeros(int(1.1 * SR), np.float32)); cur += 1.1
    chunks += [np.zeros(int(1.5 * SR), np.float32), bell()]; cur += 1.5 + 5.5
    voice = np.concatenate(chunks).astype(np.float32)
    raw = f'{OUT}/{it["id"]}.f32'; voice.tofile(raw)
    mp3 = f'{OUT}/{it["id"]}.mp3'
    chain = open('/home/user/tts/master_chain.txt').read().strip()
    # voice mastered as usual; a quiet low brown-noise bed under it, fading in and out
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', raw,
        '-f', 'lavfi', '-i', f'anoisesrc=color=brown:amplitude=0.5:sample_rate={SR}:duration={cur:.2f}',
        '-filter_complex', f'[0]{chain}[v];[1]lowpass=f=420,highpass=f=60,volume=0.2,afade=t=in:d=6,afade=t=out:st={max(0, cur-7):.2f}:d=6[n];[v][n]amix=inputs=2:duration=first:normalize=0[m]',
        '-map', '[m]', '-ar', '22050', '-ac', '1', '-b:a', '40k', mp3], check=True)
    os.remove(raw)
    json.dump({'duration': round(cur, 2), 'segments': segs, 'voice': 'calm'}, open(f'{OUT}/{it["id"]}.json', 'w'), ensure_ascii=False)
    print(it['id'], f'{cur:.0f}s', os.path.getsize(mp3) // 1024, 'KB', flush=True)
flush_cache()
