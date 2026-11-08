"""Original score + sound design for "מסעו של השומן" (75 s), rendered offline.

Every cue is placed on the same timeline the animation uses, so the browser
only has to keep audio.currentTime == story time.

usage: python3 build_score.py OUT.wav
env FJ_TIMING='[10,13,11,15,14,12]'  actual scene lengths (cues are stretched to fit)
env FJ_NARR=dir                     optional scene_1.wav..scene_6.wav, mixed in with ducking
"""
import json
import os
import sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
SPEC = [10, 13, 11, 15, 14, 12]
TIMING = json.loads(os.environ.get('FJ_TIMING') or 'null') or SPEC
S0 = np.concatenate([[0], np.cumsum(SPEC)])
A0 = np.concatenate([[0], np.cumsum(TIMING)])


def M(t):
    """Map a time on the 75 s design timeline to the real timeline."""
    i = int(np.clip(np.searchsorted(S0, t, side='right') - 1, 0, 5))
    return A0[i] + (t - S0[i]) * TIMING[i] / SPEC[i]


DUR = float(A0[-1]) + 1.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N)
R = np.zeros(N)


def note(n):  # MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def place(sig, t, pan=0.0, gain=1.0):
    """Add mono or (2,n) signal at time t with equal-power pan."""
    i = int(M(t) * SR)
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sl, sr = sig * np.cos(a), sig * np.sin(a)
    else:
        sl, sr = sig[0], sig[1]
    n = min(len(sl), N - i)
    if n <= 0:
        return
    L[i:i + n] += sl[:n] * gain
    R[i:i + n] += sr[:n] * gain


def env_adsr(n, a, r, sus_curve=None):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    if nr:
        e[-nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return e


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc / (SR / 2), 'low', output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc / (SR / 2), 'high', output='sos'), x)


def bp(x, f1, f2, order=2):
    return sosfilt(butter(order, [f1 / (SR / 2), f2 / (SR / 2)], 'band', output='sos'), x)


def tvlp(x, fc):
    """Time-varying one-pole low-pass (fc is an array)."""
    a = np.exp(-2 * np.pi * np.clip(fc, 20, SR / 2.2) / SR)
    y = np.empty_like(x)
    s = 0.0
    for i in range(len(x)):  # short signals only
        s = (1 - a[i]) * x[i] + a[i] * s
        y[i] = s
    return y


# ---------------------------------------------------------------- pad voice
def pad(midis, t0, t1, amp=0.06, att=2.5, rel=3.0, bright=900, shimmer=0.0):
    n = int((M(t1) - M(t0)) * SR)
    t = np.arange(n) / SR
    l = np.zeros(n)
    r = np.zeros(n)
    for k, m in enumerate(midis):
        f = note(m)
        for j, cents in enumerate((-7, 0, 6)):
            ff = f * 2 ** (cents / 1200)
            ph = rng.uniform(0, 2 * np.pi)
            lfo = 1 + 0.003 * np.sin(2 * np.pi * (0.13 + 0.05 * j) * t + k)
            s = np.zeros(n)
            for hmul, hamp in ((1, 1.0), (2, 0.35), (3, 0.18), (4, 0.08), (5, 0.05)):
                s += hamp * np.sin(2 * np.pi * ff * hmul * t * lfo + ph * hmul)
            w = (j - 1) * 0.6
            l += s * (0.5 - 0.3 * w)
            r += s * (0.5 + 0.3 * w)
    trem = 0.85 + 0.15 * np.sin(2 * np.pi * 0.09 * t)
    e = env_adsr(n, att, rel) * trem / max(1, len(midis))
    l, r = lp(l * e, bright), lp(r * e, bright)
    if shimmer:
        sh = np.zeros(n)
        for m in midis:
            sh += np.sin(2 * np.pi * note(m + 24) * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.31 * t + m))
        sh = sh * e * shimmer / len(midis)
        l += sh * 0.8
        r += sh
    place(np.vstack([l, r]), t0, gain=amp)


def sub(m, t0, t1, amp=0.10, att=2, rel=2):
    n = int((M(t1) - M(t0)) * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * note(m) * t) + 0.25 * np.sin(2 * np.pi * note(m) * 2 * t)
    place(s * env_adsr(n, att, rel), t0, gain=amp)


