"""Original gym-phonk style soundtrack + sound effects, synthesised from scratch and locked to the video timeline.

Usage: python3 audio.py out.wav
"""
import sys
from functools import lru_cache

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

import content as C

SR = 44100
STEP = C.BEAT / 4           # 16th note
rng = np.random.default_rng(11)


def n2f(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, attack=0.002, decay=0.2):
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1) if attack > 0 else 1
    return a * np.exp(-t / decay)


def filt(x, kind, f):
    sos = butter(2, f, btype=kind, fs=SR, output="sos")
    return sosfilt(sos, x)


# ---- drums --------------------------------------------------------------------
@lru_cache(None)
def kick():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * env(n, 0.001, 0.22)
    x += 0.4 * filt(rng.standard_normal(n), "highpass", 2500) * env(n, 0.0005, 0.006)
    return np.tanh(1.6 * x) * 0.9


@lru_cache(None)
def clap():
    n = int(0.35 * SR)
    noise = filt(rng.standard_normal(n), "bandpass", [900, 3200])
    e = np.zeros(n)
    for off in (0, 0.011, 0.022):
        k = int(off * SR)
        e[k:] += env(n - k, 0.0005, 0.012 if off < 0.02 else 0.14)
    return noise * e * 0.55


@lru_cache(None)
def hat(open_=False):
    n = int((0.25 if open_ else 0.06) * SR)
    x = filt(rng.standard_normal(n), "highpass", 7000)
    return x * env(n, 0.0005, 0.09 if open_ else 0.018) * 0.28


@lru_cache(None)
def cowbell(m):
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    f = n2f(m)
    sq = np.sign(np.sin(2 * np.pi * f * t)) + np.sign(np.sin(2 * np.pi * f * 1.48 * t))
    x = filt(sq, "bandpass", [f * 0.8, f * 4])
    return x * env(n, 0.001, 0.09) * 0.17


