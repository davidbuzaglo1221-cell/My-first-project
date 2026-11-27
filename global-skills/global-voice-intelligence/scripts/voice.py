#!/usr/bin/env python3
"""GLOBAL VOICE INTELLIGENCE — one command for every spoken product.

  voice.py say "טקסט" -s podcast -o out.mp3 [-v blue:yael] [--lang he] [--raw]
  voice.py render script.json -o outdir/        # segments -> per-segment wav, voiceover.mp3, .srt, manifest.json
  voice.py voices                               # what is installed and free

Engines (all free, no key):
  blue   BlueTTS v3, local ONNX on CPU. Hebrew + en/de/es/it/ru/yi. MIT code+weights, voices CC BY 4.0.
  kokoro Kokoro-82M, local ONNX on CPU. English (+ es/fr/it/pt/ja/zh/hi). Apache-2.0. No Hebrew.
  edge   Microsoft neural voices through the Edge "read aloud" endpoint. Free, no key, but unofficial and
         can stop working without notice: never the only path for a product.
Script JSON: {"style": "podcast", "voice": "blue:yael", "lang": "he", "lexicon": "lex.json",
              "segments": [{"id": "01", "text": "...", "voice": "...", "style": "...", "pause": 0.6}]}
"""
import argparse, asyncio, hashlib, json, os, re, subprocess, sys, tempfile
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import textprep

HOME = os.environ.get('GVI_HOME', os.path.expanduser('~/.local/share/gvi'))
SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLES = json.load(open(os.path.join(SKILL, 'styles.json')))
CACHE = os.path.join(HOME, 'cache')
SR = 24000  # internal working rate; masters are written at 44.1 kHz

# ---------------------------------------------------------------- engines
_blue = {'tts': None, 'styles': {}}
def blue(text, voice, lang, speed):
    """One model in memory (~2 GB); voices are small style files swapped per call.
    (Loading one model per voice was OOM-killed at 7 voices on a 16 GB machine.)"""
    import blue_onnx
    vj = f'{HOME}/bluev3_onnx/voices/{voice}.json'
    if _blue['tts'] is None:
        _blue['tts'] = blue_onnx.BlueTTS(onnx_dir=f'{HOME}/bluev3_onnx/onnx', style_json=vj)
    if voice not in _blue['styles']:
        _blue['styles'][voice] = blue_onnx.load_voice_style([vj])
    w, sr = _blue['tts'].synthesize(text, lang=lang, speed=speed, style=_blue['styles'][voice])
    return np.asarray(w, np.float32).reshape(-1), sr

_kok = None
def kokoro(text, voice, lang, speed):
    global _kok
    from kokoro_onnx import Kokoro
    if _kok is None:
        _kok = Kokoro(f'{HOME}/models/kokoro/kokoro-v1.0.onnx', f'{HOME}/models/kokoro/voices-v1.0.bin')
    code = {'en': 'en-us' if voice[0] in 'ah' else 'en-gb'}.get(lang, lang)
    w, sr = _kok.create(text, voice=voice, speed=speed, lang=code)
    return np.asarray(w, np.float32), sr

def edge(text, voice, lang, speed, rate='+0%', pitch='+0Hz'):
    import edge_tts, edge_tts.communicate as ec
    for ca in (os.environ.get('SSL_CERT_FILE'), os.environ.get('REQUESTS_CA_BUNDLE'), '/root/.ccr/ca-bundle.crt'):
        if ca and os.path.exists(ca):   # behind an inspecting proxy (cloud sessions) trust its CA as well
            ec._SSL_CTX.load_verify_locations(ca); break
    proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    async def go():
        c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, proxy=proxy)
        return b''.join([ch['data'] async for ch in c.stream() if ch['type'] == 'audio'])
    data = b''
    for attempt in range(4):
        try:
            data = asyncio.run(go())
            if len(data) > max(600, len(text) * 100): break   # far shorter = a cut-off stream
        except Exception:
            pass
    if not data:
        raise RuntimeError('edge: no audio (endpoint unreachable?)')
    return decode(data), SR

ENGINES = {'blue': blue, 'kokoro': kokoro, 'edge': edge}

# ---------------------------------------------------------------- audio helpers
def decode(data_or_path):
    src = ['-i', data_or_path] if isinstance(data_or_path, str) else ['-i', 'pipe:0']
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', *src, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         input=None if isinstance(data_or_path, str) else data_or_path, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()

