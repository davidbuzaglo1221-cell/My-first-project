"""Render every ASCEND narration to MP3 with per-sentence timings. Resumable: finished items are skipped."""
import json, os, subprocess, sys, time, torch, numpy as np
SHARD, NSHARD = int(sys.argv[1]), int(sys.argv[2])
torch.set_num_threads(4 // NSHARD)
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
OUT = '/home/user/My-first-project/ascend/public/audio'
os.makedirs(OUT, exist_ok=True)
items = json.load(open('/home/user/tts/scripts.json'))[SHARD::NSHARD]
m = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
sr = m.sr
SENT_GAP, PARA_GAP = 0.32, 0.7
for n, it in enumerate(items):
    mp3 = f"{OUT}/{it['id']}.mp3"
    meta = f"{OUT}/{it['id']}.json"
    if os.path.exists(mp3) and os.path.exists(meta):
        continue
    t0 = time.time()
    chunks, segs, cur = [], [], 0.0
    for pi, para0 in enumerate(it['paras']):
        # Very short sentences make the model ramble: render them joined to the next one.
        groups, buf = [], []
        for t_ in para0:
            buf.append(t_)
            if sum(len(x) for x in buf) >= 38:
                groups.append(buf); buf = []
        if buf:
            if groups and sum(len(x) for x in buf) < 38: groups[-1] += buf
            else: groups.append(buf)
        para = [' '.join(g) for g in groups]
        for si, text in enumerate(para):
            parts = groups[si]
            # Quality gate: Hebrew narration runs ~11 characters a second. A take far off that rate
            # is either clipped or the model rambling, so re-render and keep the closest take.
            expect = len(text) / 11.0 + 0.4
            best, best_err = None, 9e9
            for attempt in range(4):
                torch.manual_seed(7 + attempt * 101)
                w = m.generate(text, language_id='he', exaggeration=0.45, cfg_weight=0.5, temperature=0.6 if attempt == 0 else 0.55).squeeze(0).numpy()
                idx = np.where(np.abs(w) > 0.01)[0]
                if len(idx): w = w[max(0, idx[0] - 400): idx[-1] + 1200]
                ratio = (len(w) / sr) / expect
                err = abs(np.log(max(ratio, 1e-3)))
                if err < best_err: best, best_err = w, err
                if 0.58 <= ratio <= 1.38: break
                print(f"   retry {it['id']} seg ratio {ratio:.2f}: {text[:30]}", flush=True)
            wav = best
            dur = len(wav) / sr
            total = sum(len(x) for x in parts); acc = 0
            for part in parts:
                segs.append({'t': round(cur + dur * acc / total, 2), 'text': part}); acc += len(part) + 1
            chunks.append(wav); cur += dur
            gap = PARA_GAP if si == len(para) - 1 else SENT_GAP
            chunks.append(np.zeros(int(gap * sr), dtype=np.float32)); cur += gap
    audio = np.concatenate(chunks).astype(np.float32)
    raw = f"{OUT}/{it['id']}.f32"
    audio.tofile(raw)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', raw,
                    '-af', 'loudnorm=I=-17:TP=-1.5:LRA=9', '-ar', '44100', '-ac', '1', '-b:a', '80k', mp3], check=True)
    os.remove(raw)
    json.dump({'duration': round(cur, 2), 'segments': segs}, open(meta, 'w'), ensure_ascii=False)
    print(f"[{n+1}/{len(items)}] {it['id']} {cur:.0f}s audio in {time.time()-t0:.0f}s", flush=True)
print('DONE', flush=True)
