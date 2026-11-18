"""Render every ASCEND narration with a Phonikud voice: public/audio/<voice>/<id>.mp3 + .json (exact sentence times)."""
import json, os, subprocess, sys, time, numpy as np
sys.path.insert(0, '/home/user/tts')
from he_tts import say, phonemes, flush_cache
voice, model, pace = sys.argv[1], sys.argv[2], float(sys.argv[3])
OUT = f'/home/user/My-first-project/ascend/public/audio/{voice}'
os.makedirs(OUT, exist_ok=True)
items = json.load(open('/home/user/tts/scripts.json'))
SENT_GAP, PARA_GAP = 0.32, 0.62
for it in items:
    mp3, meta = f"{OUT}/{it['id']}.mp3", f"{OUT}/{it['id']}.json"
    if os.path.exists(mp3) and os.path.exists(meta): continue
    t0 = time.time(); chunks = []; segs = []; cur = 0.0; sr = 22050
    for pi, para in enumerate(it['paras']):
        for si, text in enumerate(para):
            w, sr = say(text, model, pace)
            idx = np.where(np.abs(w) > 0.008)[0]
            if len(idx): w = w[max(0, idx[0] - 200): idx[-1] + 600]
            segs.append({'t': round(cur, 2), 'text': text})
            chunks.append(w); cur += len(w) / sr
            gap = PARA_GAP if si == len(para) - 1 else SENT_GAP
            chunks.append(np.zeros(int(gap * sr), np.float32)); cur += gap
    audio = np.concatenate(chunks).astype(np.float32)
    raw = mp3 + '.f32'; audio.tofile(raw)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', raw,
                    '-af', 'highpass=f=60,loudnorm=I=-17:TP=-1.5:LRA=9', '-ar', '44100', '-ac', '1', '-b:a', '56k', mp3], check=True)
    os.remove(raw)
    json.dump({'duration': round(cur, 2), 'segments': segs, 'voice': voice}, open(meta, 'w'), ensure_ascii=False)
    print(f"{voice} {it['id']} {cur:.0f}s in {time.time()-t0:.1f}s", flush=True)
flush_cache()
print('DONE', voice, flush=True)
