"""Real book covers from each book's Wikipedia article (the article's lead image)."""
import json, subprocess, os, sys, urllib.parse
ARTICLES = {}  # all reliable covers fetched; add an entry only after checking its article shows the cover
UA = 'ASCEND-app-cover-fetch/1.0'
def curl(url, out=None):
    import time as _t
    for wait in (0, 6, 20, 45):
        _t.sleep(wait)
        code = _curl(url, out)
        if code != '429': return code
    return code
def _curl(url, out=None):
    args = ['curl', '-sL', '--max-time', '40', '-A', UA, '-w', '%{http_code}'] + (['-o', out] if out else ['-o', '/tmp/claude-0/w.json']) + [url]
    code = subprocess.run(args, capture_output=True, text=True).stdout.strip()
    return code
import re, time
report = {}
for bid, title in ARTICLES.items():
    out = f'public/covers/{bid}.jpg'
    if os.path.exists(out): report[bid] = 'have'; continue
    time.sleep(1.5)
    q = 'https://en.wikipedia.org/w/api.php?action=parse&format=json&redirects=1&prop=wikitext&section=0&page=' + urllib.parse.quote(title)
    if curl(q) != '200': report[bid] = 'api error'; continue
    wt = json.load(open('/tmp/claude-0/w.json')).get('parse', {}).get('wikitext', {}).get('*', '')
    m = re.search(r'\|\s*(?:image|cover)\s*=\s*(?:\[\[(?:File|Image):)?([^|\]\n]+\.(?:jpe?g|png|webp))', wt, re.I)
    if not m: report[bid] = 'no infobox image'; continue
    fname = m.group(1).strip()
    time.sleep(1.5)
    q2 = 'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=600&titles=' + urllib.parse.quote('File:' + fname)
    if curl(q2) != '200': report[bid] = 'imageinfo error'; continue
    pages = json.load(open('/tmp/claude-0/w.json'))['query']['pages']
    ii = (next(iter(pages.values())).get('imageinfo') or [{}])[0]
    src = ii.get('thumburl') or ii.get('url')
    if not src: report[bid] = 'no url ' + fname; continue
    time.sleep(1.5)
    code = curl(src, out)
    report[bid] = f"{code} {fname}"
for k, v in report.items(): print(f'{k:28s} {v}')