@lru_cache(None)
def bass808(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = n2f(m) * (1 + 0.6 * np.exp(-t / 0.03))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    e = np.clip(t / 0.004, 0, 1) * np.exp(-t / max(0.25, dur * 0.7))
    e[-200:] *= np.linspace(1, 0, 200)
    return np.tanh(2.4 * x * e) * 0.42


@lru_cache(None)
def pad(chord, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for m in chord:
        for det in (-0.12, 0.0, 0.11):
            f = n2f(m + det)
            x += 2 * ((t * f) % 1.0) - 1
    x = filt(x / (len(chord) * 3), "lowpass", 1100)
    e = np.clip(t / 0.25, 0, 1) * np.clip((dur - t) / 0.3, 0, 1)
    return x * e * 0.16


# ---- sound effects ------------------------------------------------------------
@lru_cache(None)
def impact():
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(32 + 70 * np.exp(-t / 0.08)) / SR) * env(n, 0.001, 0.5)
    crash = filt(rng.standard_normal(n), "highpass", 3000) * env(n, 0.001, 0.35) * 0.35
    return np.tanh(1.8 * (boom * 0.9 + crash)) * 0.75


@lru_cache(None)
def whoosh(dur=0.6):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    bands = 10
    for i in range(bands):
        lo = 300 * 2 ** (i * 0.5)
        band = filt(noise, "bandpass", [lo, lo * 1.6])
        w = np.exp(-((np.linspace(0, 1, n) - i / (bands - 1)) / 0.14) ** 2)
        out += band * w
    shape = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return out * shape * 0.32


@lru_cache(None)
def riser(dur=2.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 180 * (12 ** (t / dur))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.12
    noise = filt(rng.standard_normal(n), "highpass", 1500) * 0.22
    return (tone + noise) * (t / dur) ** 2.2


@lru_cache(None)
def pop(pitch=1.0):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = (700 + 900 * (1 - np.exp(-t / 0.02))) * pitch
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.03) * 0.3


@lru_cache(None)
def tick():
    n = int(0.03 * SR)
    return filt(rng.standard_normal(n), "highpass", 4000) * env(n, 0.0003, 0.005) * 0.5


# ---- arrangement --------------------------------------------------------------
A = 57  # A3
PROGS = [
    [(0, 3, 7), (-4, 0, 3), (3, 7, 10), (-2, 2, 5)],      # Am F C G
    [(0, 3, 7), (5, 8, 12), (-4, 0, 3), (-5, -1, 2)],     # Am Dm F E
    [(5, 8, 12), (0, 3, 7), (-5, -1, 2), (0, 3, 7)],      # Dm Am E Am
    [(-4, 0, 3), (-2, 2, 5), (0, 3, 7), (0, 3, 7)],       # F G Am Am
]
BELLS = [
    [(0, 12), (3, 12), (6, 15), (8, 14), (10, 12), (12, 10), (14, 7)],
    [(0, 7), (2, 7), (4, 10), (6, 12), (8, 12), (11, 15), (13, 14), (14, 12)],
    [(0, 12), (2, 15), (4, 12), (6, 10), (8, 12), (10, 7), (12, 8), (14, 7)],
    [(0, 19), (3, 17), (6, 15), (8, 14), (11, 12), (14, 10)],
]
KICKS = {"phonk": [0, 7, 10], "drive": [0, 3, 8, 10], "half": [0], "four": [0, 4, 8, 12]}


class Mix:
    def __init__(self, seconds):
        self.L = np.zeros(int((seconds + 3) * SR), np.float32)
        self.R = np.zeros_like(self.L)

    def add(self, sample, t, gain=1.0, pan=0.0):
        i = int(round(t * SR))
        if i < 0:
            sample, i = sample[-i:], 0
        j = min(len(self.L), i + len(sample))
        s = sample[: j - i] * gain
        self.L[i:j] += s * (1 - max(0, pan))
        self.R[i:j] += s * (1 + min(0, pan))


def bar(mx, t0, chord_root, chord, kick_pat="phonk", clap_on=True, hats="8", bell=None, bell_gain=1.0,
        bass=True, pad_on=True, drums=True, roll=False):
    if pad_on:
        p = pad(tuple(A + c for c in chord), C.BAR)
        mx.add(p, t0, 1.0, -0.35)
        mx.add(p, t0 + 0.012, 1.0, 0.35)
    ks = KICKS[kick_pat]
    if drums:
        for s in ks:
            mx.add(kick(), t0 + s * STEP, 0.95)
        if clap_on:
            for s in ((8,) if kick_pat == "half" else (4, 12)):
                mx.add(clap(), t0 + s * STEP, 0.9)
        if hats:
            step = {"8": 2, "16": 1, "4": 4}[hats]
            for s in range(0, 16, step):
                mx.add(hat(), t0 + s * STEP, 0.8 if s % 4 == 0 else 0.55, 0.25)
            mx.add(hat(True), t0 + 14 * STEP, 0.6, 0.25)
        if roll:
            for s in range(8, 16):
                mx.add(clap(), t0 + s * STEP, 0.25 + 0.06 * (s - 8))
            for s in range(0, 16):
                mx.add(hat(), t0 + s * STEP + STEP / 2, 0.4, -0.2)
    if bass:
        root = 33 + chord_root               # A1 based
        hits = ks if drums else [0]
        for k, s in enumerate(hits):
            nxt = hits[k + 1] if k + 1 < len(hits) else 16
            mx.add(bass808(root, round((nxt - s) * STEP, 3)), t0 + s * STEP, 1.0)
    if bell is not None:
        for s, m in BELLS[bell]:
            mx.add(cowbell(57 + m), t0 + s * STEP, bell_gain, 0.15)


def build():
    mx = Mix(C.TOTAL)
    for kind, s, d, data in C.SEGMENTS:
        nbars = int(round(d / C.BAR))
        if kind == "intro":
            prog = PROGS[0]
            for b in range(nbars):
                t0 = s + b * C.BAR
                ch = prog[b % 4]
                if b < 8:
                    bar(mx, t0, ch[0], ch, drums=b >= 4, kick_pat="half", hats="4" if b >= 4 else None,
                        bell=None if b < 4 else 0, bell_gain=0.6)
                elif b < 15:
                    bar(mx, t0, ch[0], ch, kick_pat="phonk", bell=b % 2 * 1, bell_gain=0.9)
                else:
                    bar(mx, t0, ch[0], ch, kick_pat="four", hats="16", roll=b == 17)
            mx.add(riser(2.0), s + 14.0, 0.8)
            mx.add(riser(6.0), s + 30.0, 0.9)
            for k in (0.0, 1.6, 5.0, 10.0, 16.0):
                mx.add(impact(), s + k, 0.7 if k else 0.9)
            for i in range(20):
                mx.add(tick(), s + 22.0 + i * 0.4, 0.9)
                mx.add(pop(1 + (i % 4) * 0.08), s + 22.0 + i * 0.4, 0.5)
            for k in (30.0, 32.0, 34.0):
                mx.add(impact(), s + k, 0.55)
            for i, w in enumerate((1.6, 2.2, 3.0, 5.0, 5.6, 10.0, 10.8, 16.0, 16.8)):
                mx.add(whoosh(0.4), s + w - 0.2, 0.6)
        elif kind == "tip":
            n = data["n"]
            prog = PROGS[n % 4]
            words = len(data["title"].split())
            for b in range(nbars):
                t0 = s + b * C.BAR
                ch = prog[b % 4]
                lt = b * C.BAR
                if lt < C.T_HEADER:                       # slam + title: full energy
                    bar(mx, t0, ch[0], ch, kick_pat="phonk", hats="16" if b % 2 else "8", bell=n % 4)
                elif lt < C.T_TAKE:                       # reading: steady groove
                    phrase = (b // 2) % 4
                    bar(mx, t0, ch[0], ch, kick_pat="drive" if n % 2 else "phonk", hats="8",
                        bell=(n + 1) % 4 if phrase == 3 else None, bell_gain=0.55)
                elif b < nbars - 1:                       # takeaway: lift
                    bar(mx, t0, ch[0], ch, kick_pat="phonk", hats="16", bell=n % 4, bell_gain=1.0)
                else:                                     # last bar: break + riser
                    bar(mx, t0, ch[0], ch, drums=False, bass=False, roll=False)
            mx.add(impact(), s, 0.85)
            mx.add(riser(2.0), s + C.TIP - 2.0, 0.85)
            span = C.T_TITLE_END - 0.9 - C.T_SLAM_END
            for k in range(words):
                mx.add(pop(1 + 0.06 * k), s + C.T_SLAM_END + k * span / words, 0.45)
            mx.add(whoosh(0.5), s + C.T_TITLE_END, 0.6)
            mx.add(whoosh(0.5), s + C.T_HEADER, 0.4, -0.3)
            mx.add(whoosh(0.5), s + C.T_TAKE - 0.1, 0.7, 0.3)
            mx.add(pop(0.8), s + C.T_STICKER, 0.7)
            mx.add(whoosh(0.7), s + C.T_WIPE - 0.1, 0.8)
            # soft tick at each caption line change
            nl = len(data["lines"])
            for i in range(nl):
                mx.add(tick(), s + C.T_BODY + i * (C.T_TAKE - C.T_BODY) / nl, 0.6)
        elif kind == "inter":
            prog = PROGS[2]
            for b in range(nbars):
                ch = prog[b % 4]
                bar(mx, s + b * C.BAR, ch[0], ch, kick_pat="half", hats="8", bell=3 if b in (1, 2) else None,
                    bell_gain=0.7, drums=b < nbars - 1)
            mx.add(impact(), s, 0.85)
            for k in (1.4, 3.0):
                mx.add(whoosh(0.4), s + k - 0.2, 0.6)
            mx.add(pop(1.2), s + 3.4, 0.6)
            mx.add(pop(1.0), s + 5.0, 0.6)
            mx.add(riser(2.0), s + d - 2.0, 0.85)
            mx.add(whoosh(0.7), s + d - 0.7, 0.8)
        else:  # outro
            prog = PROGS[0]
            for b in range(nbars):
                ch = prog[b % 4]
                bar(mx, s + b * C.BAR, ch[0], ch, kick_pat="phonk", hats="16" if b > 6 else "8",
                    bell=b % 4, drums=b < nbars - 1, bass=b < nbars - 1)
            mx.add(impact(), s, 0.8)
            for i in range(20):
                mx.add(tick(), s + 0.4 + i * 0.3, 0.7)
            for k in (9.0, 14.0):
                mx.add(impact(), s + k, 0.7)
            mx.add(impact(), s + 19.0, 0.9)
    L, R = mx.L[: int(C.TOTAL * SR)], mx.R[: int(C.TOTAL * SR)]
    st = np.stack([L, R], 1)
    st = np.tanh(st * 0.9)                     # gentle bus saturation / limiter
    st /= np.max(np.abs(st)) + 1e-9
    return (st * 0.95 * 32767).astype(np.int16)


if __name__ == "__main__":
    wavfile.write(sys.argv[1], SR, build())
    print("wrote", sys.argv[1])
