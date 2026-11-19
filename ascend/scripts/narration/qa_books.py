"""Check per-book narration: cut every chapter out of its book file at the manifest offset, transcribe it,
and compare with that chapter's script. A wrong offset or a garbled read shows up as a high error rate.
Usage: qa_books.py <voice> [book-prefix]"""
import json, sys, re, os, jiwer, subprocess, numpy as np
from faster_whisper import WhisperModel
voice = sys.argv[1]; ONLY = sys.argv[2] if len(sys.argv) > 2 else ''
m = WhisperModel('ivrit-ai/whisper-large-v3-turbo-ct2', device='cpu', compute_type='int8', cpu_threads=4)
books = json.load(open('/home/user/tts/books.json'))
clean = lambda t: re.sub(r'\s+', ' ', re.sub(r'[^א-ת ]', ' ', re.sub(r'[֑-ׇ]', '', t))).strip()
D = f'/home/user/My-first-project/ascend/public/audio/{voice}'
out = f'/home/user/tts/qa_books_{voice}.json'
res = json.load(open(out)) if os.path.exists(out) else {}
for bk in books:
    bid = bk['book']
    if ONLY and not bid.startswith(ONLY): continue
    if not os.path.exists(f'{D}/{bid}.json'): continue
    meta = json.load(open(f'{D}/{bid}.json'))['tracks']
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f'{D}/{bid}.mp3', '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True).stdout
    pcm = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    for tr in bk['tracks']:
        if tr['id'] in res: continue
        t = meta[tr['id']]
        clip = pcm[int(t['o'] * 16000): int((t['o'] + t['d']) * 16000)]
        segs, _ = m.transcribe(clip, language='he', beam_size=3, vad_filter=True)
        hyp = clean(' '.join(s.text for s in segs)); ref = clean(' '.join(' '.join(p) for p in tr['paras']))
        res[tr['id']] = {'wer': round(jiwer.wer(ref, hyp), 3), 'cer': round(jiwer.cer(ref, hyp), 3), 'hyp': hyp}
        print(f"{tr['id']:42s} WER {res[tr['id']]['wer']:.1%} CER {res[tr['id']]['cer']:.1%}", flush=True)
        json.dump(res, open(out, 'w'), ensure_ascii=False)
w = [r['wer'] for r in res.values()]; c = [r['cer'] for r in res.values()]
print(f"SUMMARY {voice}: tracks {len(w)} mean WER {np.mean(w):.1%} mean CER {np.mean(c):.1%} worst WER {max(w):.1%}", flush=True)
