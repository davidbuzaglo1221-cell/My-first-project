"""Text preparation for speech: what a native speaker would SAY, not what is written.

Hebrew first. Every rule here came from a measured mistake (see ../LEARNINGS.md).
- Currency, percent, units, abbreviations and symbols become words.
- Dates/times are left to the engine's normalizer only when it is known to agree in gender (BlueTTS does).
- Long sentences are split at a breath point (comma, "ו"/"אבל"/"כי"/"ש" clause starts) so prosody stays even.
- A per-project lexicon (JSON: {"written": "spoken"}) fixes names, brands and ambiguous words.
"""
import json, os, re

HEB = re.compile(r'[֐-׿]')
NIQQUD = re.compile(r'[֑-ׇ]')

# Abbreviations a Hebrew narrator expands. Gershayim (״ or ") inside a word marks an acronym.
HE_ABBR = {
    'ש"ח': 'שקלים', 'ש״ח': 'שקלים', '₪': ' שקלים', 'ד"ר': 'דוקטור', 'ד״ר': 'דוקטור', 'עו"ד': 'עורך דין', 'עו״ד': 'עורך דין',
    'וכו\'': 'וכן הלאה', 'וכו׳': 'וכן הלאה', 'ע"י': 'על ידי', 'ע״י': 'על ידי', 'בע"מ': 'בעירבון מוגבל', 'בע״מ': 'בעירבון מוגבל',
    'ת"א': 'תל אביב', 'ת״א': 'תל אביב', 'י-ם': 'ירושלים', 'צה"ל': 'צהל', 'צה״ל': 'צהל', 'ארה"ב': 'ארצות הברית', 'ארה״ב': 'ארצות הברית',
    'מ"מ': 'מילימטר', 'ס"מ': 'סנטימטר', 'ק"ג': 'קילו', 'ק"מ': 'קילומטר', 'דק\'': 'דקות', 'שע\'': 'שעות', 'בס"ד': '',
}
EN_ABBR = {'e.g.': 'for example', 'i.e.': 'that is', 'etc.': 'et cetera', 'vs.': 'versus', 'Dr.': 'Doctor', 'Mr.': 'Mister', 'Mrs.': 'Missus', '&': ' and '}

def load_lexicon(path=None):
    path = path or os.environ.get('GVI_LEXICON')
    return json.load(open(path, encoding='utf-8')) if path and os.path.exists(path) else {}

def is_hebrew(text):
    return bool(HEB.search(text))

def prepare(text, lang=None, lexicon=None):
    lang = lang or ('he' if is_hebrew(text) else 'en')
    t = text
    for k, v in (lexicon or {}).items():
        t = re.sub(rf'(?<!\w){re.escape(k)}(?!\w)', v, t)
    if lang == 'he':
        # "150 ש״ח" / "₪150" -> number + שקלים (engine's normalizer reads the digits with the right gender)
        t = re.sub(r'₪\s*(\d[\d,\.]*)', r'\1 שקלים', t)
        for k, v in HE_ABBR.items():
            t = t.replace(k, v)
        t = re.sub(r'(\d+(?:\.\d+)?)\s*%', r'\1 אחוז', t)
        t = re.sub(r'(\d),(\d{3})', r'\1\2', t)            # 1,500 -> 1500
        t = t.replace('״', '').replace('"', '')            # leftover acronym marks are not spoken
        t = re.sub(r'\s*[–—]\s*', ', ', t)                  # a dash is a breath, not a word
        t = t.replace('...', ',').replace('…', ',')
    else:
        for k, v in EN_ABBR.items():
            t = t.replace(k, v)
        # Kokoro read "$45" as "a dollar forty-five" and "2:30" as "two, thirty" (measured) -> say them as words
        t = re.sub(r'\$(\d+)\.(\d\d)\b', lambda m: f'{m.group(1)} dollars {m.group(2)} cents' if m.group(2) != '00' else f'{m.group(1)} dollars', t)
        t = re.sub(r'\$(\d+)\b', r'\1 dollars', t)
        def clock(m):
            try:
                from num2words import num2words as nw
            except Exception:
                return m.group(0)
            h, mm = int(m.group(1)), m.group(2)
            tail = "o'clock" if mm == '00' else ('oh ' + nw(int(mm)) if mm[0] == '0' else nw(int(mm)))
            return f'{nw(h)} {tail}'
        t = re.sub(r'\b(\d{1,2}):(\d{2})\b', clock, t)
        t = re.sub(r'\b([AaPp])\.?[Mm]\.?(?=\W|$)', lambda m: m.group(1).upper() + 'M', t)
        t = re.sub(r'(\d+(?:\.\d+)?)\s*%', r'\1 percent', t)
        t = re.sub(r'\s*[–—]\s*', ', ', t)
    t = re.sub(r'[\U0001F300-\U0001FAFF☀-➿]', '', t)   # emoji are never read
    t = re.sub(r'\s+', ' ', t).strip()
    return t

SENT = re.compile(r'(?<=[.!?؟])\s+')
def sentences(text):
    return [s for s in SENT.split(text.strip()) if s]

def breath_split(sentence, max_words=18):
    """Split a long sentence at the most natural breath point near the middle; recursive."""
    words = sentence.split()
    if len(words) <= max_words:
        return [sentence]
    mid = len(words) // 2
    cands = [i for i, w in enumerate(words[:-1]) if w.endswith((',', ';', ':'))]
    if not cands:  # clause starters: and / but / because / that / when
        cands = [i - 1 for i, w in enumerate(words) if i > 2 and re.match(r'^(ו|אבל|כי|כש|אם|and|but|because|when|which)', w)]
    if not cands:
        return [sentence]
    cut = min(cands, key=lambda i: abs(i - mid)) + 1
    a, b = ' '.join(words[:cut]).rstrip(',;:') + ',', ' '.join(words[cut:])
    return breath_split(a, max_words) + breath_split(b, max_words)

def chunks(text, max_words=18):
    out = []
    for s in sentences(text):
        out += breath_split(s, max_words)
    return out

if __name__ == '__main__':
    import sys
    for line in sys.stdin:
        print(prepare(line.strip()))
