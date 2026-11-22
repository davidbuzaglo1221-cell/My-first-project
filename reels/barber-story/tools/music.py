# Barber story — 30 s, 120 BPM (beat = 0.5 s = 15 frames). Real-sample piano/strings/drums (FluidR3 GM) + foley.
# Acts: hook 0-3 | mistakes 3-10 (sparse piano) | mentor 10-14 (strings enter) | practice 14-21 (drums build)
#       | transformation 21-26 (hit, full band, lift to C major) | payoff 26-30 (ring out)
import numpy as np, mido, subprocess, wave, os
from scipy.signal import butter, sosfilt
SR=48000; BPM=120; B=0.5; T=30.0; N=int(SR*T); TPB=480
os.makedirs('build',exist_ok=True)
def render(name, events, program=None, ch=0, rev=60):
    mid=mido.MidiFile(ticks_per_beat=TPB); tr=mido.MidiTrack(); mid.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(BPM)))
    if program is not None: tr.append(mido.Message('program_change',program=program,channel=ch))
    tr.append(mido.Message('control_change',control=91,value=rev,channel=ch))
    ev=[]
    for b,n,v,d in events: ev+=[(int(b*TPB),1,n,v),(int((b+d)*TPB),0,n,0)]
    ev.sort(key=lambda e:(e[0],e[1])); last=0
    for t,on,n,v in ev:
        tr.append(mido.Message('note_on' if on else 'note_off',note=n,velocity=v,channel=ch,time=t-last)); last=t
    mid.save(f'build/{name}.mid')
    subprocess.run(['fluidsynth','-ni','-g','0.8','-r',str(SR),'-F',f'build/{name}.wav','/usr/share/sounds/sf2/FluidR3_GM.sf2',f'build/{name}.mid'],check=True,capture_output=True)
    with wave.open(f'build/{name}.wav') as w: a=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,2)/32768
    o=np.zeros((N,2)); n=min(N,len(a)); o[:n]=a[:n]; return o
sec=lambda s: s/B  # seconds -> beats
# chords per 2 s (4 beats)
minor=[[45,57,60,64],[41,53,57,60],[48,55,60,64],[43,55,59,62]]   # Am F C G
major=[[48,55,60,64],[43,55,59,62],[45,57,60,64],[41,53,57,65]]   # C G Am F (lift)
piano=[]; strings=[]; bass=[]
# mistakes 3-10 s: sparse broken piano
for i,b0 in enumerate(np.arange(sec(3),sec(10),4)):
    c=minor[i%4]
    for k,n in enumerate(c[1:]): piano.append((b0+k*0.75,n+12,58,1.4))
    piano.append((b0,c[0]+12,50,3.5))
# mentor 10-14 s: piano + strings enter
for i,b0 in enumerate(np.arange(sec(10),sec(14),4)):
    c=minor[(i+1)%4]
    for k,n in enumerate(c[1:]): piano.append((b0+k*0.5,n+12,64,1.0))
    for n in c[1:]: strings.append((b0,n,62,3.9))
# practice 14-21 s: eighth-note piano drive + strings + bass
for i,b0 in enumerate(np.arange(sec(14),sec(21),4)):
    c=minor[i%4]
    for k in range(8): piano.append((b0+k*0.5,c[1+k%3]+12,60+k*2,0.45))
    for n in c[1:]: strings.append((b0,n+12 if i>=2 else n,70,3.9))
    bass.append((b0,c[0]-12,90,1.8)); bass.append((b0+2,c[0]-12,85,1.8))
# transformation 21-26 s: lift to major, full
for i,b0 in enumerate(np.arange(sec(21),sec(26),4)):
    c=major[i%4]
    for k in range(8): piano.append((b0+k*0.5,c[1+k%3]+24 if k%2 else c[1+k%3]+12,78,0.45))
    for n in c[1:]: strings.append((b0,n+12,88,3.9)); strings.append((b0,n,80,3.9))
    bass.append((b0,c[0]-12,105,1.8)); bass.append((b0+2,c[0]-12,100,1.8))
# payoff 26-30: final C chord rings
for n in [48,55,60,64,67,72]: piano.append((sec(26),n,85,6)); strings.append((sec(26),n,80,7))
bass.append((sec(26),36,110,6))
P=render('piano',piano,program=0,rev=70); S=render('strings',strings,program=48,ch=1,rev=90); Bs=render('bass',bass,program=33,ch=2,rev=30)
dr=[]
for b in np.arange(sec(14),sec(21),1):        # build: kick on beats, hats 8ths, clap on 2/4 from 17 s
    dr.append((b,36,100,0.2)); dr.append((b+0.5,42,60,0.05))
    if b>=sec(17) and int(b)%2==1: dr.append((b,39,95,0.2))
