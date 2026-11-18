import asyncio, ssl, json, sys
import edge_tts, edge_tts.communicate as ec
ec._SSL_CTX = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
VOICE = sys.argv[1] if len(sys.argv) > 1 else 'he-IL-AvriNeural'
SCENES = json.load(open('script.json'))
async def one(i, s):
    c = edge_tts.Communicate(s['tts'], VOICE, rate='+17%', pitch='+5Hz', volume='+10%', boundary='WordBoundary')
    words, audio = [], bytearray()
    async for ch in c.stream():
        if ch['type'] == 'audio': audio += ch['data']
        elif ch['type'] == 'WordBoundary':
            words.append({'t': ch['offset']/1e7, 'd': ch['duration']/1e7, 'w': ch['text']})
    open(f'vo_{i}.mp3', 'wb').write(audio)
    json.dump(words, open(f'vo_{i}.json', 'w'), ensure_ascii=False)
    print(i, len(words), words[-1]['t']+words[-1]['d'])
async def main():
    for i, s in enumerate(SCENES): await one(i, s)
asyncio.run(main())
