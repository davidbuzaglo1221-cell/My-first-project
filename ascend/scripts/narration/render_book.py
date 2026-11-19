"""Render one narration file per book: public/audio/<voice>/<book>.mp3 + <book>.json with every chapter's offset,
length and sentence times. Usage: render_book.py <voice> <model> <pace> <kbps> [book-prefix]"""
import json, os, subprocess, sys, time, numpy as np
sys.path.insert(0, '/home/user/tts')
from he_tts import say, flush_cache
voice, model, pace, kbps = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
ONLY = sys.argv[5] if len(sys.argv) > 5 else ''
CHAIN = open('/home/user/tts/master_chain.txt').read().strip()
OUT = f'/home/user/My-first-project/ascend/public/audio/{voice}'
os.makedirs(OUT, exist_ok=True)
books = json.load(open('/home/user/tts/books.json'))
SENT_GAP, PARA_GAP, TRACK_GAP = 0.32, 0.62, 1.6
for bk in books:
    bid = bk['book']
    mp3, meta = f'{OUT}/{bid}.mp3', f'{OUT}/{bid}.json'
    if ONLY and not bid.startswith(ONLY): continue
    if os.path.exists(mp3) and os.path.exists(meta) and not os.environ.get('FORCE'): continue
    t0 = time.time(); chunks = []; cur = 0.0; sr = 22050; tracks = {}
    for tr in bk['tracks']:
        start = cur; segs = []
        for pi, para in enumerate(tr['paras']):
            for si, text in enumerate(para):
                w, sr = say(text, model, pace)
                idx = np.where(np.abs(w) > 0.008)[0]
                if len(idx): w = w[max(0, idx[0] - 200): idx[-1] + 600]
                segs.append(round(cur - start, 2))
                chunks.append(w); cur += len(w) / sr
                gap = PARA_GAP if si == len(para) - 1 else SENT_GAP
                chunks.append(np.zeros(int(gap * sr), np.float32)); cur += gap
        tracks[tr['id']] = {'o': round(start, 3), 'd': round(cur - start, 2), 's': segs}
        chunks.append(np.zeros(int(TRACK_GAP * sr), np.float32)); cur += TRACK_GAP
    audio = np.concatenate(chunks).astype(np.float32)
    raw = mp3 + '.f32'; audio.tofile(raw)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', raw,
                    '-af', CHAIN, '-ar', '22050', '-ac', '1', '-b:a', f'{kbps}k', mp3], check=True)
    os.remove(raw)
    json.dump({'voice': voice, 'tracks': tracks}, open(meta, 'w'), ensure_ascii=False)
    print(f'{voice} {bid} {cur:.0f}s in {time.time()-t0:.0f}s, {os.path.getsize(mp3)//1024}KB', flush=True)
flush_cache()
print('DONE', voice, flush=True)