def resample(w, sr):
    if sr == SR: return w
    import librosa
    return librosa.resample(w, orig_sr=sr, target_sr=SR).astype(np.float32)

def trim(w, thr=0.006, pre=0.03, post=0.08):
    idx = np.where(np.abs(w) > thr)[0]
    if not len(idx): return w
    return w[max(0, idx[0] - int(pre * SR)): idx[-1] + int(post * SR)]

def liven(w, k, lift, lo=75, hi=420, target_med=None):
    """Widen pitch movement around the median (PSOLA). k=1 and lift=1 leave the audio untouched.
    target_med anchors this chunk's median pitch to the voice's running median (continuity across chunks)."""
    if abs(k - 1) < 1e-3 and abs(lift - 1) < 1e-3 and not target_med: return w
    try:
        import parselmouth
        from parselmouth.praat import call
        snd = parselmouth.Sound(w.astype(np.float64), sampling_frequency=SR)
        med = call(snd.to_pitch(time_step=0.01, pitch_floor=lo, pitch_ceiling=hi), 'Get quantile', 0, 0, 0.5, 'Hertz')
        if not med or med != med: return w
        man = call(snd, 'To Manipulation', 0.01, lo, hi)
        pt = call(man, 'Extract pitch tier')
        base = med if not target_med else float(np.clip(target_med, med * 0.92, med * 1.08))
        call(pt, 'Formula', f'{base * lift} * (self / {med}) ^ {k}')
        call([pt, man], 'Replace pitch tier')
        return call(man, 'Get resynthesis (overlap-add)').values[0].astype(np.float32)[:len(w) + 200]
    except Exception:
        return w

def chain(lufs):
    # clean low end, presence, air, gentle glue compression, de-harsh, broadcast loudness with true-peak ceiling
    return (f'highpass=f=70,equalizer=f=250:t=q:w=1.0:g=-1.5,equalizer=f=3200:t=q:w=1.1:g=2.0,highshelf=f=8000:g=2,'
            f'acompressor=threshold=-20dB:ratio=2.2:attack=8:release=160:makeup=2,'
            f'deesser=i=0.4,loudnorm=I={lufs}:TP=-1.5:LRA=9')

def write(w, path, lufs=-16, raw=False):
    os.makedirs(os.path.dirname(os.path.abspath(path)) or '.', exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.f32', delete=False) as f:
        f.write(w.astype(np.float32).tobytes()); tmp = f.name
    ext = os.path.splitext(path)[1].lower()
    codec = {'.mp3': ['-c:a', 'libmp3lame', '-b:a', '128k'], '.m4a': ['-c:a', 'aac', '-b:a', '128k'],
             '.wav': ['-c:a', 'pcm_s16le']}.get(ext, [])
    af = [] if raw else ['-af', chain(lufs)]
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', tmp,
                    *af, '-ar', '44100', *codec, path], check=True)
    os.remove(tmp)

# ---------------------------------------------------------------- synthesis
def parse_voice(v):
    eng, _, name = v.partition(':')
    if eng not in ENGINES: raise SystemExit(f'unknown engine {eng} (blue | kokoro | edge)')
    return eng, name

def pick_voice(style, lang, voice=None):
    if voice: return voice
    vs = STYLES[style]['voices']
    return (vs.get(lang) or vs['en'])[0]

TAKES = int(os.environ.get('GVI_TAKES', '3'))
WH = ('מה', 'למה', 'איפה', 'מתי', 'איך', 'מי', 'כמה', 'איזה', 'איזו', 'מאיפה', 'לאן', 'what', 'why', 'where', 'when', 'how', 'who', 'which')

def pitch_stats(w):
    """(p10-p90 range in semitones, end movement in semitones) of a mono 24 kHz chunk."""
    try:
        import parselmouth
        p = parselmouth.Sound(w.astype(np.float64), sampling_frequency=SR).to_pitch(time_step=0.01, pitch_floor=70, pitch_ceiling=450)
        f = p.selected_array['frequency']; t = p.xs(); t, f = t[f > 0], f[f > 0]
        if len(f) < 20: return 0.0, 0.0
        st = 12 * np.log2(f / np.median(f)); rng = float(np.percentile(st, 90) - np.percentile(st, 10))
        end = t[-1]; last = f[t > end - 0.45]; prev = f[(t <= end - 0.45) & (t > end - 1.05)]
        mv = float(12 * np.log2(np.median(last[-12:]) / np.median(prev))) if len(last) > 4 and len(prev) > 4 else 0.0
        return rng, mv
    except Exception:
        return 0.0, 0.0

