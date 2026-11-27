"""Livelier intonation without re-recording: widen each sentence's pitch movement around its median (k) and lift
the median slightly (shift), with Praat PSOLA resynthesis. Chosen by a preference model trained on Hebrew listener votes."""
import parselmouth, numpy as np
from parselmouth.praat import call
PARAMS = {'maya': dict(k=1.4, shift=1.02, lo=100, hi=450), 'yoav': dict(k=1.4, shift=1.035, lo=70, hi=300)}

def liven(w, sr, voice):
    p = PARAMS[voice]
    snd = parselmouth.Sound(w.astype(np.float64), sampling_frequency=sr)
    try:
        man = call(snd, 'To Manipulation', 0.01, p['lo'], p['hi'])
        med = call(snd.to_pitch(time_step=0.01, pitch_floor=p['lo'], pitch_ceiling=p['hi']), 'Get quantile', 0, 0, 0.5, 'Hertz')
        if not med or med != med: return w
        pt = call(man, 'Extract pitch tier')
        call(pt, 'Formula', f"{med * p['shift']} * (self / {med}) ^ {p['k']}")
        call([pt, man], 'Replace pitch tier')
        out = call(man, 'Get resynthesis (overlap-add)')
        return out.values[0].astype(np.float32)[:len(w) + 200]
    except Exception:
        return w
