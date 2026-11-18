import json, re, subprocess
NIK = re.compile('[֑-ׇ]')
S = json.load(open('script.json'))
def dur(f):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]))
GAP, LEAD, FIRST = 0.26, 0.12, 0.25
t = FIRST
scenes, words = [], []
for i, s in enumerate(S):
    w = json.load(open(f'vo_{i}.json'))
    d = w[-1]['t'] + w[-1]['d'] + 0.12
    a0 = t
    for x in w:
        words.append({'t': round(a0 + x['t'], 3), 'e': round(a0 + x['t'] + x['d'], 3), 'w': NIK.sub('', x['w']), 's': i})
    scenes.append({'id': s['id'], 'audio': a0, 'start': max(0, a0 - LEAD) if i else 0, 'vend': a0 + d})
    t = a0 + d + GAP
scenes[-1]['vend'] += 0.0
END = scenes[-1]['vend'] + 1.6
for i, sc in enumerate(scenes):
    sc['end'] = scenes[i+1]['start'] if i + 1 < len(scenes) else END
# caption groups: max 3 words, break on pauses > .22s or scene change
groups, cur = [], []
for i, w in enumerate(words):
    if cur and (len(cur) == 3 or w['s'] != cur[-1]['s'] or w['t'] - cur[-1]['e'] > 0.22):
        groups.append(cur); cur = []
    cur.append(w)
groups.append(cur)
caps = []
for g in groups:
    caps.append({'t': g[0]['t'] - 0.04, 'e': g[-1]['e'] + 0.18, 'w': [{'w': x['w'], 't': x['t']} for x in g]})
for a, b in zip(caps, caps[1:]):
    a['e'] = min(a['e'], b['t'])
json.dump({'scenes': scenes, 'words': words, 'caps': caps, 'end': END}, open('tl.json', 'w'), ensure_ascii=False, indent=0)
open('tl.js', 'w').write('window.TL=' + json.dumps({'scenes': scenes, 'words': words, 'caps': caps, 'end': END}, ensure_ascii=False) + ';')
print('END', round(END, 2))
for s in scenes: print(s['id'], round(s['start'], 2), round(s['audio'], 2), round(s['end'], 2))