def take_score(w, text, st):
    """Higher is better: pitch range near the style's target (before liven), yes/no questions must rise,
    statements should fall; punish clipping."""
    rng, mv = pitch_stats(w)
    target = st.get('target_range', 9.0) / max(st['k'], 0.5)
    score = -abs(rng - target)
    s = text.strip()
    if s.endswith('?'):
        clause = re.split(r'[:,;]', s)[-1].split() or s.split()   # the question is the last clause
        first = clause[0].lower() if clause else ''
        if not any(first == q or first == 'ו' + q for q in WH): score += 1.5 * min(mv, 6)   # yes/no question: reward the rise
    elif s.endswith('.'):
        score += 0.5 * min(-mv, 6)                                                          # statement: reward the fall
    if np.max(np.abs(w)) > 0.99: score -= 5
    return score

def synth_chunk(text, voice, lang, style):
    st = STYLES[style]
    eng, name = parse_voice(voice)
    h = hashlib.sha1(json.dumps([text, voice, lang, style, st, TAKES if voice.startswith('blue') else 1], ensure_ascii=False).encode()).hexdigest()
    cp = os.path.join(CACHE, h + '.f32')
    if os.path.exists(cp): return np.fromfile(cp, np.float32)
    if eng == 'edge':
        w, sr = edge(text, name, lang, 1.0, st['edge_rate'], st['edge_pitch'])
        w = trim(resample(w, sr))
    elif eng == 'blue' and TAKES > 1:
        # BlueTTS samples a new delivery on every call (flow matching): record several takes, keep the best one
        takes = [trim(resample(*ENGINES[eng](text, name, lang, st['speed']))) for _ in range(TAKES)]
        w = max(takes, key=lambda x: take_score(x, text, st))
    else:
        w, sr = ENGINES[eng](text, name, lang, st['speed'])
        w = trim(resample(w, sr))
    peak = float(np.max(np.abs(w))) if len(w) else 0
    if peak > 0.98: w = w * (0.9 / peak)   # never feed a clipped chunk into the master chain
    os.makedirs(CACHE, exist_ok=True); w.astype(np.float32).tofile(cp)
    return w

VOICE_MED = {}   # voice -> medians of every chunk rendered in this process (one product = one voice "line")
def chunk_median(w):
    try:
        import parselmouth
        f = parselmouth.Sound(w.astype(np.float64), sampling_frequency=SR).to_pitch(time_step=0.01, pitch_floor=70, pitch_ceiling=450).selected_array['frequency']
        f = f[f > 0]
        return float(np.median(f)) if len(f) > 10 else None
    except Exception:
        return None

def speak(text, style='podcast', voice=None, lang=None, lexicon=None):
    """Text -> (audio, chunk timings). Each breath chunk is synthesized on its own so timings are exact."""
    lang = lang or ('he' if textprep.is_hebrew(text) else 'en')
    voice = pick_voice(style, lang, voice)
    st = STYLES[style]
    paras = [p for p in text.split('\n\n') if p.strip()]
    out, t, cues = [], 0.0, []
    for pi, para in enumerate(paras):
        cs = textprep.chunks(textprep.prepare(para, lang, lexicon))
        for ci, c in enumerate(cs):
            w = synth_chunk(c, voice, lang, style)
            med = chunk_median(w)
            if med: VOICE_MED.setdefault(voice, []).append(med)
            ref = float(np.median(VOICE_MED[voice])) if VOICE_MED.get(voice) else None
            w = liven(w, st['k'], st['lift'], target_med=ref)
            cues.append({'start': round(t, 3), 'end': round(t + len(w) / SR, 3), 'text': c})
            out.append(w); t += len(w) / SR
            gap = st['para_gap'] if ci == len(cs) - 1 and pi < len(paras) - 1 else st['sent_gap']
            if not (pi == len(paras) - 1 and ci == len(cs) - 1):
                out.append(np.zeros(int(gap * SR), np.float32)); t += gap
    return (np.concatenate(out) if out else np.zeros(1, np.float32)), cues, voice, lang

