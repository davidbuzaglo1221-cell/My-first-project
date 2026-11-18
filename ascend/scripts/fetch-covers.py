"""Download each book's real cover from Open Library, trying edition covers until one is served directly."""
import json, subprocess, sys, os, re
books = json.load(open('/tmp/claude-0/books.json'))
def get(url, follow=False, tries=3):
    for _ in range(tries):
        if os.path.exists('/tmp/claude-0/dl.bin'): os.remove('/tmp/claude-0/dl.bin')
        code, body = _get(url, follow)
        if code == '200' or code in ('302', '404', '403'): return code, body
    return code, body
def _get(url, follow=False):
    r = subprocess.run(['curl', '-s', '--max-time', '30', '-w', '%{http_code}', '-o', '/tmp/claude-0/dl.bin'] + (['-L'] if follow else []) + [url], capture_output=True, text=True)
    return r.stdout.strip(), open('/tmp/claude-0/dl.bin', 'rb').read() if os.path.exists('/tmp/claude-0/dl.bin') else b''
norm = lambda s: re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', '', s.lower())).strip()
for b in books:
    out = f"public/covers/{b['id']}.jpg"
    if os.path.exists(out): continue
    code, body = get(f"https://openlibrary.org/search.json?title={b['q']}&author={b['a']}&limit=8&fields=key,title,cover_i,edition_count", True)
    try: docs = json.loads(body).get('docs', [])
    except Exception: print(b['id'], 'SEARCH FAILED', file=sys.stderr); continue
    want = norm(b['q'].replace('+', ' '))
    docs.sort(key=lambda d: (norm(d.get('title', '')) != want, -(d.get('edition_count') or 0)))
    ok = False
    for d in docs[:2]:
        code, body = get(f"https://openlibrary.org{d['key']}.json", True)
        try: covers = [c for c in json.loads(body).get('covers', []) if c and c > 0]
        except Exception: covers = []
        if d.get('cover_i'): covers = [d['cover_i']] + [c for c in covers if c != d['cover_i']]
        for c in covers[:25]:
            code, img = get(f"https://covers.openlibrary.org/b/id/{c}-L.jpg")
            if code == '200' and len(img) > 8000 and img[:3] == b'\xff\xd8\xff':
                open(out, 'wb').write(img); print(b['id'], '<-', d.get('title'), c, len(img)); ok = True; break
        if ok: break
    if not ok: print(b['id'], 'NO DIRECT COVER', file=sys.stderr)
