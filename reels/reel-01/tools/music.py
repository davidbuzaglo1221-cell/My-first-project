# 15 s original beat, 120 BPM (beat = 0.5 s = 15 frames @30fps). Drop at 3.0 s.
import numpy as np, wave
SR=48000; T=15.0; N=int(SR*T); BPM=120; B=60/BPM
L=np.zeros(N); R=np.zeros(N); rng=np.random.default_rng(7)
def add(sig,t,g=1.0,pan=0.0):
    i=int(t*SR); j=min(N,i+len(sig)); s=sig[:j-i]*g
    L[i:j]+=s*(1-max(pan,0)); R[i:j]+=s*(1+min(pan,0))
def env(n,a=0.002,d=0.2):
    t=np.arange(n)/SR; return np.minimum(t/a,1)*np.exp(-t/d)
def kick(): # 808-ish
    n=int(0.6*SR); t=np.arange(n)/SR; f=45+120*np.exp(-t*28)
    s=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*4.5); s+=0.3*np.tanh(4*s); return np.tanh(1.6*s)
def snare():
    n=int(0.25*SR); t=np.arange(n)/SR; nz=rng.standard_normal(n)
    nz=np.convolve(nz,[1,-0.9],'same'); return 0.6*nz*np.exp(-t*18)+0.5*np.sin(2*np.pi*190*t)*np.exp(-t*30)
def clap():
    n=int(0.2*SR); t=np.arange(n)/SR; nz=np.convolve(rng.standard_normal(n),[1,-0.95],'same')
    e=sum(np.exp(-np.maximum(t-o,0)*60)*(t>=o) for o in (0,0.01,0.02))*0.4+np.exp(-t*14)*(t>0.02)
    return nz*e*0.5
def hat(open_=False):
    n=int((0.18 if open_ else 0.05)*SR); t=np.arange(n)/SR
    nz=np.diff(rng.standard_normal(n+1)); return nz*np.exp(-t*(15 if open_ else 80))*0.35
def whoosh(dur=0.5,up=True):
    n=int(dur*SR); t=np.arange(n)/SR; nz=rng.standard_normal(n)
    # sweeping band via moving average difference
    out=np.zeros(n); k=np.linspace(40,4,n) if up else np.linspace(4,40,n)
    c=np.cumsum(nz); 
    for idx in range(0,n,256):
        w=int(k[idx]); seg=slice(idx,min(n,idx+256))
        out[seg]=(c[seg]-np.roll(c,w)[seg])/w
    out-=np.convolve(out,np.ones(200)/200,'same')
    e=np.sin(np.pi*t/dur)**2 if up else np.exp(-t*6)
    return out*e*1.2
def riser(dur):
    n=int(dur*SR); t=np.arange(n)/SR; f=200*np.exp(t/dur*np.log(12))
    s=np.sign(np.sin(2*np.pi*np.cumsum(f)/SR))*0.12+rng.standard_normal(n)*0.15*(t/dur)
    return s*(t/dur)**2
def bass(f,dur):
    n=int(dur*SR); t=np.arange(n)/SR
    s=np.sin(2*np.pi*f*t)+0.3*np.sin(2*np.pi*2*f*t); return np.tanh(2*s)*env(n,0.005,dur*0.8)*0.5
def stab(fs,dur=0.22):
    n=int(dur*SR); t=np.arange(n)/SR; s=sum(np.sign(np.sin(2*np.pi*f*t))*0.5+np.sin(2*np.pi*f*1.005*t) for f in fs)
    s=np.convolve(s,np.ones(6)/6,'same'); return s*env(n,0.003,0.09)*0.12
def impact():
    n=int(1.2*SR); t=np.arange(n)/SR; s=np.sin(2*np.pi*(38+60*np.exp(-t*10))*t)*np.exp(-t*2.5)
    s+=rng.standard_normal(n)*np.exp(-t*7)*0.4; return np.tanh(1.5*s)
K,S,C,IMP=kick(),snare(),clap(),impact()
# Intro 0-3s: tension — tick hats, low drone, riser into drop
for i in range(12): add(hat(), i*B/2, 0.5 if i%2 else 0.8, 0.3)
add(K,0.0,0.9); add(IMP,0.0,0.7)          # hook hit on frame 0
add(K,1.0,0.7); add(C,1.5,0.5)
add(riser(1.5),1.5,0.9); add(whoosh(0.5,True),2.5,0.9)
# Drop 3.0 - 13.0
DROP=3.0
add(IMP,DROP,1.0)
notes=[55,55,65.4,49]  # A1 A1 C2 G1 (Am feel)
for bar in range(5):
    t0=DROP+bar*4*B
    for b in range(4):
        tb=t0+b*B
        if b in (0,) or (b==2 and bar%2==1): add(K,tb,1.0)
        if b in (1,3): add(S,tb,0.55); add(C,tb,0.45)
        for h in range(4):
            add(hat(open_=(h==2 and b==3)), tb+h*B/4, 0.45 if h%2 else 0.65, -0.3)
    add(bass(notes[bar%4],4*B*0.95),t0,1.0)
    for st in (0,0.75,1.5,2.5,3.0):
        f=notes[bar%4]*4; add(stab([f,f*1.19,f*1.5]), t0+st*B, 1.0, 0.2)
    add(K,t0+3.75*B,0.6)
# short stop for "זה לא עוד תספורת" at 11.0 s then hit at 11.5
add(whoosh(0.5,True),12.5,0.8)
# Outro 13-15: brand hit + tail
add(IMP,13.0,1.0); add(K,13.0,1.0); add(C,13.5,0.4); add(K,14.0,0.6)
for i in range(8): add(hat(), 13+i*B/4, 0.3)
# per-cut whooshes on the drop section (every beat 3..11)
for k in range(int((11-3)/B)):
    add(whoosh(0.18,False), DROP+k*B, 0.35, 0.5 if k%2 else -0.5)
# sidechain-ish pump
mix=np.stack([L,R],1)
peak=np.max(np.abs(mix)); mix=np.tanh(mix/peak*1.6)/np.tanh(1.6)*0.89
fade=np.ones(N); fl=int(0.4*SR); fade[-fl:]=np.linspace(1,0,fl); mix*=fade[:,None]
pcm=(mix*32767).astype('<i2')
with wave.open('public/music_raw.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
