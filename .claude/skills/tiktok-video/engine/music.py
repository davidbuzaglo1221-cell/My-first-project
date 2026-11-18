import numpy as np, json, wave
c = json.load(open('cuts.json')); SR = 48000; END = c['end']; N = int(SR*END)
t = np.arange(N)/SR
def hz(n): return 440*2**((n-69)/12)
def pad(notes, t0, t1, fade=1.2):
    out = np.zeros(N); a, b = int(t0*SR), int(t1*SR); tt = t[a:b]-t0
    env = np.minimum(1, tt/fade) * np.minimum(1, (t1-t0-tt)/fade)
    for k, n in enumerate(notes):
        f = hz(n)
        for det in (-0.12, 0.12):
            ff = f*2**(det/12/8)
            out[a:b] += (np.sin(2*np.pi*ff*tt + k) + 0.18*np.sin(4*np.pi*ff*tt))*env/(len(notes)*2)
    lfo = 0.85 + 0.15*np.sin(2*np.pi*0.18*t)
    return out*lfo
tw, ou = c['twist'], c['outro']
m  = pad([45,52,57,60,64,71], 0, tw+0.6, 1.5)          # A minor add9 — calm
m += pad([41,48,57,60,64,67], tw-0.1, ou+0.6, 0.5)     # F maj7(9) — the twist
m += pad([36,43,52,55,60,62,67], ou-0.1, END, 0.6)      # C add9 — resolution
# soft low pulse on each cut + glassy tick
for x in c['cuts'][1:]:
    a = int(x*SR); L = int(0.5*SR); tt = np.arange(L)/SR
    if a+L > N: continue
    m[a:a+L] += 0.35*np.sin(2*np.pi*55*tt)*np.exp(-tt*9)
    m[a:a+L] += 0.10*np.sin(2*np.pi*2400*tt)*np.exp(-tt*60)
# twist riser (filtered noise swell into the cut)
rng = np.random.default_rng(1); L = int(1.1*SR); a = int(tw*SR)-L
nz = rng.standard_normal(L); nz = np.convolve(nz, np.ones(24)/24, 'same')
m[a:a+L] += nz*np.linspace(0,1,L)**3*0.5
m = m/np.max(np.abs(m))*0.9
with wave.open('music.wav','wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((m*32767).astype(np.int16).tobytes())
print('ok')
