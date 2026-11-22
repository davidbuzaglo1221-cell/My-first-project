# Reel 03 — editorial. 120 BPM (beat = 15 frames), 7 s. Real-sample Rhodes + deep-house drums, vinyl, shutter foley.
import numpy as np, mido, subprocess, wave, os
from scipy.signal import butter, sosfilt
SR=48000; BPM=120; B=0.5; T=7.0; N=int(SR*T); TPB=480
os.makedirs('build',exist_ok=True)
def render(name, events, program=None, ch=0):
    mid=mido.MidiFile(ticks_per_beat=TPB); tr=mido.MidiTrack(); mid.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(BPM)))
    if program is not None: tr.append(mido.Message('program_change',program=program,channel=ch))
    tr.append(mido.Message('control_change',control=91,value=70,channel=ch))  # reverb
    ev=[]
    for b,n,v,d in events: ev+= [(int(b*TPB),1,n,v),(int((b+d)*TPB),0,n,0)]
    ev.sort(key=lambda e:(e[0],e[1])); last=0
    for t,on,n,v in ev:
        tr.append(mido.Message('note_on' if on else 'note_off',note=n,velocity=v,channel=ch,time=t-last)); last=t
    mid.save(f'build/{name}.mid')
    subprocess.run(['fluidsynth','-ni','-g','0.9','-r',str(SR),'-F',f'build/{name}.wav','/usr/share/sounds/sf2/FluidR3_GM.sf2',f'build/{name}.mid'],check=True,capture_output=True)
    with wave.open(f'build/{name}.wav') as w: a=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,2)/32768
    o=np.zeros((N,2)); n=min(N,len(a)); o[:n]=a[:n]; return o
# chords: Am9 (beats 0-4), Fmaj7 (4-8), Am9 (8-12), Em7 (12-14)
ch=[]
for b0,notes in ((0,[57,60,64,67,71]),(4,[53,57,60,64,69]),(8,[57,60,64,67,71]),(12,[52,55,59,62,67])):
    for i,n in enumerate(notes): ch.append((b0+0.03*i,n,72,3.6 if b0<12 else 2))
    ch.append((b0+2.5,notes[-1]+12,50,0.4))
keys=render('keys',ch,program=4)
dr=[]
for b in range(2,14):                 # drums enter after the first two beats
    dr.append((b,36,105,0.2))
    if b%2==1: dr.append((b,39,60,0.1))
    dr.append((b+0.5,42,62,0.05)); dr.append((b+0.25,70,40,0.05)); dr.append((b+0.75,70,45,0.05))
drums=render('drums',dr,ch=9)
mix=keys*1.0+drums*1.1
# warm it: gentle lowpass on keys feel, tape saturation
mix=sosfilt(butter(2,9000,'low',fs=SR,output='sos'),mix,axis=0)
rng=np.random.default_rng(11)
cr=np.zeros(N); idx=rng.integers(0,N,900); cr[idx]=rng.standard_normal(900)*rng.random(900)**3
cr=sosfilt(butter(2,[1500,8000],'band',fs=SR,output='sos'),cr)*1.0
mix+=cr[:,None]+sosfilt(butter(2,4000,'high',fs=SR,output='sos'),rng.standard_normal(N))[:,None]*0.004
def click(g):
    n=int(0.03*SR); t=np.arange(n)/SR; x=rng.standard_normal(n)*np.exp(-t*280)
    return sosfilt(butter(2,800,'high',fs=SR,output='sos'),x)*0.3*g
def shutter(t):
    for o,g in ((0,1.4),(0.055,1.0)):
        c=click(g); j=int((t+o)*SR); mix[j:j+len(c)]+=c[:,None]
for f in (60,105,150): shutter(f/30-0.01)
fade=np.ones(N); L=int(0.8*SR); fade[-L:]=np.linspace(1,0,L)**1.5; mix*=fade[:,None]
mix=np.tanh(mix*1.2)/np.tanh(1.2); mix=mix/np.max(np.abs(mix))*0.9
with wave.open('public/music_raw.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype('<i2').tobytes())
