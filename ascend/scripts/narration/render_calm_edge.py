"""Guided practices in Maya's voice, slowed down, with the written silences, a soft bed and a bell at both ends."""
import asyncio, json, os, subprocess, sys, numpy as np
sys.path.insert(0, '/home/user/tts')
import render_edge as R
OUT = '/home/user/My-first-project/ascend/public/audio/calm'; os.makedirs(OUT, exist_ok=True)
SR = R.SR; RATE = '-12%'; VOICE = 'maya'
items = json.load(open('/home/user/tts/calm.json'))
lines = [l for it in items for l in it['lines'] if not l.startswith('~')]
asyncio.run(R.synth_all({VOICE: [(l, RATE) for l in lines]}))
def bell():
    t = np.arange(int(SR * 5.5)) / SR
    return (sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in [(528, .5, .9), (1056, .18, 1.6), (1584, .08, 2.4), (792, .12, 1.2)]) * 0.17).astype(np.float32)
for it in items:
    chunks = [bell(), np.zeros(int(.8 * SR), np.float32)]; cur = sum(len(c) for c in chunks) / SR; segs = []
    for line in it['lines']:
        if line.startswith('~'):
            sec = float(line[1:].strip() or 3); chunks.append(np.zeros(int(sec * SR), np.float32)); cur += sec; continue
        w = R.pcm(R.key(VOICE, line, RATE)); segs.append({'t': round(cur, 2), 'text': line}); chunks.append(w); cur += len(w) / SR
        chunks.append(np.zeros(int(1.1 * SR), np.float32)); cur += 1.1
    chunks += [np.zeros(int(1.5 * SR), np.float32), bell()]; cur += 7.0
    raw = f'{OUT}/{it["id"]}.f32'; np.concatenate(chunks).astype(np.float32).tofile(raw); mp3 = f'{OUT}/{it["id"]}.mp3'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', raw,
        '-f', 'lavfi', '-i', f'anoisesrc=color=brown:amplitude=0.5:sample_rate={SR}:duration={cur:.2f}',
        '-filter_complex', f'[0]{R.CHAIN}[v];[1]lowpass=f=420,highpass=f=60,volume=0.2,afade=t=in:d=6,afade=t=out:st={max(0, cur-7):.2f}:d=6[n];[v][n]amix=inputs=2:duration=first:normalize=0[m]',
        '-map', '[m]', '-ar', str(SR), '-ac', '1', '-b:a', '48k', mp3], check=True)
    os.remove(raw)
    json.dump({'duration': round(cur, 2), 'segments': segs, 'voice': 'calm'}, open(f'{OUT}/{it["id"]}.json', 'w'), ensure_ascii=False)
    print(it['id'], f'{cur:.0f}s', flush=True)
