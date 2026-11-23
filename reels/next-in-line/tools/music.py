# "Next in line" — 20 s, 120 BPM (beat = 0.5 s = 15 frames @30fps), A minor deep house with Rhodes.
# Recorded-sample instruments (FluidR3 GM) + foley. Cue points (frames): drop 120 | breath 300-330 | reveal 330 | final hit 570.
import numpy as np, mido, subprocess, wave, os
from scipy.signal import butter, sosfilt

SR = 48000; BPM = 120; B = 60 / BPM; T = 20.0; N = int(SR * T); TPB = 480
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
BUILD = os.path.join(ROOT, 'build'); os.makedirs(BUILD, exist_ok=True)
SF = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
rng = np.random.default_rng(120)
F = lambda f: f / 30          # frame -> seconds
FB = lambda f: f / 15         # frame -> beats

def render(name, events, program=None, ch=0, rev=40, cho=0):
    mid = mido.MidiFile(ticks_per_beat=TPB); tr = mido.MidiTrack(); mid.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM)))
    if program is not None: tr.append(mido.Message('program_change', program=program, channel=ch))
    tr.append(mido.Message('control_change', control=91, value=rev, channel=ch))
    tr.append(mido.Message('control_change', control=93, value=cho, channel=ch))
    ev = []
    for b, n, v, d in events: ev += [(int(b * TPB), 1, n, v), (int((b + d) * TPB), 0, n, 0)]
    ev.sort(key=lambda e: (e[0], e[1])); last = 0
    for t, on, n, v in ev:
        tr.append(mido.Message('note_on' if on else 'note_off', note=n, velocity=v, channel=ch, time=t - last)); last = t
    p = os.path.join(BUILD, name); mid.save(p + '.mid')
    subprocess.run(['fluidsynth', '-ni', '-g', '0.7', '-r', str(SR), '-F', p + '.wav', SF, p + '.mid'], check=True, capture_output=True)
    with wave.open(p + '.wav') as w: a = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2) / 32768
    o = np.zeros((N, 2)); n = min(N, len(a)); o[:n] = a[:n]; return o

# Am9  Fmaj7  C(add9)  G6  — warm deep-house voicings
CH = [(45, [57, 60, 64, 67, 71]), (41, [57, 60, 64, 65, 69]), (48, [55, 60, 62, 64, 67]), (43, [55, 59, 62, 64, 67])]
rhodes, pad, bass, drums, glock = ([] for _ in range(5))

