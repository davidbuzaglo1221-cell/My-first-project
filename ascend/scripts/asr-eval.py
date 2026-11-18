"""Intelligibility check: transcribe narration with a Hebrew Whisper model and compare to the script."""
import json, sys, re, jiwer, subprocess, numpy as np
def load(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768
from faster_whisper import WhisperModel
m = WhisperModel('ivrit-ai/whisper-large-v3-turbo-ct2', device='cpu', compute_type='int8', cpu_threads=4)
items = {i['id']: i for i in json.load(open('/home/user/tts/scripts_eval.json'))}
def clean(t):
    t = re.sub(r'[֑-ׇ]', '', t)          # strip niqqud
    t = re.sub(r'[^א-ת0-9 ]', ' ', t)    # letters only
    return re.sub(r'\s+', ' ', t).strip()
for path, iid in [a.split('=') for a in sys.argv[1:]]:
    segs, _ = m.transcribe(load(path), language='he', beam_size=5, vad_filter=True)
    hyp = clean(' '.join(s.text for s in segs))
    ref = clean(' '.join(' '.join(p) for p in items[iid]['paras']))
    print(f"{path.split('/')[-1]:40s} WER {jiwer.wer(ref, hyp):.1%}  CER {jiwer.cer(ref, hyp):.1%}", flush=True)
    open(path + '.txt', 'w').write(hyp)
