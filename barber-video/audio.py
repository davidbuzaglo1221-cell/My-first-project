"""Procedural soundtrack for the 30s barber-tips video (numpy only).
120 BPM trap-style beat, synced to the scene cuts at 2, 4, 12, 20, 27s,
plus clipper / trimmer buzz, whooshes, impacts, camera shutter and UI pops."""
import sys, wave
import numpy as np

SR = 44100
DUR = 30.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rs = np.random.default_rng(1)
BEAT = 0.5  # 120 BPM


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * (1 - max(0, pan))
    R[i:i + len(sig)] += sig * gain * (1 + min(0, pan))


def env(n, a, d):
    t = np.arange(n) / SR
    e = np.exp(-t / d)
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def lowpass(x, cut):
    a = np.exp(-2 * np.pi * cut / SR)
    y = np.empty_like(x); s = 0.0
    # vectorised enough for our lengths via cumulative filter trick
    for i in range(len(x)):
        s = (1 - a) * x[i] + a * s; y[i] = s
    return y


def highpass(x, cut):
    return x - lowpass(x, cut)


def kick():
    n = int(.45 * SR); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t / .035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(2.2 * np.sin(ph) * env(n, .001, .16)) * .9


def snare():
    n = int(.3 * SR); t = np.arange(n) / SR
    noise = highpass(rs.standard_normal(n), 1200) * env(n, .001, .07)
    body = np.sin(2 * np.pi * 190 * t) * env(n, .001, .05)
    clap = np.zeros(n)
    for k, off in enumerate([0, .011, .022]):
        i = int(off * SR); m = n - i
        clap[i:] += highpass(rs.standard_normal(m), 900) * env(m, .0005, .018 if k < 2 else .09)
    return (noise * .5 + body * .5 + clap * .6) * .7


HAT = highpass(rs.standard_normal(int(.08 * SR)), 7000)
def hat(open_=False):
    n = int((.25 if open_ else .05) * SR)
    x = highpass(rs.standard_normal(n), 7000)
    return x * env(n, .0005, .09 if open_ else .014) * .35


def bass808(freq, dur, glide_from=None):
    n = int(dur * SR); t = np.arange(n) / SR
    f = np.full(n, freq, dtype=float)
    if glide_from: f = freq + (glide_from - freq) * np.exp(-t / .06)
    ph = 2 * np.pi * np.cumsum(f) / SR
    e = env(n, .004, dur * .7); e[-400:] *= np.linspace(1, 0, 400)
    return np.tanh(1.8 * np.sin(ph)) * e * .55


def pad(freqs, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.13):
            ff = f * (1 + det / 100 * 3)
            x += (2 * ((t * ff) % 1) - 1) * .2   # saw
    x = lowpass(x, 1100)
    a = np.minimum(1, t / .4) * np.minimum(1, (dur - t) / .5)
    return x * a * .09


def buzz(dur, base=118, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    wob = 1 + .01 * np.sin(2 * np.pi * 6 * t)
    ph = 2 * np.pi * base * np.cumsum(wob) / SR
    x = np.sign(np.sin(ph)) * .35 + np.sin(2 * ph) * .25 + np.sin(3 * ph) * .15
    x += highpass(rs.standard_normal(n), 3000) * .25 * bright
    x = lowpass(x, 2500 * bright)
    a = np.minimum(1, t / .05) * np.minimum(1, (dur - t) / .08)
    return x * a * .35


def whoosh(dur=.45):
    n = int(dur * SR); t = np.arange(n) / SR
    x = rs.standard_normal(n)
    # sweep a lowpass upward by mixing two filtered versions
    lo, hi = lowpass(x, 600), lowpass(x, 6000)
    k = (t / dur) ** 2
    y = lo * (1 - k) + hi * k
    return y * (t / dur) ** 2.2 * .5


def impact():
    n = int(1.6 * SR); t = np.arange(n) / SR
    f = 38 + 70 * np.exp(-t / .08)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .001, .5)
    crack = lowpass(rs.standard_normal(n), 4000) * env(n, .001, .12)
    return np.tanh(1.5 * (boom * .9 + crack * .5)) * .9


def pop(freq=900):
    n = int(.09 * SR); t = np.arange(n) / SR
    f = freq * (1 + 1.2 * np.exp(-t / .01))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .001, .03) * .35


def shutter():
    n = int(.25 * SR)
    x = np.zeros(n)
    for off, g in ((0, 1), (.075, .8)):
        i = int(off * SR); m = n - i
        x[i:] += highpass(rs.standard_normal(m), 2500) * env(m, .0005, .012) * g
    return x * .9


def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 200 * (8 ** (t / dur))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * .15
    noise = highpass(rs.standard_normal(n), 2000) * .2
    return (tone + noise) * (t / dur) ** 2


