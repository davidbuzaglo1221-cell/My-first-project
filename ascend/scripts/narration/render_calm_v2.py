"""Guided practices and the thirty program days, rebuilt with real recorded music under the voice.

- Voice: Maya (Edge, cached) for every item, except items with a human-sounding ElevenLabs take supplied by David
  (VOICE_TAKES), which are cut into lines by word timestamps and placed on the same timeline of written silences.
- Bed: "Dreams Become Real" by Kevin MacLeod (incompetech.com, CC BY 4.0): recorded strings and pads, a different
  passage per item, ducked under the voice, faded in and out. Replaces the old filtered brown noise.
- Bell: a modelled singing bowl (inharmonic partials of a real bowl with slow beating and a soft mallet strike),
  replacing the old pure harmonic sine bell.
Usage: python3 render_calm_v2.py [id-prefix]
"""
import json, os, re, subprocess, sys
import numpy as np

sys.path.insert(0, '/home/user/tts')
import render_edge as R  # noqa: E402

OUT = '/home/user/My-first-project/ascend/public/audio/calm'
MUSIC = os.environ.get('CALM_MUSIC', '/home/user/My-first-project/ascend/scripts/narration/assets/dreams-become-real.mp3')
SR = 24000
RATE = '-12%'
VOICE = 'maya'
# id -> (audio file of an ElevenLabs take, voice label, start/end of speech in that file)
VOICE_TAKES = json.load(open(os.path.join(os.path.dirname(__file__), 'assets', 'takes.json')))

items = [it for it in json.load(open('/home/user/tts/calm.json')) if it['id'].startswith(sys.argv[1] if len(sys.argv) > 1 else '')]


def bowl(seconds=7.0, f0=262.0, level=0.16):
    """A struck singing bowl: partials at a real bowl's ratios, each a slightly detuned pair (the beating),
    with a short felt-mallet transient."""
    t = np.arange(int(SR * seconds)) / SR
    out = np.zeros_like(t)
    for ratio, amp, decay, beat in [(1.0, 1.0, 0.35, 1.3), (2.71, 0.55, 0.6, 2.1), (5.15, 0.28, 1.1, 3.4), (8.43, 0.12, 1.9, 4.6), (12.4, 0.05, 3.2, 6.0)]:
        f = f0 * ratio
        out += amp * np.exp(-t * decay) * (np.sin(2 * np.pi * f * t) + 0.85 * np.sin(2 * np.pi * (f + beat) * t + 0.7))
    strike = np.random.default_rng(3).normal(0, 1, len(t)) * np.exp(-t * 60)
    strike = np.convolve(strike, np.ones(18) / 18, mode='same')
    out = out / np.max(np.abs(out)) * 0.9 + strike * 0.25
    attack = np.minimum(1, t / 0.004)
    return (out * attack * level).astype(np.float32)


