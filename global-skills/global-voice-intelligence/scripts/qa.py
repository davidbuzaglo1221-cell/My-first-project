#!/usr/bin/env python3
"""Voice QA — measure, never guess. "Listening" by proxy: speech recognition, pitch tracking and level meters.

  qa.py suite  -v blue:yael [-v edge:he-IL-AvriNeural ...] -o reportdir   # the permanent test suite
  qa.py file   audio.mp3 --text "the script" [--lang he] [--srt audio.srt]  # check any delivered file

Checks per file
  intelligibility  CER/WER of an ASR transcript against the script (Hebrew: ivrit-ai whisper turbo; English: whisper small.en)
  truncation       last scripted word heard + duration vs. expected chars/s
  intonation       pitch range (semitones, p10-p90), end-of-utterance movement (question must rise / statement fall)
  pace             characters per second
  sync             every SRT cue starts within 0.12 s of voiced audio and the gap before it is quiet
  continuity       across chunks: loudness spread and median-pitch spread (voice drift)
Pass bars (tuned on measured Hebrew samples, see ../references/qa.md): CER <= 8 %, range >= 4 st, sync 100 %.
"""
import argparse, json, os, re, subprocess, sys, datetime
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import textprep

HOME = os.environ.get('GVI_HOME', os.path.expanduser('~/.local/share/gvi'))
SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 16000
_asr = {}

