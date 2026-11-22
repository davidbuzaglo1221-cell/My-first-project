# Reel 02 "העדר" — dark phonk, 150 BPM (beat = 0.4 s = 12 frames @30fps).
# Real recorded instrument samples (FluidR3 GM soundfont) + 808 + editor SFX.
import numpy as np, mido, subprocess, wave, os
from scipy.signal import butter, sosfilt
SR=48000; BPM=150; B=60/BPM; T=15.0; N=int(SR*T)
TPB=480; q=TPB; s16=TPB//4
os.makedirs('build',exist_ok=True)
def mk(name, events, program=None, ch=0):
    mid=mido.MidiFile(ticks_per_beat=TPB); tr=mido.MidiTrack(); mid.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(BPM)))
    if program is not None: tr.append(mido.Message('program_change',program=program,channel=ch))
    ev=[]
    for (beat,note,vel,dur) in events:
        t=int(round(beat*TPB)); ev.append((t,1,note,vel)); ev.append((t+int(dur*TPB),0,note,0))
    ev.sort(key=lambda e:(e[0],e[1]))
    last=0
    for t,on,note,vel in ev:
        tr.append(mido.Message('note_on' if on else 'note_off',note=note,velocity=vel,channel=ch,time=t-last)); last=t
    mid.save(f'build/{name}.mid')
    subprocess.run(['fluidsynth','-ni','-g','0.9','-r',str(SR),'-F',f'build/{name}.wav','/usr/share/sounds/sf2/FluidR3_GM.sf2',f'build/{name}.mid'],check=True,capture_output=True)
    with wave.open(f'build/{name}.wav') as w:
        a=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,2).astype(float)/32768
    out=np.zeros((N,2)); n=min(N,len(a)); out[:n]=a[:n]; return out
# --- cowbell riff (GM Agogo = pitched bell) ---
riff=[69,None,69,None,72,None,69,None,74,None,72,None,69,None,67,None,
      69,None,69,None,72,None,75,None,74,None,72,None,69,None,None,None]
bell=[]
for bar2 in range(0,36,8):  # 2-bar riff, 8 beats
    for i,n in enumerate(riff):
        b=bar2+i*0.25
        if n and b<34 and not (7<=b<10): bell.append((b,n,112 if i%4==0 else 92,0.22))
cow=mk('bell',bell,program=112)
# --- drums (GM kit) ---
dr=[]
for b0 in np.arange(10,34,4):         # drop: beats 10..34, halftime feel
    for k in (0,1.5,2.75): dr.append((b0+k,36,127,0.2))
    dr.append((b0+2,39,120,0.2)); dr.append((b0+2,38,90,0.2))
    for h in range(16):
        b=b0+h*0.25; vel=100 if h%2==0 else 70
        if h in (13,14,15) and int(b0)%8==2:            # triplet roll
            for t3 in range(3): dr.append((b0+3.25+ (h-13)*0.25 + t3*0.0833,42,85,0.05))
        else: dr.append((b,42,vel,0.05))
    dr.append((b0+3.5,46,80,0.2))
for b in np.arange(0,7,0.5): dr.append((b,42,50 if b%1 else 70,0.05))   # intro ticks
dr.append((0,49,90,1.0))                                    # crash on first frame
dr.append((34,49,110,2.0)); dr.append((34,36,127,0.3))      # final hit
drums=mk('drums',[(b,n,v,d) for b,n,v,d in dr],ch=9)
# --- 808 (sine with glide, saturated) ---
b808=np.zeros((N,2))
roots=[45,45,48,43,45,45,48,43]   # A1 A1 C2 G1
def m2f(m): return 440*2**((m-69)/12)
for i,b0 in enumerate(np.arange(10,34,4)):
    for k,dur in ((0,1.4),(1.5,1.2),(2.75,1.2)):
        t0=(b0+k)*B; n=int(dur*B*SR); t=np.arange(n)/SR
        f=m2f(roots[i%8])*(1+0.6*np.exp(-t*30))
        if k==2.75 and i%2: f=f*np.where(t>0.15,1.12246,1)  # little glide up
        s=np.tanh(2.2*np.sin(2*np.pi*np.cumsum(f)/SR))*np.exp(-t*1.8)*0.55
        j=int(t0*SR); e=min(N,j+n); b808[j:e]+=s[:e-j,None]