def srt_time(s):
    h, r = divmod(s, 3600); m, r = divmod(r, 60)
    return f'{int(h):02}:{int(m):02}:{int(r):02},{int(round((r % 1) * 1000)) % 1000:03}'

def write_srt(cues, path):
    with open(path, 'w', encoding='utf-8') as f:
        for i, c in enumerate(cues, 1):
            f.write(f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}\n\n")

def render(script_path, outdir, fmt='mp3'):
    s = json.load(open(script_path, encoding='utf-8'))
    style = s.get('style', 'podcast'); lex = textprep.load_lexicon(s.get('lexicon'))
    os.makedirs(outdir, exist_ok=True)
    allw, cues, t, segs = [], [], 0.0, []
    for i, seg in enumerate(s['segments']):
        sst = seg.get('style', style)
        w, c, voice, lang = speak(seg['text'], sst, seg.get('voice', s.get('voice')), seg.get('lang', s.get('lang')), lex)
        write(w, f"{outdir}/{seg['id']}.wav", STYLES[sst]['lufs'])
        segs.append({'id': seg['id'], 'file': f"{seg['id']}.wav", 'start': round(t, 3), 'duration': round(len(w) / SR, 3),
                     'end': round(t + len(w) / SR, 3), 'voice': voice, 'style': sst, 'lang': lang, 'text': seg['text']})
        cues += [{**x, 'start': round(x['start'] + t, 3), 'end': round(x['end'] + t, 3)} for x in c]
        allw.append(w); t += len(w) / SR
        if i < len(s['segments']) - 1:
            pause = seg.get('pause', STYLES[sst]['para_gap']); allw.append(np.zeros(int(pause * SR), np.float32)); t += pause
    write(np.concatenate(allw), f'{outdir}/voiceover.{fmt}', STYLES[style]['lufs'])
    write_srt(cues, f'{outdir}/voiceover.srt')
    man = {'style': style, 'duration': round(t, 3), 'segments': segs, 'cues': cues}
    json.dump(man, open(f'{outdir}/manifest.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps({'out': outdir, 'duration': round(t, 2), 'segments': len(segs)}, ensure_ascii=False))

def voices():
    print('blue  (he/en/de/es/it/ru/yi):', ' '.join(sorted(f[:-5] for f in os.listdir(f'{HOME}/bluev3_onnx/voices'))) if os.path.isdir(f'{HOME}/bluev3_onnx/voices') else 'blue: not installed (run setup.sh)')
    print('kokoro (en):', 'af_heart af_bella bf_emma am_michael am_puck am_fenrir bm_george ...' if os.path.exists(f'{HOME}/models/kokoro/voices-v1.0.bin') else 'not installed')
    print('edge  (online, unofficial): he-IL-AvriNeural he-IL-HilaNeural en-US-*MultilingualNeural ...')
    print('styles:', ' '.join(k for k in STYLES if not k.startswith('_')))

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    a = sub.add_parser('say'); a.add_argument('text'); a.add_argument('-o', '--out', required=True)
    a.add_argument('-s', '--style', default='podcast'); a.add_argument('-v', '--voice'); a.add_argument('--lang')
    a.add_argument('--raw', action='store_true', help='skip mastering'); a.add_argument('--srt', action='store_true')
    a.add_argument('--lexicon')
    r = sub.add_parser('render'); r.add_argument('script'); r.add_argument('-o', '--out', required=True); r.add_argument('--format', default='mp3')
    sub.add_parser('voices')
    x = ap.parse_args()
    if x.cmd == 'say':
        text = open(x.text[1:], encoding='utf-8').read() if x.text.startswith('@') else x.text
        w, cues, voice, lang = speak(text, x.style, x.voice, x.lang, textprep.load_lexicon(x.lexicon))
        write(w, x.out, STYLES[x.style]['lufs'], x.raw)
        if x.srt: write_srt(cues, os.path.splitext(x.out)[0] + '.srt')
        print(json.dumps({'out': x.out, 'voice': voice, 'lang': lang, 'seconds': round(len(w) / SR, 2), 'chunks': len(cues)}, ensure_ascii=False))
    elif x.cmd == 'render':
        render(x.script, x.out, x.format)
    else:
        voices()
