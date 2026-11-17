"""Narration QA: "listen" to every narrated chunk with a Hebrew speech-recognition model
(ivrit-ai Whisper large-v3-turbo) and compare what is heard against the script.

Usage: python3 qa.py ASR_MODEL_DIR AUDIO.wav TIMELINE.json [--max-wer 0.15]
Exit code 1 if any chunk fails, so a bad narration can never ship silently.
"""
import json, re, sys
import numpy as np, soundfile as sf
from faster_whisper import WhisperModel
import jiwer

NUMS = {'אחת עשרה': '11', 'שתים עשרה': '12', 'שתיים עשרה': '12', 'שלוש עשרה': '13', 'ארבע עשרה': '14',
        'חמש עשרה': '15', 'שש עשרה': '16', 'שבע עשרה': '17', 'שמונה עשרה': '18', 'תשע עשרה': '19',
        'עשרים': '20', 'אחד': '1', 'שתיים': '2', 'שלוש': '3', 'ארבע': '4', 'חמש': '5', 'שש': '6',
        'שבע': '7', 'שמונה': '8', 'תשע': '9', 'עשר': '10'}

def norm(s):
    s = re.sub(r'[֑-ׇ]', '', s)            # strip nikud / cantillation
    s = re.sub(r'[^א-ת0-9 ]', ' ', s)       # drop punctuation
    s = ' ' + re.sub(r'\s+', ' ', s).strip() + ' '
    for k in sorted(NUMS, key=len, reverse=True):     # spoken numbers == digits (the recogniser writes digits)
        s = s.replace(' ' + k + ' ', ' ' + NUMS[k] + ' ')
    # Hebrew spelling is flexible about the vowel letters vav/yod (טיקטוק/טקטוק): compare consonant skeletons
    s = ' '.join(w if w.isdigit() or len(w) < 2 else w[0] + re.sub('[וי]', '', w[1:]) for w in s.split())
    s = s.replace('ך', 'כ').replace('ם', 'מ').replace('ן', 'נ').replace('ף', 'פ').replace('ץ', 'צ')
    return re.sub(r'\s+', ' ', s).strip()

def main():
    model_dir, audio_path, tl_path = sys.argv[1:4]
    max_wer = float(sys.argv[sys.argv.index('--max-wer') + 1]) if '--max-wer' in sys.argv else 0.15
    model = WhisperModel(model_dir, device='cpu', compute_type='int8', cpu_threads=4)
    audio, sr = sf.read(audio_path, dtype='float32')
    if audio.ndim > 1: audio = audio.mean(1)
    if sr != 16000:
        idx = np.arange(0, len(audio), sr / 16000); audio = np.interp(idx, np.arange(len(audio)), audio).astype(np.float32)
    tl = json.load(open(tl_path))
    rows, fails, tot_ref, tot_err = [], 0, 0, 0
    for seg in tl['segments']:
        # one check per segment (the sentences of a tip/hook/cta together), so context helps the recogniser
        a, b = seg['chunks'][0]['start'], seg['chunks'][-1]['end']
        clip = audio[int(max(0, a - 0.1) * 16000): int((b + 0.15) * 16000)]
        segs, _ = model.transcribe(clip, language='he', beam_size=5, vad_filter=False, condition_on_previous_text=False)
        heard = ' '.join(s.text for s in segs)
        ref = ' '.join(c['text'] for c in seg['chunks'])
        r, h = norm(ref), norm(heard)
        m = jiwer.process_words(r, h)
        wer = m.wer; n = len(r.split())
        tot_ref += n; tot_err += m.substitutions + m.deletions + m.insertions
        ok = wer <= max_wer
        fails += (not ok)
        name = seg['kind'] if seg['kind'] != 'tip' else f"tip {seg['index']}"
        rows.append((ok, name, wer, ref, heard))
    for ok, name, wer, ref, heard in rows:
        print(f"{'PASS' if ok else 'FAIL'}  {name:7s}  WER {wer:5.1%}")
        if wer > 0:
            print(f"        script: {ref}\n        heard : {heard.strip()}")
    total = tot_err / max(1, tot_ref)
    print(f"\nOVERALL WER {total:.1%}  |  {len(rows) - fails}/{len(rows)} segments pass (threshold {max_wer:.0%})")
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