def chords(b0, b1, style):
    for b in np.arange(b0, b1, 4):
        root, ch = CH[int((b - b0) // 4) % 4]
        if style == 'stab':      # hook: sparse offbeat stabs
            for o in (0, 1.5, 2.5):
                for n in ch[:4]: rhodes.append((b + o, n, 70, 0.4))
        else:                    # groove: syncopated house chords
            for o, d in ((0, 0.7), (0.75, 0.4), (1.5, 0.4), (2.5, 0.9), (3.5, 0.4)):
                for n in ch: rhodes.append((b + o, n, 82 if o == 0 else 70, d))
            bass.extend([(b, root, 112, 0.45), (b + 0.75, root, 96, 0.25), (b + 1.5, root + 12, 92, 0.3),
                         (b + 2.5, root, 104, 0.45), (b + 3.25, root + 7, 90, 0.3)])

def groove(b0, b1, full=True):
    for b in np.arange(b0, b1, 1.0):
        drums.append((b, 36, 118, 0.2))                       # four on the floor
        drums.append((b + 0.5, 46 if full else 42, 78, 0.1))   # offbeat (open) hat
        if full: drums.extend([(b + 0.25, 42, 46, 0.05), (b + 0.75, 42, 52, 0.05), (b, 70, 40, 0.1), (b + 0.5, 70, 52, 0.1)])
        if int(b) % 2 == 1: drums.extend([(b, 39, 108, 0.2), (b, 38, 70, 0.2)])

# HOOK + BUILD (0-8 beats): stabs, hats from beat 4, snare roll into the drop
chords(0, 8, 'stab')
for b in np.arange(4, 8, 0.5): drums.append((b, 42, 50 + int(b) * 4, 0.05))
for i in range(8): drums.append((7 + i * 0.125, 38, 50 + i * 8, 0.08))
# DROP (8-20)
chords(8, 20, 'groove'); groove(8, 20)
drums.append((8, 49, 120, 2))
# BREATH (20-22): nothing
# REVEAL (22-36): full + pad + sparkle
chords(22, 36, 'groove'); groove(22, 36)
for b in np.arange(22, 36, 4):
    root, ch = CH[int((b - 22) // 4) % 4]
    for n in ch[:4]: pad.append((b, n + 12, 78, 3.9))
drums.append((22, 49, 127, 3)); drums.append((30, 49, 110, 2))
for k, n in enumerate((81, 84, 88, 91, 93)): glock.append((22 + k * 0.25, n, 80, 0.6))
# OUTRO (36-40): groove thins, final chord at 38
groove(36, 38, full=False)
for n in (45, 57, 60, 64, 67, 71, 76): rhodes.append((38, n, 96, 3)); pad.append((38, n + 12, 80, 3))
bass.append((38, 33, 120, 2.5)); drums.append((38, 49, 115, 3))

R = render('rhodes', rhodes, 4, 0, rev=55, cho=30)
P = render('pad', pad, 48, 1, rev=90)
Bs = render('bass', bass, 33, 2, rev=10)
D = render('drums', drums, None, 9, rev=20)
G = render('glock', glock, 9, 3, rev=80)

def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x, axis=0)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)

# hook + build are low-passed (a filtered intro that opens on the drop) — a classic house move
music = R * 0.9 + P * 0.55 + Bs * 0.95 + D * 1.0 + G * 0.5
cut = int(F(120) * SR)
music[:cut] = lp(music[:cut], 1400) * 1.25
music[int(F(540) * SR):] = lp(music[int(F(540) * SR):], 2500)

# sub kick weight
sub = np.zeros(N)
for b in list(np.arange(8, 20)) + list(np.arange(22, 36)) + [36, 37, 38]:
    n = int(0.35 * SR); t = np.arange(n) / SR; j = int(b * B * SR); e = min(N, j + n)
    sub[j:e] += (np.sin(2 * np.pi * (48 + 60 * np.exp(-t * 35)) * t) * np.exp(-t * 9) * 0.45)[:e - j]
mix = music + sub[:, None]

def add(sig, t, g=1.0, pan=0.0):
    j = int(t * SR); e = min(N, j + len(sig))
    if e <= j: return
    mix[j:e, 0] += sig[:e - j] * g * (1 - max(pan, 0)); mix[j:e, 1] += sig[:e - j] * g * (1 + min(pan, 0))
def clipper(dur, amp=0.2):
    n = int(dur * SR); t = np.arange(n) / SR
    hum = np.sign(np.sin(2 * np.pi * 120 * t)) * 0.5 + np.sin(2 * np.pi * 240 * t) * 0.3
    buzz = bp(rng.standard_normal(n), 1800, 5200) * (0.6 + 0.4 * np.sin(2 * np.pi * 120 * t))
    env = np.minimum(t / 0.03, 1) * np.minimum((dur - t) / 0.06, 1)
    return (bp(hum, 150, 3000) * 0.6 + buzz * 0.5) * env * amp
def snip(amp=0.35):  # scissors: two metallic clicks
    n = int(0.12 * SR); s = np.zeros(n)
    for o, g in ((0, 1.0), (0.045, 0.7)):
        m = int(0.025 * SR); t = np.arange(m) / SR
        c = bp(rng.standard_normal(m), 3000, 9000) * np.exp(-t * 300) + np.sin(2 * np.pi * 4200 * t) * np.exp(-t * 200) * 0.4
        j = int(o * SR); s[j:j + m] += c * g
    return s * amp
def whoosh(dur):
    n = int(dur * SR); t = np.arange(n) / SR; x = rng.standard_normal(n); o = np.zeros(n)
    for k in range(0, n, 1024):
        fc = 300 + 4500 * (k / n) ** 2; o[k:k + 1024] = sosfilt(butter(2, [fc, fc * 1.6 + 60], 'band', fs=SR, output='sos'), x[k:k + 1024])
    return o * np.sin(np.pi * t / dur) ** 2 * 1.0
def tapestop(t0, dur=0.45):
    a = int(t0 * SR); L = int(dur * SR); seg = mix[a - int(0.6 * SR):a + L].copy()
    pos = np.cumsum(np.linspace(1, 0.05, L)) + 0.6 * SR; pos = np.clip(pos, 0, len(seg) - 2).astype(int)
    mix[a:a + L] = seg[pos] * np.linspace(1, 0, L)[:, None]
def crackle(n):
    c = np.zeros(n); idx = rng.integers(0, n, n // 1800); c[idx] = rng.standard_normal(len(idx)) * 0.5
    return bp(c, 800, 8000) + bp(rng.standard_normal(n), 200, 3000) * 0.01

add(crackle(int(F(120) * SR)), 0, 0.5)
add(clipper(1.3, 0.16), 0.15, 1.0, -0.1)                         # hook: clippers switch on
add(whoosh(0.9), F(120) - 0.85, 0.7)
for f, d in ((120, 0.9), (165, 0.6), (225, 0.5), (255, 0.5)): add(clipper(d, 0.2), F(f), 1.0, -0.15)
for f in (150, 195, 210, 240, 270, 285): add(snip(0.32), F(f) + 0.05, 1.0, 0.25)
tapestop(F(300), 0.4)
mix[int((F(300) + 0.4) * SR):int(F(330) * SR)] *= 0.0              # the breath: silence
add(snip(0.25), F(312), 1.0, 0.2)
add(whoosh(0.3), F(330) - 0.28, 0.8)
for f in (375, 420, 450, 480, 510): add(whoosh(0.3), F(f) - 0.15, 0.35, -0.2)

fade = np.ones(N); L = int(0.9 * SR); fade[-L:] = np.linspace(1, 0, L) ** 1.3; mix *= fade[:, None]
mix = np.tanh(mix * 1.15) / np.tanh(1.15); mix = mix / np.max(np.abs(mix)) * 0.89
out = os.path.join(ROOT, 'public', 'music_raw.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', out, '-af', 'loudnorm=I=-14:TP=-1:LRA=9', '-ar', '48000',
                os.path.join(ROOT, 'public', 'music.wav')], check=True)
print('music ok')