for i in range(8): dr.append((sec(20)+i*0.25,38,60+i*8,0.1))   # snare roll into the drop
dr.append((sec(21),49,120,2)); dr.append((sec(21),36,127,0.3))
for b in np.arange(sec(21),sec(26),1):
    dr.append((b,36,115,0.2)); dr.append((b+0.5,42,75,0.05)); dr.append((b+0.75,42,55,0.05))
    if int(b)%2==1: dr.append((b,39,110,0.2)); dr.append((b,38,90,0.2))
dr.append((sec(26),49,110,3)); dr.append((sec(26),36,127,0.3))
D=render('drums',dr,ch=9,rev=25)
mix=P*1.0+S*0.9+Bs*0.9+D*1.15
rng=np.random.default_rng(21)
def add(sig,t,g=1.0,pan=0.0):
    j=int(t*SR); e=min(N,j+len(sig)); mix[j:e,0]+=sig[:e-j]*g*(1-max(pan,0)); mix[j:e,1]+=sig[:e-j]*g*(1+min(pan,0))
def bp(x,lo,hi): return sosfilt(butter(2,[lo,hi],'band',fs=SR,output='sos'),x)
def clipper(dur,amp=0.25):
    n=int(dur*SR); t=np.arange(n)/SR
    hum=np.sign(np.sin(2*np.pi*120*t))*0.5+np.sin(2*np.pi*240*t)*0.3
    buzz=bp(rng.standard_normal(n),1800,5200)*(0.6+0.4*np.sin(2*np.pi*120*t))
    env=np.minimum(t/0.04,1)*np.minimum((dur-t)/0.08,1)
    return bp(hum,150,3000)*0.6*env*amp+buzz*env*amp*0.5
def tapestop(t0,dur=0.45):
    a=int(t0*SR); L=int(dur*SR); seg=mix[a-int(0.6*SR):a+L].copy()
    pos=np.cumsum(np.linspace(1,0.05,L))+0.6*SR; pos=np.clip(pos,0,len(seg)-2).astype(int)
    mix[a:a+L]=seg[pos]*np.linspace(1,0,L)[:,None]
def doorbell():
    n=int(1.2*SR); t=np.arange(n)/SR
    return sum(np.sin(2*np.pi*f*t)*np.exp(-t*4)*g for f,g in ((1320,0.4),(1760,0.3),(2640,0.15)))*0.35
def sweep():
    n=int(0.5*SR); t=np.arange(n)/SR; return bp(rng.standard_normal(n),900,5000)*np.sin(np.pi*t/0.5)**2*0.3
def whoosh(dur):
    n=int(dur*SR); t=np.arange(n)/SR; x=rng.standard_normal(n); o=np.zeros(n)
    for k in range(0,n,1024):
        fc=300+5000*(k/n)**2; o[k:k+1024]=sosfilt(butter(2,[fc,fc*1.6+60],'band',fs=SR,output='sos'),x[k:k+1024])
    return o*np.sin(np.pi*t/dur)**2*1.4
def shutter():
    n=int(0.12*SR); s=np.zeros(n)
    for o,g in ((0,1.2),(0.055,0.9)):
        m=int(0.03*SR); t=np.arange(m)/SR; c=sosfilt(butter(2,800,'high',fs=SR,output='sos'),rng.standard_normal(m)*np.exp(-t*280))*0.3*g
        j=int(o*SR); s[j:j+m]+=c
    return s
def thud():
    n=int(0.6*SR); t=np.arange(n)/SR; return np.sin(2*np.pi*(50+40*np.exp(-t*12))*t)*np.exp(-t*6)*0.6
# hook: clipper running, gouge, then a tape stop on the bad reveal
add(clipper(1.7),0.0,1.0); tapestop(1.75); mix[int(2.2*SR):int(3.0*SR)]*=0.0
add(thud(),2.2,0.9)
add(clipper(0.9,0.32),3.0,1.0,0.2)            # the gouge close-up
add(doorbell(),5.1,1.0,-0.3)                   # client walks out
for t in (7.2,7.8,8.5,9.1): add(sweep(),t,1.0,0.3)
add(whoosh(0.6),9.6,0.7)
add(clipper(1.6,0.18),11.6,1.0,-0.2)           # hands guided
for t in np.arange(14,21,1.0): add(shutter(),t,0.8)  # montage cuts
add(whoosh(0.8),20.2,1.0)
fade=np.ones(N); L=int(1.2*SR); fade[-L:]=np.linspace(1,0,L)**1.4; mix*=fade[:,None]
mix=np.tanh(mix*1.1)/np.tanh(1.1); mix=mix/np.max(np.abs(mix))*0.9
with wave.open('public/music_raw.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype('<i2').tobytes())
