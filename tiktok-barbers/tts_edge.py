"""Stage 1 (v2): Hebrew narration with Microsoft neural voice he-IL-AvriNeural (native Israeli, mature male).
Synthesizes chunk by chunk, keeps exact per-word timings (WordBoundary) for caption sync,
and writes build/voice_raw.wav + build/timeline.json.
Usage: python3 tts_edge.py [VOICE] [RATE]
"""
import asyncio, io, json, os, re, subprocess, sys
import numpy as np, soundfile as sf
import edge_tts

VOICE = sys.argv[1] if len(sys.argv) > 1 else 'he-IL-AvriNeural'
RATE = sys.argv[2] if len(sys.argv) > 2 else '+6%'
SR = 48000
PROXY = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
S = json.load(open('script.json'))

async def synth(text):
    com = edge_tts.Communicate(text, VOICE, rate=RATE, boundary='WordBoundary', proxy=PROXY)
    mp3, words = bytearray(), []
    async for ev in com.stream():
        if ev['type'] == 'audio': mp3 += ev['data']
        elif ev['type'] == 'WordBoundary':
            words.append((ev['text'], ev['offset'] / 1e7, (ev['offset'] + ev['duration']) / 1e7))
    pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', '-', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         input=bytes(mp3), capture_output=True, check=True).stdout
    return np.frombuffer(pcm, np.float32).copy(), words

def trim(w, words):
    a = np.abs(w); thr = 0.01 * a.max(); idx = np.where(a > thr)[0]
    s0 = max(0, idx[0] - int(0.03 * SR)); s1 = min(len(w), idx[-1] + int(0.06 * SR))
    off = s0 / SR
    return w[s0:s1], [(t, max(0, a_ - off), max(0, b - off)) for t, a_, b in words]

def strip_nikud(s): return re.sub(r'[֑-ׇ]', '', s)

async def main():
    audio, segments, t = [], [], 0.0
    def sil(sec):
        nonlocal t; audio.append(np.zeros(int(sec * SR), np.float32)); t += sec
    async def segment(kind, idx, says, gaps, lead):
        nonlocal t
        sil(lead); seg = {'kind': kind, 'index': idx, 'start': t, 'chunks': []}
        for i, s in enumerate(says):
            w, words = await synth(s)
            w, words = trim(w, words)
            shown = strip_nikud(s)
            seg['chunks'].append({'text': shown, 'start': t, 'end': t + len(w) / SR,
                                  'words': [[strip_nikud(x), t + a, t + b] for x, a, b in words]})
            audio.append(w); t += len(w) / SR
            sil(gaps[i])
        seg['end'] = t; segments.append(seg)
    await segment('hook', 0, S['hook']['say'], [0.3, 0.25, 0.5], 0.35)
    for n, tip in enumerate(S['tips'], 1):
        await segment('tip', n, tip['say'], [0.1, 0.18, 0.38], 0.15)
        print('tip', n, round(t, 1), flush=True)
    await segment('cta', 0, S['cta']['say'], [0.18, 0.18, 1.6], 0.2)
    sf.write('build/voice_raw.wav', np.concatenate(audio), SR)
    json.dump({'duration': t, 'voice': VOICE, 'segments': segments}, open('build/timeline.json', 'w'), ensure_ascii=False, indent=1)
    print('duration', round(t, 2))

asyncio.run(main())
