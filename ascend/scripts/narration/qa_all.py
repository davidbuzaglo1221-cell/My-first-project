"""Transcribe every rendered track of a voice and report word/character error rates."""
import json, sys, re, jiwer, subprocess, numpy as np
from faster_whisper import WhisperModel
voice = sys.argv[1]
m = WhisperModel('ivrit-ai/whisper-large-v3-turbo-ct2', device='cpu', compute_type='int8', cpu_threads=4)
items = json.load(open('/home/user/tts/scripts.json'))
clean = lambda t: re.sub(r'\s+', ' ', re.sub(r'[^א-ת ]', ' ', re.sub(r'[֑-ׇ]', '', t))).strip()
def load(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768
res = {}
for it in [i for i in items if i['id'].startswith(sys.argv[2])] if len(sys.argv) > 2 else items:
    path = f"/home/user/My-first-project/ascend/public/audio/{voice}/{it['id']}.mp3"
    segs, _ = m.transcribe(load(path), language='he', beam_size=3, vad_filter=True)
    hyp = clean(' '.join(s.text for s in segs)); ref = clean(' '.join(' '.join(p) for p in it['paras']))
    res[it['id']] = {'wer': round(jiwer.wer(ref, hyp), 3), 'cer': round(jiwer.cer(ref, hyp), 3), 'hyp': hyp}
    print(f"{it['id']:40s} WER {res[it['id']]['wer']:.1%} CER {res[it['id']]['cer']:.1%}", flush=True)
    json.dump(res, open(f'/home/user/tts/qa_{voice}{"_" + sys.argv[2] if len(sys.argv) > 2 else ""}.json', 'w'), ensure_ascii=False)
w = [r['wer'] for r in res.values()]; c = [r['cer'] for r in res.values()]
print(f"SUMMARY {voice}: tracks {len(w)} mean WER {np.mean(w):.1%} mean CER {np.mean(c):.1%} worst WER {max(w):.1%}", flush=True)