# ---------------------------------------------------------------- sfx
def heartbeat(t, amp=0.5):
    for dt, g in ((0, 1.0), (0.17, 0.62)):
        n = int(0.22 * SR)
        tt = np.arange(n) / SR
        f = 58 * np.exp(-tt * 6) + 34
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 22)
        s += lp(rng.standard_normal(n), 180) * np.exp(-tt * 40) * 0.6
        place(s, t + dt, gain=amp * g)


def whoosh(t, dur=1.6, amp=0.22, *_a, **_k):
    return _whoosh(t, dur, amp * 0.75, *_a, **_k)


def _whoosh(t, dur=1.6, amp=0.22, f0=300, f1=5000, pan_from=-0.6, pan_to=0.6):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    k = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** (np.sin(k * np.pi / 2))
    y = tvlp(tvlp(x, fc), fc * 1.4) - tvlp(x, fc * 0.2)
    y = lp(y, 7000, 4)
    e = np.sin(np.pi * k) ** 2.2
    y *= e
    pan = pan_from + (pan_to - pan_from) * k
    a = (pan + 1) * np.pi / 4
    place(np.vstack([y * np.cos(a), y * np.sin(a)]), t, gain=amp)


def riser(t, dur, amp=0.12, f0=200, f1=2400):
    n = int(dur * SR)
    k = np.linspace(0, 1, n)
    x = rng.standard_normal(n)
    y = lp(tvlp(tvlp(x, f0 * (f1 / f0) ** k), f0 * 1.5 * (f1 / f0) ** k), 6000, 4) * k ** 2
    f = f0 * 0.5 * (f1 / f0) ** (k * 0.5)
    y += 0.25 * np.sin(2 * np.pi * np.cumsum(f) / SR) * k ** 3
    place(y, t, gain=amp)


def bell(t, m, amp=0.12, dec=2.2, pan=0.0):
    n = int(dec * 1.6 * SR)
    tt = np.arange(n) / SR
    f = note(m)
    s = sum(a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt * d / dec)
            for r, a, d in ((1, 1, 1.0), (2.01, .45, 1.6), (2.76, .3, 2.2), (5.4, .12, 3.5), (8.9, .05, 5)))
    s *= np.minimum(1, tt / 0.004)
    place(s, t, pan, amp)


def pluck(t, m, amp=0.09, dec=0.7, pan=0.0):
    n = int(dec * 2 * SR)
    tt = np.arange(n) / SR
    f = note(m)
    s = sum(np.sin(2 * np.pi * f * h * tt) * np.exp(-tt * (3 + h * 2.5) / dec) / h for h in range(1, 7))
    s *= np.minimum(1, tt / 0.003)
    place(lp(s, 3500), t, pan, amp)


def snip(t, amp=0.3):
    n = int(0.09 * SR)
    tt = np.arange(n) / SR
    s = hp(rng.standard_normal(n), 2500) * np.exp(-tt * 70)
    place(s, t, 0.1, amp)
    # crystalline release
    n2 = int(1.4 * SR)
    t2 = np.arange(n2) / SR
    f = 1800 + 1600 * np.exp(-t2 * 3)
    sp = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t2 * 3.2) * 0.4
    place(sp, t + 0.02, -0.2, amp * 0.6)
    for i, mm in enumerate((86, 90, 93)):
        bell(t + 0.04 + i * 0.07, mm, amp * 0.25, 1.4, pan=0.3 - i * 0.3)


def zap(t, amp=0.06, pan=0.0):
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    f = 2200 * np.exp(-tt * 18) + 500
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-tt * 35)
    place(lp(s, 5000), t, pan, amp)


def boom(t, amp=0.6):
    n = int(3.5 * SR)
    tt = np.arange(n) / SR
    f = 30 + 70 * np.exp(-tt * 5)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.2)
    s += lp(rng.standard_normal(n), 400) * np.exp(-tt * 6) * 0.5
    place(s, t, gain=amp)


def breath(t, dur=1.5, amp=0.11):
    n = int(dur * SR)
    k = np.linspace(0, 1, n)
    x = bp(rng.standard_normal(n), 500, 3000) + 0.4 * bp(rng.standard_normal(n), 3000, 7000)
    e = np.sin(np.pi * k ** 0.6) ** 1.5
    place(x * e, t, 0.2, amp)