b808[int(34*B*SR):int(34*B*SR)+int(1.6*SR)]+=0  # (final 808 below)
t=np.arange(int(1.6*SR))/SR; s=np.tanh(2.5*np.sin(2*np.pi*np.cumsum(55*(1+0.8*np.exp(-t*25)))/SR))*np.exp(-t*1.6)*0.7
j=int(34*B*SR); e=min(N,j+len(s)); b808[j:e]+=s[:e-j,None]
# --- intro: bell through a lowpass (muffled, "from the next room") ---
def lp(x,fc): return sosfilt(butter(4,fc,'low',fs=SR,output='sos'),x,axis=0)
cut=int(10*B*SR)
cow[:cut]=lp(cow[:cut],1100)*1.0
mix=cow*1.8+drums*1.3+b808*0.5
# sidechain duck on kicks
duck=np.ones(N)
for b,n,v,d in dr:
    if n==36 and b>=10:
        j=int(b*B*SR); L=int(0.18*SR); e=min(N,j+L); duck[j:e]=np.minimum(duck[j:e],1-0.45*np.exp(-np.arange(e-j)/SR*18)[::-1][::-1])
mix[:,0]*=duck; mix[:,1]*=duck
# --- tape stop (beats 7..8 = 2.8 s..3.2 s), then silence until the drop ---
a,bb=int(2.8*SR),int(3.2*SR); seg=mix[a-int(0.8*SR):bb].copy()
L=bb-a; rate=np.linspace(1,0.05,L); pos=np.cumsum(rate)+0.8*SR
pos=np.clip(pos,0,len(seg)-2); i0=pos.astype(int); fr=pos-i0
mix[a:bb]=(seg[i0]*(1-fr)[:,None]+seg[i0+1]*fr[:,None])*np.linspace(1,0.2,L)[:,None]
mix[bb:int(4.0*SR)]=0
rng=np.random.default_rng(3)
def add(sig,tsec,g=1.0,pan=0.0):
    j=int(tsec*SR); e=min(N,j+len(sig)); mix[j:e,0]+=sig[:e-j]*g*(1-max(pan,0)); mix[j:e,1]+=sig[:e-j]*g*(1+min(pan,0))
# vinyl crackle bed (whole clip, stronger in the silence)
cr=np.zeros(N); idx=rng.integers(0,N,2600); cr[idx]=rng.standard_normal(2600)*rng.random(2600)**3
cr=sosfilt(butter(2,[1500,9000],'band',fs=SR,output='sos'),cr)*1.4
hiss=sosfilt(butter(2,4000,'high',fs=SR,output='sos'),rng.standard_normal(N))*0.006
bed=cr+hiss; bed[int(3.2*SR):int(4.0*SR)]*=2.2
mix+=bed[:,None]
# typewriter keys for the opening line (frames 6..36)
def click(g=1.0):
    n=int(0.035*SR); t=np.arange(n)/SR
    x=rng.standard_normal(n)*np.exp(-t*260)+0.5*np.sin(2*np.pi*1900*t)*np.exp(-t*400)
    return sosfilt(butter(2,600,'high',fs=SR,output='sos'),x)*0.35*g
for fr_ in range(6,38,2): add(click(0.7+0.5*rng.random()),fr_/30+rng.random()*0.01,1.0,(rng.random()-0.5)*0.4)
# camera shutter on the three "אותו" cards (frames 48,60,72)
def shutter():
    s=np.zeros(int(0.12*SR)); c1=click(1.6); s[:len(c1)]+=c1; c2=click(1.2); o=int(0.06*SR); s[o:o+len(c2)]+=c2; return s
for f in (48,60,72): add(shutter(),f/30,1.0)
# marker scribble (circle at frame 100, strike at frame 180)
def scribble(dur):
    n=int(dur*SR); t=np.arange(n)/SR; x=rng.standard_normal(n)
    x=sosfilt(butter(2,[2500,7000],'band',fs=SR,output='sos'),x)
    am=0.55+0.45*np.sin(2*np.pi*9*t)**2; return x*am*np.minimum(t/0.02,1)*np.minimum((dur-t)/0.03,1)*0.5
add(scribble(0.55),100/30,1.0,0.2); add(scribble(0.35),180/30,1.0,-0.2); add(scribble(0.45),192/30,0.8)
# whoosh into the zoom (frames 110..120) and sub drop at the drop
def whoosh(dur):
    n=int(dur*SR); t=np.arange(n)/SR; x=rng.standard_normal(n); out=np.zeros(n)
    for k in range(0,n,1024):
        fc=300+6000*(k/n)**2; out[k:k+1024]=sosfilt(butter(2,[fc,fc*1.6+50],'band',fs=SR,output='sos'),x[k:k+1024])
    return out*np.sin(np.pi*t/dur)**2*1.6
add(whoosh(0.4),3.65,0.9)
# final: vinyl stop after the last hit (13.6 s + 0.9)
a=int(14.3*SR); seg=mix[a:].copy(); L=len(seg); pos=np.cumsum(np.linspace(1,0.0,L)); pos=np.clip(pos,0,L-2)
i0=pos.astype(int); mix[a:]=seg[i0]*np.linspace(1,0,L)[:,None]
# master
mix=np.tanh(mix*1.3)/np.tanh(1.3)
mix=mix/np.max(np.abs(mix))*0.9
with wave.open('public/music_raw.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype('<i2').tobytes())