def load_pcm(path, start=None, end=None):
    cmd = ['ffmpeg', '-loglevel', 'error']
    if start is not None:
        cmd += ['-ss', f'{start:.3f}', '-t', f'{end - start:.3f}']
    cmd += ['-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).copy()


def take_lines(it):
    """Cut an ElevenLabs take into the item's spoken lines, by word timestamps (cached)."""
    take = VOICE_TAKES[it['id']]
    cache = os.path.join(os.path.dirname(__file__), 'assets', f"{it['id']}.cuts.json")
    lines = [l for l in it['lines'] if not l.startswith('~')]
    if not os.path.exists(cache):
        from faster_whisper import WhisperModel
        m = WhisperModel('ivrit-ai/whisper-large-v3-turbo-ct2', device='cpu', compute_type='int8')
        a = load_pcm(take['file'])
        a16 = np.interp(np.arange(0, len(a), SR / 16000), np.arange(len(a)), a).astype(np.float32)
        words = [w for s in m.transcribe(a16, language='he', beam_size=5, word_timestamps=True)[0] for w in s.words]
        counts = [len(re.findall(r'[א-ת]+', l)) for l in lines]
        bounds, k = [], 0
        for i, n in enumerate(counts):
            ws = words[k:k + n] if i < len(counts) - 1 else words[k:]
            bounds.append([ws[0].start, ws[-1].end])
            k += n
        # snap each cut to the middle of the silence between lines
        for i in range(len(bounds) - 1):
            mid = (bounds[i][1] + bounds[i + 1][0]) / 2
            bounds[i][1] = min(bounds[i][1] + 0.12, mid)
            bounds[i + 1][0] = max(bounds[i + 1][0] - 0.08, mid)
        json.dump(bounds, open(cache, 'w'))
    bounds = json.load(open(cache))
    out = []
    for b in bounds:
        w = load_pcm(take['file'], b[0], b[1])
        f = int(0.012 * SR)
        w[:f] *= np.linspace(0, 1, f)
        w[-f:] *= np.linspace(1, 0, f)
        out.append(w)
    return out


rate = lambda it: '+0%' if it['id'].startswith('day-') else RATE
pending = [it for it in items if it['id'] not in VOICE_TAKES]
import asyncio  # noqa: E402
asyncio.run(R.synth_all({VOICE: [(l, rate(it)) for it in pending for l in it['lines'] if not l.startswith('~')]}))

music_len = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', MUSIC], capture_output=True, text=True).stdout)
for n, it in enumerate(items):
    day = it['id'].startswith('day-')
    takes = take_lines(it) if it['id'] in VOICE_TAKES else None
    chunks = [bowl(), np.zeros(int(0.6 * SR), np.float32)]
    cur = sum(len(c) for c in chunks) / SR
    segs, li = [], 0
    for line in it['lines']:
        if line.startswith('~'):
            sec = float(line[1:].strip() or 3)
            chunks.append(np.zeros(int(sec * SR), np.float32)); cur += sec
            continue
        if takes is not None:
            w = takes[li]
        else:
            w = R.pcm(R.key(VOICE, line, rate(it)))
            w = R.liven(w, SR, VOICE) if day else w
        li += 1
        segs.append({'t': round(cur, 2), 'text': line})
        chunks.append(w); cur += len(w) / SR
        gap = 0.6 if day else 1.1
        chunks.append(np.zeros(int(gap * SR), np.float32)); cur += gap
    chunks += [np.zeros(int(1.5 * SR), np.float32), bowl()]
    cur += 1.5 + 7.0
    raw = f"{OUT}/{it['id']}.f32"
    np.concatenate(chunks).astype(np.float32).tofile(raw)
    # a different passage of the music per item, wrapped if needed
    off = (n * 37.0) % max(1.0, music_len - cur - 2) if music_len > cur + 2 else 0.0
    bed = 0.85 if not day else 0.45
    vchain = R.CHAIN if takes is None else 'highpass=f=60,acompressor=threshold=-20dB:ratio=2:attack=10:release=200:makeup=1,loudnorm=I=-16:TP=-1.5:LRA=9'
    subprocess.run([
        'ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', raw,
        '-stream_loop', '-1', '-ss', f'{off:.2f}', '-i', MUSIC,
        '-filter_complex',
        f"[0]{vchain},asplit=2[v][sc];"
        f"[1]aresample={SR},pan=mono|c0=0.5*c0+0.5*c1,atrim=0:{cur:.2f},lowpass=f=6000,volume={bed},"
        f"afade=t=in:d=4,afade=t=out:st={max(0, cur - 6):.2f}:d=6[m];"
        f"[m][sc]sidechaincompress=threshold=0.04:ratio=3:attack=60:release=900[md];"
        f"[v][md]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-17:TP=-1.5:LRA=11[out]",
        '-map', '[out]', '-ar', str(SR), '-ac', '1', '-b:a', '64k', f"{OUT}/{it['id']}.mp3"], check=True)
    os.remove(raw)
    voice = VOICE_TAKES[it['id']]['voice'] if it['id'] in VOICE_TAKES else 'calm'
    json.dump({'duration': round(cur, 2), 'segments': segs, 'voice': voice}, open(f"{OUT}/{it['id']}.json", 'w'), ensure_ascii=False)
    print(it['id'], f'{cur:.0f}s', voice, flush=True)
