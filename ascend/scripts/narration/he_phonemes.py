"""Vocalized Hebrew -> IPA for the Phonikud-trained Piper voices.

Input is text diacritized by phonikud-onnx, which also marks:
  U+05BD (meteg) on a vocal shva (shva na), and
  U+05AB (ole) on the stressed letter when stress is not on the last syllable.
Output follows the Phonikud convention: ʃ χ ʁ ʔ ts dʒ tʃ ʒ, vowels a e i o u, and ˈ before the stressed vowel.
"""
import re

SHVA, HAT_SEGOL, HAT_PATAH, HAT_QAMATS = 'ְ', 'ֱ', 'ֲ', 'ֳ'
HIRIQ, TSERE, SEGOL, PATAH, QAMATS, HOLAM, HOLAM_HASER, QUBUTS = 'ִ', 'ֵ', 'ֶ', 'ַ', 'ָ', 'ֹ', 'ֺ', 'ֻ'
DAGESH, METEG, SHIN_DOT, SIN_DOT, STRESS = 'ּ', 'ֽ', 'ׁ', 'ׂ', '֫'
VOWEL = {HAT_SEGOL: 'e', HAT_PATAH: 'a', HAT_QAMATS: 'o', HIRIQ: 'i', TSERE: 'e', SEGOL: 'e', PATAH: 'a', QAMATS: 'a', HOLAM: 'o', HOLAM_HASER: 'o', QUBUTS: 'u'}
GERESH = '׳'

ONES = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע']
def number_words(n):
    """Feminine cardinal numbers, enough for years and counts in the lessons."""
    n = int(n)
    if n == 0: return 'אפס'
    parts = []
    th, n = divmod(n, 1000)
    if th: parts.append({1: 'אלף', 2: 'אלפיים'}.get(th, number_words(th) + ' אלפים'))
    h, n = divmod(n, 100)
    if h: parts.append({1: 'מאה', 2: 'מאתיים'}.get(h, ONES[h] + ' מאות'))
    if n:
        if n < 10: parts.append(ONES[n])
        elif n == 10: parts.append('עשר')
        elif n < 20: parts.append({11: 'אחת עשרה', 12: 'שתים עשרה'}.get(n, ONES[n - 10] + ' עשרה'))
        else:
            t, o = divmod(n, 10)
            tens = ['', '', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'][t]
            parts.append(tens + (' ו' + ONES[o] if o else ''))
    if len(parts) > 1: parts[-1] = 'ו' + parts[-1]
    return ' '.join(parts)

def normalize(text):
    text = re.sub(r'\d+', lambda m: number_words(m.group()), text)
    return text.replace('״', '').replace('"', '').replace('–', ',').replace('—', ',')

def split_letters(word):
    """[(letter, marks)] keeping geresh with its letter."""
    out = []
    for ch in word:
        if 'א' <= ch <= 'ת':
            out.append([ch, ''])
        elif out and ('֑' <= ch <= 'ׇ' or ch in (GERESH, "'")):
            out[-1][1] += ch
    return out

def word_ipa(word):
    L = split_letters(word)
    if not L: return ''
    units = []  # (consonant, vowel, stressed)
    has_stress_mark = any(STRESS in m for _, m in L)
    held = None  # a silent alef/ayin whose vowel arrives on the following vav (אוֹ, עוּ)
    for i, (c, m) in enumerate(L):
        last = i == len(L) - 1
        v = next((VOWEL[x] for x in m if x in VOWEL), '')
        if SHVA in m and METEG in m: v = 'e'  # shva na
        dag = DAGESH in m
        ger = GERESH in m or "'" in m
        prev_v = units[-1][1] if units else ''
        if c == 'ו' and held is not None and ((HOLAM in m and v == 'o') or (dag and not v)):
            units.append(['ʔ', 'o' if v == 'o' else 'u', held or STRESS in m]); held = None
            continue
        held = None
        if c == 'ו':
            if HOLAM in m and v == 'o' and not any(x in m for x in (PATAH, QAMATS, SEGOL, TSERE, HIRIQ)):
                cons = '' if units and not units[-1][1] else 'v'
                if units and not units[-1][1]:
                    units[-1][1] = 'o'; units[-1][2] = units[-1][2] or STRESS in m
                    continue
                cons, v = 'v', 'o'
            elif dag and not v:
                if units and not units[-1][1]:
                    units[-1][1] = 'u'; units[-1][2] = units[-1][2] or STRESS in m
                    continue
                cons, v = '', 'u'
            else:
                if not v and not dag and prev_v in ('o', 'u'): continue  # vav as a vowel letter
                if not v and not dag and i > 0 and L[i - 1][0] == 'ו': continue  # double vav is one /v/
                cons = 'v'
        elif c == 'י':
            if not v and prev_v in ('i', 'e') and not dag: continue  # mater lectionis
            if not v and i > 0 and L[i - 1][0] == 'י': continue  # double yod is one sound
            if not v and i == len(L) - 2 and L[i + 1][0] == 'ו' and not L[i + 1][1]: continue  # final -יו as in עכשיו, שלו
            cons = 'j'
        elif c in 'אע':
            if not v:
                held = STRESS in m
                continue
            cons = 'ʔ'
        elif c == 'ה':
            if last and not v and not dag: continue
            cons = 'h'
        elif c == 'ב': cons = 'b' if dag else 'v'
        elif c in 'כך': cons = 'k' if dag else 'χ'
        elif c in 'פף': cons = 'p' if dag else 'f'
        elif c == 'ש': cons = 's' if SIN_DOT in m else 'ʃ'
        elif c == 'ג': cons = 'dʒ' if ger else 'ɡ'
        elif c == 'ז': cons = 'ʒ' if ger else 'z'
        elif c in 'צץ': cons = 'tʃ' if ger else 'ts'
        else:
            cons = {'ד': 'd', 'ח': 'χ', 'ט': 't', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's', 'ק': 'k', 'ר': 'ʁ', 'ת': 't'}[c]
        # patah gnuva: final guttural with patah is read vowel-first
        if last and c in 'חעה' and v == 'a' and PATAH in m and units and units[-1][1] in ('i', 'e', 'o', 'u'):
            units.append(['', 'a', False]); units.append([cons, '', False]); continue
        units.append([cons, v, STRESS in m])
    # stress: marked letter, else the last vowel (milra)
    vowel_idx = [i for i, u in enumerate(units) if u[1]]
    if vowel_idx:
        marked = [i for i in vowel_idx if units[i][2]]
        target = marked[0] if (has_stress_mark and marked) else vowel_idx[-1]
        if len(vowel_idx) > 1 or True:
            units[target][1] = 'ˈ' + units[target][1]
    return ''.join(c + v for c, v, _ in units)

def phonemize(vocalized):
    vocalized = vocalized.replace('|', '')
    out = []
    for tok in re.findall(r"[א-ת֑-ׇ׳']+|[.,!?;:]", vocalized):
        out.append(tok if tok in '.,!?;:' else word_ipa(tok))
    s = ' '.join(out)
    return re.sub(r' ([.,!?;:])', r'\1', s)
