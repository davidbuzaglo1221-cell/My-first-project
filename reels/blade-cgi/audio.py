"""Score + foley for The Blade (8 s). Cello and piano are rendered from the FluidR3 sampled
(recorded-instrument) soundfont; the switch click, lamp hum, blade swish and lock are
built from shaped noise and metal modes. Usage: python3 audio.py OUTDIR"""
import subprocess, sys, numpy as np, mido, wave

OUT = sys.argv[1]
SR, DUR = 48000, 8.0
LIGHT_ON = 8 / 24          # lamp clicks on (frame 8)
LOCK = 109 / 24            # blade locks open
CUT2, CUT3 = 63 / 24, 135 / 24

# ---------- score ----------
mid = mido.MidiFile(ticks_per_beat=480)
tr = mido.MidiTrack(); mid.tracks.append(tr)
tr.append(mido.MetaMessage("set_tempo", tempo=1_000_000))  # 60 BPM: 1 beat = 1 s
ev = []
def t(s): return int(round(s * 480))
ev += [(0, mido.Message("program_change", channel=0, program=42)),
       (0, mido.Message("program_change", channel=1, program=42)),
       (0, mido.Message("program_change", channel=2, program=0)),
       (0, mido.Message("control_change", channel=0, control=91, value=70)),
       (0, mido.Message("control_change", channel=1, control=91, value=70)),
       (0, mido.Message("control_change", channel=2, control=91, value=80))]
# cello C2 enters with the light, a fifth (G2) joins at the first cut
ev += [(t(LIGHT_ON + .05), mido.Message("note_on", channel=0, note=36, velocity=70)),
       (t(7.9), mido.Message("note_off", channel=0, note=36)),
       (t(CUT2), mido.Message("note_on", channel=1, note=43, velocity=55)),
       (t(7.9), mido.Message("note_off", channel=1, note=43))]
# expression swell: soft -> peak on the glint -> settle
for ch, start in ((0, LIGHT_ON), (1, CUT2)):
    for k in range(40):
        s = start + (7.9 - start) * k / 39
        x = s / 8.0
        val = 45 + 70 * np.exp(-((s - 6.1) / 1.7) ** 2)
        ev.append((t(s), mido.Message("control_change", channel=ch, control=11, value=int(min(127, val)))))
# sparse piano in C minor
for s, n, v in ((CUT2 + .1, 63, 38), (3.9, 67, 34), (CUT3 + .05, 72, 52), (CUT3 + .05, 75, 40),
                (6.9, 67, 26)):
    ev += [(t(s), mido.Message("note_on", channel=2, note=n, velocity=v)),
           (t(min(7.95, s + 2.2)), mido.Message("note_off", channel=2, note=n))]
ev.sort(key=lambda e: e[0])
last = 0
for tk, m in ev:
    tr.append(m.copy(time=tk - last)); last = tk
mid.save(f"{OUT}/score.mid")
subprocess.run(["fluidsynth", "-ni", "-g", "0.9", "-r", str(SR), "-F", f"{OUT}/score.wav",
                "/usr/share/sounds/sf2/FluidR3_GM.sf2", f"{OUT}/score.mid"], check=True,
               capture_output=True)


def read(p):
    with wave.open(p) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        return a.reshape(-1, w.getnchannels())


score = read(f"{OUT}/score.wav")
N = int(SR * DUR)
mix = np.zeros((N, 2), np.float32)
mix[:min(N, len(score))] += score[:N] * 0.9

rng = np.random.default_rng(7)
tt = np.arange(N) / SR


def bandnoise(n, lo, hi):
    x = rng.standard_normal(n)
    f = np.fft.rfft(x); fr = np.fft.rfftfreq(n, 1 / SR)
    f[(fr < lo) | (fr > hi)] = 0
    y = np.fft.irfft(f, n)
    return y / (np.abs(y).max() + 1e-9)


def place(sig, at, gain, pan=0.0):
    i = int(at * SR); j = min(N, i + len(sig))
    mix[i:j, 0] += sig[:j - i] * gain * (1 - pan)
    mix[i:j, 1] += sig[:j - i] * gain * (1 + pan)


# room tone (dark, very low)
room = bandnoise(N, 40, 900) * 0.006
mix += room[:, None]
# switch: low thunk + two-stage plastic click
n = int(.06 * SR); e = np.exp(-np.arange(n) / (.006 * SR))
click = bandnoise(n, 1800, 7000) * e
thunk = np.sin(2 * np.pi * 110 * np.arange(n) / SR) * np.exp(-np.arange(n) / (.018 * SR))
place(click * .55 + thunk * .45, LIGHT_ON - .012, .5)
place(click * .3, LIGHT_ON + .007, .35)
# tungsten hum rising after the click
hum = sum(np.sin(2 * np.pi * f * tt) / k for k, f in enumerate((100, 200, 300, 500), 1))
env = np.clip((tt - LIGHT_ON) / .6, 0, 1) * .004
mix += (hum * env)[:, None]
# blade swing: soft air swish, then the lock
sw0, sw1 = (63 + 10) / 24, LOCK
n = int((sw1 - sw0) * SR)
swish = bandnoise(n, 900, 5000) * np.sin(np.linspace(0, np.pi, n)) ** 2
place(swish, sw0, .02, pan=.2)
n = int(.25 * SR); k = np.arange(n) / SR
modes = sum(a * np.sin(2 * np.pi * f * k) * np.exp(-k / d) for f, a, d in
            ((3170, 1, .05), (5420, .7, .035), (7950, .45, .022), (1880, .4, .07)))
trans = bandnoise(n, 2500, 12000) * np.exp(-k / .003)
lock = modes * .6 + trans * .7
place(lock / np.abs(lock).max(), LOCK, .22, pan=.15)
place(lock / np.abs(lock).max() * .25, LOCK + .028, .3, pan=.15)   # second detent

# fade in/out and normalise to -1 dBFS peak
mix[:int(.02 * SR)] *= np.linspace(0, 1, int(.02 * SR))[:, None]
mix[-int(.4 * SR):] *= np.linspace(1, 0, int(.4 * SR))[:, None]
mix *= 0.89 / np.abs(mix).max()
with wave.open(f"{OUT}/blade_audio.wav", "w") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok", f"{OUT}/blade_audio.wav")
