"""Stage 1: synthesize Hebrew narration (Meta MMS-TTS heb) chunk by chunk and build a timeline."""
import json, re, sys, numpy as np, torch, soundfile as sf
from transformers import VitsModel, AutoTokenizer
MODEL = sys.argv[1]
m = VitsModel.from_pretrained(MODEL); tok = AutoTokenizer.from_pretrained(MODEL)
SR = m.config.sampling_rate
m.noise_scale = 0.55; m.noise_scale_duration = 0.6; m.speaking_rate = 1.08
S = json.load(open('script.json'))

def synth(text, seed):
    clean = re.sub(r"[^א-ת \-']", " ", text); clean = re.sub(r"\s+", " ", clean).strip()
    torch.manual_seed(seed)
    with torch.no_grad():
        w = m(**tok(clean, return_tensors='pt')).waveform[0].numpy()
    # trim leading/trailing silence
    a = np.abs(w); thr = 0.02 * a.max(); idx = np.where(a > thr)[0]
    w = w[max(0, idx[0]-int(.02*SR)): idx[-1]+int(.05*SR)]
    return w

segments = []   # list of dicts: kind, index, chunks[{text,start,end}], start, end
audio = []; t = 0.0; seed = 7
def add_silence(sec):
    global t; audio.append(np.zeros(int(sec*SR), np.float32)); t += sec

def do_segment(kind, idx, says, gaps, lead=0.0):
    global t, seed
    add_silence(lead); seg = {"kind": kind, "index": idx, "start": t, "chunks": []}
    for i, s in enumerate(says):
        w = synth(s, seed); seed += 1
        seg["chunks"].append({"text": s, "start": t, "end": t + len(w)/SR})
        audio.append(w.astype(np.float32)); t += len(w)/SR
        add_silence(gaps[i])
    seg["end"] = t; segments.append(seg)

do_segment("hook", 0, S["hook"]["say"], [0.35, 0.3, 0.55], lead=0.35)
for n, tip in enumerate(S["tips"], 1):
    do_segment("tip", n, tip["say"], [0.12, 0.22, 0.42], lead=0.18)
do_segment("cta", 0, S["cta"]["say"], [0.2, 0.2, 1.6], lead=0.2)

wav = np.concatenate(audio); sf.write('build/voice_raw.wav', wav, SR)
json.dump({"duration": t, "segments": segments}, open('build/timeline.json', 'w'), ensure_ascii=False, indent=1)
print("duration", round(t, 2))