def flow(t0, t1, amp=0.07, pulse=1.15):
    n = int((M(t1) - M(t0)) * SR)
    tt = np.arange(n) / SR
    x = lp(rng.standard_normal(n), 420, 4)
    puls = 0.55 + 0.45 * np.maximum(0, np.sin(2 * np.pi * pulse * tt)) ** 3
    y = x * puls * env_adsr(n, 1.2, 1.2)
    # bubbles
    for _ in range(int((t1 - t0) * 5)):
        bt = rng.uniform(0, t1 - t0 - 0.2)
        m = rng.uniform(62, 80)
        nn = int(0.12 * SR)
        b = np.sin(2 * np.pi * np.cumsum(note(m) * (1 + np.linspace(0, .6, nn))) / SR) * np.exp(-np.arange(nn) / SR * 40)
        i = int(bt * SR)
        y[i:i + nn] += b * 0.05
    place(np.vstack([y, np.roll(y, 900)]), t0, gain=amp)


# ================================================================= the score
# Scene 1 · 0-10 · D minor, heartbeat accelerates, scan
sub(38, 0, 10.6, 0.10, 3, 1.2)
pad([50, 57, 62, 65], 0, 10.8, 0.07, 3.5, 1.4, 800)
hb = 1.0
while hb < 9.6:
    p = hb / 10
    heartbeat(hb, 0.32 + 0.2 * p)
    hb += 60 / (80 + 60 * p)
for i in range(9):  # treadmill footfalls (soft)
    pass
riser(1.4, 4.0, 0.05, 400, 3000)
for i, tt in enumerate(np.arange(1.6, 5.4, 0.48)):
    bell(tt, 93 + (i % 3) * 2, 0.025, 0.6, pan=-0.4 + i * 0.1)
for i, tt in enumerate((6.0, 6.4, 6.8, 7.2)):
    bell(tt, (81, 84, 88, 86)[i], 0.05, 1.6, pan=(-.4, .3, -.2, .4)[i])
whoosh(9.0, 1.8, 0.28, 200, 6000)

# Scene 2 · 10-23 · warm Bb, hormone chimes, zoom, enzyme cuts
pad([46, 53, 58, 62, 65], 9.8, 23.6, 0.075, 2.0, 1.5, 1100)
sub(34, 9.8, 23.4, 0.09)
for i in range(6):
    bell(10 + 0.4 + i * 0.28 + 1.4, (77, 81, 84, 86, 89, 84)[i], 0.06, 2.0, pan=-0.6 + i * 0.22)
whoosh(13.0, 2.4, 0.3, 120, 4000, 0.4, -0.4)
riser(13.2, 2.0, 0.06, 300, 1800)
for c in (16.0, 18.3, 20.6):
    riser(c - 1.6, 1.6, 0.035, 600, 3000)
    snip(c, 0.32)
whoosh(22.0, 1.8, 0.28, 200, 5000)

# Scene 3 · 23-34 · G minor, pulsatile blood flow
pad([43, 50, 55, 58, 62], 22.8, 34.6, 0.07, 2.0, 1.5, 900)
sub(31, 22.8, 34.4, 0.10)
flow(23, 34.2, 0.09)
bell(25.2, 79, 0.06, 2.0, 0.3)  # FA binds albumin
bell(32.0, 74, 0.07, 2.4, -0.2)  # into transporter
bell(33.0, 81, 0.05, 2.4, 0.2)
whoosh(33.0, 1.9, 0.3, 150, 6000, -0.5, 0.5)

# Scene 4 · 34-49 · energy: arpeggio grows with each step
pad([50, 57, 62, 65, 69], 33.8, 49.6, 0.07, 1.8, 1.5, 1300, shimmer=0.15)
sub(38, 33.8, 49.4, 0.11)
arp = [62, 65, 69, 74, 72, 69, 65, 69]
bpm = 112
step = 60 / bpm / 2
tt = 36.0
i = 0
while tt < 48.8:
    lt = tt - 34
    inten = 0.35 + 0.65 * min(1, max(0, (lt - 2) / 10))
    m = arp[i % len(arp)] + (12 if lt > 12 and i % 4 == 0 else 0)
    pluck(tt, m, 0.07 * inten, 0.6, pan=np.sin(i * 0.9) * 0.5)
    tt += step
    i += 1
for k in range(7):  # beta-ox cuts
    zap(34 + 3.2 + 0.5 * k, 0.03, pan=0.5)
    bell(34 + 3.2 + 0.5 * k, 84 + (k % 3), 0.025, 0.8, pan=0.5)
