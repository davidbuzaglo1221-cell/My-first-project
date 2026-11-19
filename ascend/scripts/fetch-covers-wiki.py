"""Real book covers from each book's Wikipedia article (the article's lead image)."""
import json, subprocess, os, sys, urllib.parse
ARTICLES = {
  'richest-man-in-babylon': 'The Richest Man in Babylon (book)', 'millionaire-next-door': 'The Millionaire Next Door',
  'simple-path-to-wealth': 'The Simple Path to Wealth', '48-laws-of-power': 'The 48 Laws of Power', 'made-to-stick': 'Made to Stick',
  'predictably-irrational': 'Predictably Irrational', 'flow': 'Flow (book)', 'talk-like-ted': 'Talk Like TED',
  'difficult-conversations': 'Difficult Conversations (book)', 'magic-of-thinking-big': 'The Magic of Thinking Big',
  'feel-the-fear': 'Feel the Fear and Do It Anyway', 'daring-greatly': 'Daring Greatly', 'power-of-habit': 'The Power of Habit',
  'cant-hurt-me': "Can't Hurt Me", 'eat-that-frog': 'Eat That Frog!', 'getting-things-done': 'Getting Things Done',
  'good-to-great': 'Good to Great', 'hard-thing-about-hard-things': 'The Hard Thing About Hard Things',
  'four-hour-workweek': 'The 4-Hour Workweek', 'blue-ocean-strategy': 'Blue Ocean Strategy',
  '21-laws-of-leadership': 'The 21 Irrefutable Laws of Leadership', 'five-dysfunctions': 'The Five Dysfunctions of a Team', 'obstacle-is-the-way': 'The Obstacle Is the Way',
  'power-of-now': 'The Power of Now', 'awaken-the-giant': 'Awaken the Giant Within', 'influence': 'Influence: Science and Practice', 'laws-of-human-nature': 'The Laws of Human Nature',
  'nonviolent-communication': 'Nonviolent Communication', 'courage-to-be-disliked': 'The Courage to Be Disliked', 'e-myth-revisited': 'The E-Myth Revisited',
  'extreme-ownership': 'Extreme Ownership', 'mindset': 'Mindset (book)', 'mans-search-for-meaning': "Man's Search for Meaning", 'meditations': 'Meditations',
}  # verify every fetched image visually before keeping it
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
class R(dict):
    def __setitem__(self, k, v): super().__setitem__(k, v); print(f'{k:28s} {v}', flush=True)
report = R()
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

