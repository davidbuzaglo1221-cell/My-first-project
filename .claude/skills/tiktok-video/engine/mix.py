import json, subprocess
tl = json.load(open('tl.json')); ins, fl = [], []
for i, s in enumerate(tl['scenes']):
    w = json.load(open(f'vo_{i}.json')); d = w[-1]['t'] + w[-1]['d'] + 0.3
    ins += ['-i', f'vo_{i}.mp3']
    ms = int(s['audio']*1000)
    fl.append(f"[{i}:a]atrim=0:{d:.3f},afade=t=out:st={d-0.12:.3f}:d=0.12,aresample=48000,adelay={ms}|{ms}[v{i}]")
n = len(tl['scenes'])
fl.append(''.join(f'[v{i}]' for i in range(n)) + f"amix=inputs={n}:normalize=0,highpass=f=75,equalizer=f=3400:t=q:w=1.2:g=3.5,equalizer=f=9000:t=q:w=1.5:g=2,equalizer=f=220:t=q:w=1:g=-1.5,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=3,apad[vo]")
fl.append("[vo]asplit[vo1][vo2]")
fl.append(f"[{n}:a]volume=0.19,aformat=channel_layouts=stereo[mu]")
fl.append("[mu][vo2]sidechaincompress=threshold=0.03:ratio=4:attack=20:release=400[duck]")
fl.append(f"[vo1][duck]amix=inputs=2:normalize=0,atrim=0:{tl['end']:.3f},loudnorm=I=-14:TP=-1.2:LRA=9,aresample=48000[out]")
cmd = ['ffmpeg','-y','-v','error'] + ins + ['-i','music.wav','-filter_complex',';'.join(fl),'-map','[out]','-ac','2','-c:a','pcm_s16le','audio.wav']
subprocess.check_call(cmd); print('audio ok')