for k in range(30):  # electrons
    zap(42 + k * 0.2 + rng.uniform(0, .08), 0.022, pan=rng.uniform(-.6, .2))
for k in range(int((15 - 12) / 0.3)):  # ATP
    bell(46 + 0.3 * k + 1.3, 88 + (k % 4) * 2, 0.03, 0.9, pan=rng.uniform(-.7, .7))
riser(46, 2.8, 0.06, 200, 2500)
whoosh(48.0, 1.9, 0.3, 200, 6000, 0.5, -0.5)

# Scene 5 · 49-63 · F major opens up, breathing
pad([41, 48, 53, 57, 60, 64], 48.8, 63.6, 0.075, 2.5, 1.5, 1200, shimmer=0.12)
sub(29, 48.8, 63.4, 0.10)
flow(49, 53.6, 0.06, 1.25)
whoosh(52.8, 2.6, 0.24, 120, 3500, 0.3, -0.3)
for k in range(10):
    bell(53.8 + k * 0.45, (72, 76, 79, 84)[k % 4], 0.03, 1.4, pan=-0.5 + (k % 5) * .25)
whoosh(58.0, 2.4, 0.22, 150, 4000, -0.3, 0.3)
lc = 0.0
while 49 + 9.6 + lc < 63:
    breath(49 + 9.6 + lc, 1.5, 0.12)
    lc += 3.4
riser(60.5, 2.5, 0.07, 200, 3000)
whoosh(62.0, 1.8, 0.28, 200, 6000)

# Scene 6 · 63-75 · reveal, resolve to D major
pad([50, 57, 62, 66, 69], 62.8, 76, 0.065, 2.5, 3.5, 1200)
riser(64.0, 3.4, 0.12, 150, 4000)
boom(67.4, 0.55)
pad([38, 50, 57, 62, 66, 69, 74], 67.3, 76, 0.09, 0.4, 4.5, 1800, shimmer=0.25)
sub(38, 67.3, 76, 0.12, 0.2, 4)
for i, m in enumerate((74, 78, 81, 86, 90)):
    bell(67.45 + i * 0.09, m, 0.07, 3.2, pan=-0.6 + i * 0.3)
for i, m in enumerate((81, 78, 74)):
    bell(69.0 + i * 0.12, m, 0.045, 2.5, pan=0.4 - i * 0.4)
bell(71.0, 86, 0.05, 3.5, 0)

# ---------------------------------------------------------------- master
ir_n = int(2.8 * SR)
ti = np.arange(ir_n) / SR
irL = rng.standard_normal(ir_n) * np.exp(-ti * 2.4)
irR = rng.standard_normal(ir_n) * np.exp(-ti * 2.4)
irL, irR = lp(irL, 5000), lp(irR, 5000)
irL[:int(.012 * SR)] = 0
irR[:int(.017 * SR)] = 0
wet = 0.22
L2 = L + wet * fftconvolve(L, irL)[:N] / np.sqrt(np.sum(irL ** 2))
R2 = R + wet * fftconvolve(R, irR)[:N] / np.sqrt(np.sum(irR ** 2))
mix = np.vstack([L2, R2])
NARR = os.environ.get('FJ_NARR')
if NARR:
    import wave as _w
    voice = np.zeros(N)
    for k in range(6):
        fp = os.path.join(NARR, f'scene_{k + 1}.wav')
        if not os.path.exists(fp):
            continue
        with _w.open(fp) as w:
            v = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float) / 32768
            if w.getnchannels() == 2:
                v = v.reshape(-1, 2).mean(1)
        i = int((A0[k] + 0.6) * SR)
        n = min(len(v), N - i)
        voice[i:i + n] += v[:n]
    env = np.abs(voice)
    env = lp(env, 4)
    env = np.clip(env / (env.max() + 1e-9) * 3, 0, 1)
    duck = 1 - 0.62 * lp(env, 2)
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.55 * duck
    voice = voice / (np.max(np.abs(voice)) + 1e-9) * 0.92
    mix = mix + np.vstack([voice, voice])
mix = hp(mix, 28)
# gentle bus compression + soft clip
peak = np.max(np.abs(mix))
mix = mix / peak * 0.9
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
fade = int(1.5 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade)
mix[:, :int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))

out = (mix.T * 32767 * 0.95).astype(np.int16)
import wave
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(out.tobytes())
print('ok', out.shape[0] / SR)
