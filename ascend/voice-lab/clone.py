"""Voice-cloning lab: F5-TTS Hebrew v2 (Apache-2.0) cloning the reference voices, scored by Hebrew ASR.
Runs on a GitHub Actions CPU runner. Writes out/<voice>-<n>.mp3 and out/report.json."""
import json, os, re, subprocess, time, sys
import numpy as np, soundfile as sf, torch
from importlib.resources import files
from omegaconf import OmegaConf
from huggingface_hub import hf_hub_download
from f5_tts.model import DiT
from f5_tts.infer.utils_infer import load_model, load_vocoder, infer_process
from phonikud_onnx import Phonikud

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
REF_TEXT = 'שלום, אני דוד, וזה המסע שלי. כל הרגל גדול מתחיל בצעד קטן, כמעט מגוחך. שתי דקות ביום, עמוד אחד, נשימה אחת עמוקה.'
TESTS = [
  'אנחנו לא עולים לרמת המטרות שלנו. אנחנו יורדים לרמת המערכות שלנו.',
  'כל פעולה שאתה עושה היא הצבעה בעד האדם שאתה רוצה להיות.',
  'כשאתה מרגיש את הדחף, עצור לרגע, נשום עמוק, ושאל את עצמך מה באמת חשוב לך עכשיו.',
  'הכסף לא נועד להרשים אנשים אחרים. הוא נועד לקנות לך זמן, שקט וחופש.',
]
ckpt = hf_hub_download('Yzamari/f5tts-hebrew-v2', 'model.safetensors')
vocab = hf_hub_download('Yzamari/f5tts-hebrew-v2', 'vocab.txt')
pk = Phonikud(hf_hub_download('Phonikud/phonikud-onnx', 'phonikud-1.0.int8.onnx'))
allowed = set(open(vocab, encoding='utf-8').read().split('\n')) | {' '}
def vocalize(t):
    v = pk.add_diacritics(t)
    return ''.join(c for c in v if c in allowed)
cfg = OmegaConf.load(str(files('f5_tts').joinpath('configs/F5TTS_v1_Base.yaml')))
model = load_model(DiT, OmegaConf.to_container(cfg.model.arch), ckpt, mel_spec_type='vocos', vocab_file=vocab, use_ema=False, device='cpu')
voc = load_vocoder('vocos', device='cpu')
torch.set_num_threads(os.cpu_count())
report = {'ref_text_vocalized': vocalize(REF_TEXT), 'items': []}
for voice in ['danit', 'itamar']:
    ref = os.path.join(HERE, f'ref-{voice}.wav')
    for i, t in enumerate(TESTS):
        gen = vocalize(t); t0 = time.time()
        wav, sr, _ = infer_process(ref, report['ref_text_vocalized'], gen, model, voc, mel_spec_type='vocos', nfe_step=32, speed=1.0, device='cpu')
        dt = time.time() - t0
        base = os.path.join(OUT, f'{voice}-{i}')
        sf.write(base + '.wav', wav, sr)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', base + '.wav', '-b:a', '96k', base + '.mp3'], check=True)
        report['items'].append({'voice': voice, 'i': i, 'text': t, 'vocalized': gen, 'seconds': round(len(wav) / sr, 2), 'compute': round(dt, 1)})
        print(voice, i, round(len(wav) / sr, 1), 's audio in', round(dt, 1), 's', flush=True)
# score with Hebrew ASR
from faster_whisper import WhisperModel
asr = WhisperModel('ivrit-ai/whisper-large-v3-turbo-ct2', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r'[^א-ת ]', '', re.sub(r'[֑-ׇ]', '', s)).split()
def wer(a, b):
    a, b = norm(a), norm(b); d = list(range(len(b) + 1))
    for x in a:
        p, d[0] = d[0], d[0] + 1
        for j, y in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (x != y))
    return d[-1] / max(1, len(a))
for it in report['items']:
    a, _ = sf.read(os.path.join(OUT, f"{it['voice']}-{it['i']}.wav"))
    import librosa; a16 = librosa.resample(a.astype(np.float32), orig_sr=24000, target_sr=16000)
    segs, _ = asr.transcribe(a16, language='he')
    it['heard'] = ' '.join(s.text.strip() for s in segs); it['wer'] = round(wer(it['text'], it['heard']), 3)
    os.remove(os.path.join(OUT, f"{it['voice']}-{it['i']}.wav"))
for v in ['danit', 'itamar']:
    xs = [x for x in report['items'] if x['voice'] == v]
    report[v] = {'wer': round(sum(x['wer'] for x in xs) / len(xs), 3), 'rtf': round(sum(x['compute'] for x in xs) / sum(x['seconds'] for x in xs), 2)}
json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps({k: report[k] for k in ['danit', 'itamar']}))
