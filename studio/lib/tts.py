"""Narration for the studio: Microsoft neural voices through edge-tts, one file per line, with retries and a
truncation check. Usage: tts.py <jobs.json>  where jobs.json = {"voice": "...", "rate": "+12%", "items": [{"text": "...", "out": "a.mp3"}]}
Prints {"ok": true, "durations": [...]} as JSON."""
import asyncio, json, os, subprocess, sys
import edge_tts

PROXY = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')


def dur(path):
    try:
        return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode().strip())
    except Exception:
        return 0.0


async def one(sem, voice, rate, text, out):
    async with sem:
        for attempt in range(4):
            try:
                c = edge_tts.Communicate(text, voice, rate=rate, proxy=PROXY)
                await c.save(out + '.tmp.mp3')
                d = dur(out + '.tmp.mp3')
                # ~14 Hebrew chars/s at +10%: a file far shorter than that is a cut-off stream.
                if d > max(0.4, len(text) / 30):
                    os.replace(out + '.tmp.mp3', out)
                    return d
            except Exception:
                pass
            await asyncio.sleep(1.5 + attempt * 2)
        return 0.0


async def main():
    job = json.load(open(sys.argv[1]))
    sem = asyncio.Semaphore(6)
    ds = await asyncio.gather(*[one(sem, job['voice'], job.get('rate', '+10%'), it['text'], it['out']) for it in job['items']])
    print(json.dumps({'ok': all(d > 0 for d in ds), 'durations': ds}))

asyncio.run(main())