ONES = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע']
def he_num(n):
    n = int(n)
    if n == 0: return 'אפס'
    parts = []
    th, n = divmod(n, 1000)
    if th: parts.append({1: 'אלף', 2: 'אלפיים'}.get(th, he_num(th) + ' אלפים'))
    h, n = divmod(n, 100)
    if h: parts.append({1: 'מאה', 2: 'מאתיים'}.get(h, ONES[h] + ' מאות'))
    if n:
        if n < 10: parts.append(ONES[n])
        elif n == 10: parts.append('עשר')
        elif n < 20: parts.append(ONES[n - 10] + ' עשרה')
        else:
            t, o = divmod(n, 10)
            parts.append(['', '', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'][t] + (' ו' + ONES[o] if o else ''))
    return ' '.join(parts)

FINALS = str.maketrans('ךםןףץ', 'כמנפצ')
def clean(t, lang):
    t = re.sub(r'[֑-ׇ]', '', t)
    if lang == 'he':
        t = t.replace('%', ' אחוז ')
        t = re.sub(r'\d+', lambda m: ' ' + he_num(m.group()) + ' ', t)
        t = re.sub(r'(?<=[ א-ת])[יו](?=[א-ת])', '', t)   # spelling-insensitive: drop internal matres
        t = re.sub(r'[^א-ת a-zA-Z]', ' ', t).translate(FINALS).lower()   # "GPT" == "gpt"
    else:
        t = t.lower()
        t = re.sub(r'\$(\d+)', r'\1 dollars', t).replace('%', ' percent ')
        t = re.sub(r'\b([ap])\.? ?m\b\.?', r'\1m', t)
        t = re.sub(r'(\d)[.:](\d\d)\b', r'\1 \2', t)
        try:
            from num2words import num2words
            t = re.sub(r'\d+', lambda m: ' ' + num2words(int(m.group())) + ' ', t)
        except Exception:
            pass
        t = re.sub(r'[^a-z\' ]', ' ', t.replace('-', ' '))
    return re.sub(r'\s+', ' ', t).strip()

def load(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()

def asr(w, lang):
    from faster_whisper import WhisperModel
    key = 'he' if lang == 'he' else 'en'
    if key not in _asr:
        path = f'{HOME}/models/ivrit-turbo' if key == 'he' else f'{HOME}/models/whisper-small-en'
        _asr[key] = WhisperModel(path, device='cpu', compute_type='int8', cpu_threads=os.cpu_count() or 4)
    segs, _ = _asr[key].transcribe(w, language=key, beam_size=3, vad_filter=False, condition_on_previous_text=False)
    return ' '.join(s.text for s in segs).strip()

def pitch(w):
    import parselmouth
    snd = parselmouth.Sound(w.astype(np.float64), sampling_frequency=SR)
    p = snd.to_pitch(time_step=0.01, pitch_floor=70, pitch_ceiling=450)
    f = p.selected_array['frequency']; t = p.xs()
    return t[f > 0], f[f > 0]

def semitones(f, ref):
    return 12 * np.log2(f / ref)

def ending(t, f):
    """Pitch movement over the last voiced 0.45 s vs. the 0.6 s before it, in semitones."""
    if len(f) < 20: return 0.0
    end = t[-1]; last = f[t > end - 0.45]; prev = f[(t <= end - 0.45) & (t > end - 1.05)]
    if len(last) < 5 or len(prev) < 5: return 0.0
    return float(semitones(np.median(last[-12:]), np.median(prev)))

def rms_db(x):
    return float(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9))

def voiced_mask(w, win=0.02, thr_db=-38):
    n = int(win * SR); frames = len(w) // n
    e = np.array([rms_db(w[i * n:(i + 1) * n]) for i in range(frames)])
    return e > max(thr_db, e.max() - 35), n

def parse_srt(path):
    cues = []
    for block in open(path, encoding='utf-8').read().strip().split('\n\n'):
        lines = block.split('\n')
        if len(lines) < 3: continue
        a, b = lines[1].split(' --> ')
        ts = lambda s: (lambda h, m, r: int(h) * 3600 + int(m) * 60 + float(r.replace(',', '.')))(*s.split(':'))
        cues.append({'start': ts(a), 'end': ts(b), 'text': ' '.join(lines[2:])})
    return cues

def sync_check(w, cues):
    mask, n = voiced_mask(w)
    ok = 0; worst = 0.0
    for c in cues:
        i0 = int(c['start'] * SR / n)
        on = next((j for j in range(max(0, i0 - 10), min(len(mask), i0 + 40)) if mask[j]), None)
        err = abs((on * n / SR) - c['start']) if on is not None else 9.9
        worst = max(worst, err); ok += err <= 0.12
    return {'cues': len(cues), 'in_sync': ok, 'worst_offset_s': round(worst, 3)}

def check(path, text, lang=None, srt=None, refs=None, must=None):
    """refs: optional spoken-form references (how a native would transcribe correct speech: "14:30" said as
    "שתיים וחצי", "Google Drive" written "גוגל דרייב"). The best-matching reference counts.
    CER ignores spaces (ASR splits/joins words like "טיק טוק" freely)."""
    lang = lang or ('he' if textprep.is_hebrew(text) else 'en')
    w = load(path); dur = len(w) / SR
    hyp = asr(w, lang)
    import jiwer
    h = clean(hyp, lang); best = None
    for cand in [textprep.prepare(text, lang)] + list(refs or []):
        ref_c = clean(cand, lang)
        c = jiwer.cer(ref_c.replace(' ', ''), h.replace(' ', '')) if ref_c else 1.0
        if best is None or c < best[0]: best = (c, ref_c)
    cer, ref = best; wer = jiwer.wer(ref, h) if ref else 1.0
    last = ref.split()[-1] if ref else ''
    t, f = pitch(w)
    rng = float(np.percentile(semitones(f, np.median(f)), 90) - np.percentile(semitones(f, np.median(f)), 10)) if len(f) > 20 else 0.0
    r = {'file': os.path.basename(path), 'lang': lang, 'seconds': round(dur, 2), 'cer': round(cer, 3), 'wer': round(wer, 3),
         'last_word_heard': bool(last) and last in h.split()[-4:], 'chars_per_s': round(len(ref.replace(' ', '')) / max(dur, 0.1), 1),
         'pitch_median_hz': round(float(np.median(f)), 1) if len(f) else 0, 'pitch_range_st': round(rng, 1),
         'end_move_st': round(ending(t, f), 1), 'transcript': hyp}
    if must:
        r['must_hear_ok'] = all(clean(m, lang) in h for m in must)
    if srt and os.path.exists(srt):
        r['sync'] = sync_check(w, parse_srt(srt))
    return r

def continuity(w, cues):
    lv, med = [], []
    for c in cues:
        seg = w[int(c['start'] * SR): int(c['end'] * SR)]
        if len(seg) < SR * 0.3: continue
        mask, n = voiced_mask(seg)
        v = np.concatenate([seg[i * n:(i + 1) * n] for i in np.where(mask)[0]]) if mask.any() else seg
        lv.append(rms_db(v)); _, f = pitch(seg)
        if len(f) > 10: med.append(np.median(f))
    med = np.array(med)
    return {'chunks': len(lv), 'loudness_spread_db': round(float(np.std(lv)), 2),
            'pitch_drift_pct': round(float(np.std(med) / np.mean(med) * 100), 1) if len(med) else 0}

def suite(voices, outdir, only=None):
    import voice as V
    S = json.load(open(f'{SKILL}/tests/suite.json', encoding='utf-8'))
    os.makedirs(outdir, exist_ok=True)
    results = {}
    for vv in voices:
        eng_lang = 'he' if vv.startswith('edge:he') else None
        rs = []
        for tst in S['tests']:
            if only and tst['cat'] not in only: continue
            if vv.startswith('kokoro') and tst['lang'] == 'he': continue
            if vv.startswith('edge:he') and tst['lang'] == 'en': continue
            style = tst.get('style', 'conversational')
            name = f"{vv.replace(':', '_')}__{tst['id']}"
            mp3 = f'{outdir}/{name}.mp3'
            w, cues, _, _ = V.speak(tst['text'], style, vv, tst['lang'])
            V.write(w, mp3, V.STYLES[style]['lufs']); V.write_srt(cues, mp3[:-4] + '.srt')
            r = check(mp3, tst['text'], tst['lang'], mp3[:-4] + '.srt', tst.get('refs'), tst.get('must_hear')); r.update(id=tst['id'], cat=tst['cat'], style=style)
            if 'expect' in tst:
                r['intonation_ok'] = (r['end_move_st'] > 0.5) if tst['expect'] == 'rise' else (r['end_move_st'] < 0)
            rs.append(r); print(vv, tst['id'], 'CER', r['cer'], 'range', r['pitch_range_st'], 'end', r['end_move_st'], flush=True)
        if vv.startswith('blue:') or vv.startswith('edge:he-IL'):
            c = S['continuity']
            w, cues, _, _ = V.speak(c['text'], 'audiobook', vv, c['lang'])
            mp3 = f"{outdir}/{vv.replace(':', '_')}__continuity.mp3"; V.write(w, mp3, -19); V.write_srt(cues, mp3[:-4] + '.srt')
            ww = load(mp3); cc = parse_srt(mp3[:-4] + '.srt')
            rs.append({'id': 'continuity', 'cat': 'continuity', **continuity(ww, cc), 'sync': sync_check(ww, cc)})
        results[vv] = rs
    json.dump(results, open(f'{outdir}/report.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    summary(results, f'{outdir}/report.md')
    return results

def summary(results, path):
    rows = ['| voice | he CER | en CER | numbers CER | foreign CER | long CER | pitch range st | question rises | statement falls | sync | continuity loud/drift |', '|' + '---|' * 11]
    for v, rs in results.items():
        g = lambda cat, lang=None: [r['cer'] for r in rs if r.get('cat') == cat and (lang is None or r.get('lang') == lang)]
        m = lambda xs: f'{np.mean(xs):.1%}' if xs else '—'
        he = [r['cer'] for r in rs if r.get('lang') == 'he' and 'cer' in r]; en = [r['cer'] for r in rs if r.get('lang') == 'en' and 'cer' in r]
        q = [r for r in rs if r.get('intonation_ok') is not None]
        qr = [r['intonation_ok'] for r in q if r['id'].endswith('question')]; qf = [r['intonation_ok'] for r in q if r['id'].endswith('statement')]
        rng = [r['pitch_range_st'] for r in rs if 'pitch_range_st' in r]
        sy = [r['sync'] for r in rs if 'sync' in r]
        syt = f"{sum(s['in_sync'] for s in sy)}/{sum(s['cues'] for s in sy)}" if sy else '—'
        co = next((r for r in rs if r.get('id') == 'continuity'), None)
        cot = f"{co['loudness_spread_db']} dB / {co['pitch_drift_pct']}%" if co else '—'
        yn = lambda xs: ('yes' if all(xs) else 'NO') if xs else '—'
        rows.append(f"| {v} | {m(he)} | {m(en)} | {m(g('numbers'))} | {m(g('foreign'))} | {m(g('long'))} | {np.mean(rng):.1f} | {yn(qr)} | {yn(qf)} | {syt} | {cot} |")
    emo = {}
    for v, rs in results.items():
        e = [r for r in rs if r.get('cat') == 'emotion']
        if e: emo[v] = ', '.join(f"{r['style']}: {r['pitch_range_st']} st, {r['chars_per_s']} ch/s" for r in e)
    txt = f"# Voice QA report — {datetime.date.today()}\n\n" + '\n'.join(rows) + '\n\n## Emotion (same line, three styles: must differ)\n' + \
          '\n'.join(f'- {v}: {e}' for v, e in emo.items()) + '\n'
    open(path, 'w', encoding='utf-8').write(txt); print(txt)

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('suite'); s.add_argument('-v', '--voice', action='append', required=True); s.add_argument('-o', '--out', required=True)
    s.add_argument('--only', nargs='*')
    f = sub.add_parser('file'); f.add_argument('audio'); f.add_argument('--text', required=True); f.add_argument('--lang'); f.add_argument('--srt')
    x = ap.parse_args()
    if x.cmd == 'suite': suite(x.voice, x.out, x.only)
    else:
        text = open(x.text[1:], encoding='utf-8').read() if x.text.startswith('@') else x.text
        print(json.dumps(check(x.audio, text, x.lang, x.srt), ensure_ascii=False, indent=1))
