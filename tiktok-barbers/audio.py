"""Stage 2: original background beat + SFX synthesized from scratch (numpy), timed to the timeline."""
import json, numpy as np, soundfile as sf
SR = 48000; rng = np.random.default_rng(3)
TL = json.load(open('build/timeline.json')); DUR = TL['duration'] + 0.5
N = int(DUR*SR)

def env(n, a=0.002, r=0.1, curve=4):
    t = np.arange(n)/SR; e = np.minimum(1, t/a) * np.exp(-t/r*curve/4)
    return e
def lp(x, fc):  # one-pole lowpass
    a = np.exp(-2*np.pi*fc/SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s = (1-a)*x[i] + a*s; y[i] = s
    return y
def hp(x, fc): return x - lp(x, fc)
def put(buf, x, t, g=1.0):
    i = int(t*SR); j = min(len(buf), i+len(x))
    if i < len(buf): buf[i:j] += g*x[:j-i]

# ---------- drum one-shots ----------
def kick():
    n = int(.45*SR); t = np.arange(n)/SR
    f = 45 + 110*np.exp(-t*28); ph = 2*np.pi*np.cumsum(f)/SR
    x = np.sin(ph)*np.exp(-t*6.5) + 0.25*np.tanh(4*np.sin(ph))*np.exp(-t*30)
    click = hp(rng.standard_normal(n)*np.exp(-t*400), 2000)*0.3
    return np.tanh(1.4*(x+click))
def clap():
    n = int(.3*SR); t = np.arange(n)/SR; nz = rng.standard_normal(n)
    e = sum(np.exp(-np.maximum(0, t-d)*60)*(t >= d) for d in (0, .011, .022)) + np.exp(-t*14)*(t >= .03)
    x = hp(lp(nz, 5000), 900)*e
    return x/np.abs(x).max()
def hat(open_=False):
    n = int((.25 if open_ else .06)*SR); t = np.arange(n)/SR
    x = hp(rng.standard_normal(n), 7000)*np.exp(-t*(12 if open_ else 70))
    return x/np.abs(x).max()
K, C, H, HO = kick(), clap(), hat(), hat(True)

# ---------- harmony: Am - F - C - G ----------
BPM = 96; beat = 60/BPM; bar = 4*beat
roots = [57, 53, 48, 55]   # A3 F3 C3 G3 (midi)
chords = [[57,60,64,69],[53,57,60,65],[48,52,55,60],[55,59,62,67]]
mtof = lambda m: 440*2**((m-69)/12)

def pad_note(freq, dur):
    n = int(dur*SR); t = np.arange(n)/SR; x = np.zeros(n)
    for d in (-0.08, 0, 0.07):                      # detuned saws
        f = freq*2**(d/12); x += 2*((t*f) % 1) - 1
    x = lp(lp(x, 1400), 1800)
    e = np.minimum(1, t/0.35) * np.minimum(1, (dur-t)/0.4).clip(0, 1)
    return x*e/3
def bass808(freq, dur):
    n = int(dur*SR); t = np.arange(n)/SR
    f = freq*(1 + 0.6*np.exp(-t*40)); ph = 2*np.pi*np.cumsum(f)/SR
    x = np.tanh(2.2*np.sin(ph))*np.exp(-t*1.6)*np.minimum(1, (dur-t)/0.05).clip(0, 1)
    return x
def pluck(freq, dur=0.35):
    n = int(dur*SR); t = np.arange(n)/SR
    x = (np.sin(2*np.pi*freq*t) + 0.4*np.sin(4*np.pi*freq*t) + 0.15*np.sin(6*np.pi*freq*t))*np.exp(-t*9)
    return x

music = np.zeros(N); drums = np.zeros(N); padbuf = np.zeros(N); bassbuf = np.zeros(N); lead = np.zeros(N)
start = TL['segments'][0]['chunks'][0]['start'] - 0.05   # beat drops on first spoken word
end = TL['duration'] - 0.6
pad_cache = {}
nb = int((end-start)/bar)+1
for b in range(nb):
    t0 = start + b*bar; ci = b % 4
    key = ci
    if key not in pad_cache: pad_cache[key] = sum(pad_note(mtof(m), bar+0.3) for m in chords[ci])
    put(padbuf, pad_cache[key], t0, 0.9)
    put(bassbuf, bass808(mtof(roots[ci]-24), beat*2.5), t0)
    put(bassbuf, bass808(mtof(roots[ci]-24), beat*1.4), t0+beat*2.5, 0.8)
    for s in range(16):                     # 16th grid
        ts = t0 + s*beat/4
        if s in (0, 7, 10) or (b % 2 == 1 and s == 14): put(drums, K, ts, 0.95)
        if s in (4, 12): put(drums, C, ts, 0.55)
        if s % 2 == 0: put(drums, H, ts, 0.16 if s % 4 else 0.22)
        if b % 4 == 3 and s >= 12: put(drums, H, ts+beat/8, 0.12)   # hat roll
        if s == 14 and b % 2 == 0: put(drums, HO, ts, 0.12)
    # lofi pluck arp
    arp = chords[ci] + [chords[ci][1]+12]
    for k, s in enumerate((0, 3, 6, 8, 11, 14)):
        put(lead, pluck(mtof(arp[k % len(arp)]+12)), t0 + s*beat/4, 0.12)

music = 0.42*padbuf + 0.55*bassbuf + 0.75*drums + 0.5*lead
# fade-in of the groove, fade-out at end
tt = np.arange(N)/SR
music *= np.clip((tt-start+0.01)/0.05, 0, 1) * np.clip((TL['duration']-tt)/1.6, 0, 1)
music = np.tanh(1.2*music)/1.2
sf.write('build/music.wav', np.stack([music, np.roll(music, 12)], 1).astype(np.float32), SR)

# ---------- SFX ----------
def whoosh(dur=0.45, up=True):
    n = int(dur*SR); t = np.arange(n)/SR; nz = rng.standard_normal(n)
    out = np.zeros(n); fc = np.linspace(400, 6000, n) if up else np.linspace(6000, 400, n)
    a_prev = 0.0
    for i in range(n):  # sweeping lowpass
        a = np.exp(-2*np.pi*fc[i]/SR); a_prev = (1-a)*nz[i] + a*a_prev; out[i] = a_prev
    e = np.sin(np.pi*t/dur)**2
    return hp(out, 200)*e/np.abs(out*e).max()
def snip():
    n = int(.12*SR); t = np.arange(n)/SR; x = np.zeros(n)
    for d in (0, .055):
        m = t >= d; tt_ = t[m]-d
        x[m] += hp(rng.standard_normal(m.sum()), 3500)*np.exp(-tt_*160) + 0.5*np.sin(2*np.pi*4200*tt_)*np.exp(-tt_*90)
    return x/np.abs(x).max()
def pop():
    n = int(.12*SR); t = np.arange(n)/SR; f = 900*np.exp(-t*25) + 300
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*35)
def impact():
    n = int(1.4*SR); t = np.arange(n)/SR
    f = 30 + 80*np.exp(-t*10); x = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*2.5)
    x += lp(rng.standard_normal(n), 2500)*np.exp(-t*5)*0.4
    return np.tanh(1.5*x)