# ---------------- arrangement ----------------
NOTE = {'A1': 55.0, 'F1': 43.65, 'C2': 65.41, 'G1': 49.0, 'E1': 41.2, 'D2': 73.42}
CHORDS = [('A1', [220.0, 261.63, 329.63]), ('F1', [174.61, 220.0, 261.63]),
          ('C2', [196.0, 261.63, 329.63]), ('G1', [196.0, 246.94, 293.66])]

# pad under everything from 0 to 30 (2 bars per chord, bar = 2s)
for b in range(0, 15):
    root, ch = CHORDS[(b // 2) % 4 if b >= 1 else 0]
    if b % 2 == 0:
        add(pad(ch, 4.0), b * 2.0, .9 if b * 2 >= 2 else .5)

# HOOK: clipper buzz from 0 to 2, stamp pop at 1.35, flash hit at 0
add(impact(), 0.0, 1.1)
add(buzz(1.95, 118), 0.0, 1.2)
for i, tt in enumerate((.15, .25, .4, .52)): add(pop(700 + i * 120), tt, .7)
for i in range(3): add(pop(500 - i * 60), .75 + i * .12, .6)
add(snare(), 1.35, .9); add(kick(), 1.35, .9)
add(pop(1100), 1.5, .5)

# drums 2.0 -> 27.0 (trap half-time)
for bar in range(1, 14):
    t0 = bar * 2.0
    if t0 >= 27: break
    for k_off in (0, .75, 1.25 if bar % 2 else 1.5):
        add(kick(), t0 + k_off, .85)
    add(snare(), t0 + 1.0, .75)
    for h in range(8):
        tt = t0 + h * .25
        if tt < 27: add(hat(h == 7 and bar % 2 == 0), tt, .9 if h % 2 == 0 else .6, pan=.25)
    if bar % 2 == 1:  # hat roll
        for h in range(6): add(hat(), t0 + 1.5 + h * (1 / 12), .45, pan=-.25)
    # 808 bass following chords
    root, _ = CHORDS[(bar // 2) % 4]
    f = NOTE[root]
    add(bass808(f, .7, f * 1.5 if bar % 4 == 3 else None), t0, .9)
    add(bass808(f, .45), t0 + .75, .7)
    add(bass808(f * (1.5 if bar % 2 else 1.0), .6), t0 + 1.25, .7)

# transitions: whoosh into cut, impact on cut
for cu in (2.0, 4.0, 12.0, 20.0, 27.0):
    add(whoosh(.45), cu - .45, .8)
    add(impact(), cu, .7 if cu != 27 else 1.0)

# UI pops for chips / labels
for tt in (4.05, 5.2, 6.8, 8.5, 10.0, 12.05, 13.3, 15.0, 18.0, 20.05, 21.0, 23.4, 25.3, 27.6, 28.1):
    add(pop(880), tt, .55)

# TIP 2: clipper passes 12.9 -> 17.2, one per zone with scoop accent
for i in range(6):
    st = 12.9 + i * .72
    add(buzz(.66, 112 + i * 2, .9), st, .45, pan=.2)
add(pop(1300), 18.0, .6); add(pop(1650), 18.08, .5)  # success ding

# TIP 3: trimmer 20.7 -> 22.3, mirror whoosh, shutter
add(buzz(1.6, 190, 1.3), 20.7, .4, pan=-.2)
add(whoosh(.35), 22.6, .6)
add(shutter(), 25.2, 1.0)

# CTA: riser before, sustained chord after
add(riser(1.2), 25.8, .6)
add(pad([220.0, 261.63, 329.63, 440.0], 3.0), 27.0, 1.4)
add(bass808(55.0, 2.8), 27.0, .9)

# ---------------- mix ----------------
mix = np.stack([L, R], 1)
# simple stereo reverb send (exponential noise IR via FFT convolution)
irn = int(1.4 * SR)
ir = rs.standard_normal((irn, 2)) * np.exp(-np.arange(irn) / SR / .35)[:, None]
ir[:200] = 0
nfft = 1 << int(np.ceil(np.log2(N + irn)))
wet = np.stack([np.fft.irfft(np.fft.rfft(mix[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[:N] for c in range(2)], 1)
wet /= np.max(np.abs(wet)) + 1e-9
mix = mix + wet * np.max(np.abs(mix)) * .12
# fade in/out
t = np.arange(N) / SR
mix *= np.minimum(1, t / .02)[:, None] * np.clip((30 - t) / .6, 0, 1)[:, None]
# soft limiter + normalise to -1 dBFS
mix = np.tanh(mix / (np.max(np.abs(mix)) * .55))
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
pcm = (mix * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', sys.argv[1])
