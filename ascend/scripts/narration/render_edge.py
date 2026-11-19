"""Human-sounding narration with Microsoft's Hebrew neural voices (Avri, Hila).
Every sentence is synthesized once per voice and cached; books are then assembled into one file per book
with exact sentence times. 'duo' alternates the two voices by paragraph, like two friends talking.
Usage: render_edge.py synth            -> fill the cache for both voices
       render_edge.py build <voice>    -> avri | hila | duo  -> public/audio/<voice>/<book>.mp3 + .json"""
import asyncio, hashlib, json, os, subprocess, sys, numpy as np
import edge_tts
VOICES = {'avri': 'he-IL-AvriNeural', 'hila': 'he-IL-HilaNeural'}
CACHE = '/home/user/tts/edge_cache'
OUT = '/home/user/My-first-project/ascend/public/audio'
SR = 24000
SENT_GAP, PARA_GAP, TRACK_GAP = 0.22, 0.55, 1.4
books = json.load(open('/home/user/tts/books.json'))

def key(voice, text, rate='+0%'):
    return os.path.join(CACHE, voice, hashlib.sha1(f'{rate}|{text}'.encode()).hexdigest() + '.mp3')

async def synth_one(sem, voice, text, rate='+0%'):
    path = key(voice, text, rate)
    if os.path.exists(path) and os.path.getsize(path) > 600: return
    async with sem:
        for attempt in range(5):
            try:
                c = edge_tts.Communicate(text, VOICES[voice], rate=rate)
                data = b''.join([ch['data'] async for ch in c.stream() if ch['type'] == 'audio'])
                if len(data) > 600:
                    open(path + '.tmp', 'wb').write(data); os.replace(path + '.tmp', path); return
            except Exception as e:
                await asyncio.sleep(2 + attempt * 3)
        print('FAILED', voice, text[:40], flush=True)

async def synth_all(texts_by_voice):
    sem = asyncio.Semaphore(int(os.environ.get('CONC', '8')))
    jobs = [synth_one(sem, v, t, r) for v, items in texts_by_voice.items() for (t, r) in items]
    done = 0
    for f in asyncio.as_completed(jobs):
        await f; done += 1
        if done % 250 == 0: print(f'{done}/{len(jobs)}', flush=True)

def pcm(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    w = np.frombuffer(raw, np.float32)
    idx = np.where(np.abs(w) > 0.004)[0]
    return w[max(0, idx[0] - 240): idx[-1] + 1200] if len(idx) else w

CHAIN = 'highpass=f=70,acompressor=threshold=-20dB:ratio=2.2:attack=8:release=160:makeup=2,loudnorm=I=-16:TP=-1.5:LRA=9'

def build(voice):
    out = f'{OUT}/{voice}'; os.makedirs(out, exist_ok=True)
    for bk in books:
        bid = bk['book']; mp3, meta = f'{out}/{bid}.mp3', f'{out}/{bid}.json'
        if os.path.exists(mp3) and os.path.exists(meta) and not os.environ.get('FORCE'): continue
        chunks, cur, tracks, para_n = [], 0.0, {}, 0
        for tr in bk['tracks']:
            start, segs = cur, []
            for para in tr['paras']:
                v = voice if voice != 'duo' else ('avri' if para_n % 2 == 0 else 'hila')
                para_n += 1
                for si, text in enumerate(para):
                    w = pcm(key(v, text)); segs.append(round(cur - start, 2)); chunks.append(w); cur += len(w) / SR
                    gap = PARA_GAP if si == len(para) - 1 else SENT_GAP
                    chunks.append(np.zeros(int(gap * SR), np.float32)); cur += gap
            tracks[tr['id']] = {'o': round(start, 3), 'd': round(cur - start, 2), 's': segs}
            chunks.append(np.zeros(int(TRACK_GAP * SR), np.float32)); cur += TRACK_GAP
        raw = mp3 + '.f32'; np.concatenate(chunks).astype(np.float32).tofile(raw)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', raw,
                        '-af', CHAIN, '-ar', str(SR), '-ac', '1', '-b:a', os.environ.get('KBPS', '40') + 'k', mp3], check=True)
        os.remove(raw)
        json.dump({'voice': voice, 'tracks': tracks}, open(meta, 'w'), ensure_ascii=False)
        print(voice, bid, f'{cur:.0f}s', os.path.getsize(mp3) // 1024, 'KB', flush=True)
    print('DONE', voice, flush=True)

if __name__ == '__main__':
    if sys.argv[1] == 'synth':
        texts = sorted({s for bk in books for tr in bk['tracks'] for p in tr['paras'] for s in p})
        for v in VOICES: os.makedirs(f'{CACHE}/{v}', exist_ok=True)
        asyncio.run(synth_all({v: [(t, '+0%') for t in texts] for v in VOICES}))
        print('SYNTH DONE', flush=True)
    else:
        build(sys.argv[2])