def riser(dur=1.2):
    n = int(dur*SR); t = np.arange(n)/SR
    x = hp(rng.standard_normal(n), 1500)*(t/dur)**2 + 0.3*np.sin(2*np.pi*(200*t + 400*t**2/dur))*(t/dur)**2
    return x/np.abs(x).max()
def ding():
    n = int(1.5*SR); t = np.arange(n)/SR
    return sum(a*np.sin(2*np.pi*f*t)*np.exp(-t*d) for f, a, d in ((1318.5, .6, 3), (1975.5, .3, 4), (2637, .15, 6)))

sfx = np.zeros(N); W, Sn, P, I, R, D = whoosh(), snip(), pop(), impact(), riser(0.9), ding()
segs = TL['segments']
put(sfx, R, max(0, segs[0]['chunks'][0]['start'] - 0.9), 0.35)
put(sfx, I, segs[0]['chunks'][0]['start'] - 0.02, 0.6)
put(sfx, P, segs[0]['chunks'][1]['start'], 0.3)
put(sfx, I, segs[0]['chunks'][2]['start'] - 0.02, 0.35)
for s in segs[1:]:
    put(sfx, W, s['start'] - 0.25, 0.32)                 # whoosh on every cut
    if s['kind'] == 'tip':
        put(sfx, Sn, s['chunks'][0]['start'] + 0.02, 0.35)   # scissor snip on number
        put(sfx, P, s['chunks'][1]['start'], 0.22)           # pop when title lands
    else:
        put(sfx, D, s['chunks'][0]['start'], 0.35)
        put(sfx, I, s['chunks'][0]['start'] - 0.02, 0.4)
sf.write('build/sfx.wav', np.stack([sfx, sfx], 1).astype(np.float32), SR)
print('ok', round(DUR, 2))
