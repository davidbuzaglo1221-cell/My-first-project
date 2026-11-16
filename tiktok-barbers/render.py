"""Stage 4: motion-graphics renderer. 1080x1920 @ 30fps, Hebrew RTL kinetic typography.
Usage: python3 render.py FONT_DIR [--preview t1,t2,...]
"""
import json, math, sys, subprocess, os
from functools import lru_cache
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

W, H, FPS = 1080, 1920, 30
FONT_DIR = sys.argv[1]
TL = json.load(open('build/timeline.json'))
S = json.load(open('script.json'))
DUR = TL['duration']
SEGS = TL['segments']

# ---------------- palette ----------------
BG0 = (9, 9, 13); BG1 = (24, 20, 28)
GOLD = (240, 186, 84); GOLD2 = (255, 214, 130)
RED = (230, 57, 70); BLUE = (52, 110, 255); CREAM = (247, 242, 232); INK = (12, 12, 16)
YEL = (255, 222, 60)
BRAND = "BARBER  TIPS"

def F(name, size): return _font(name, int(size))
@lru_cache(None)
def _font(name, size): return ImageFont.truetype(os.path.join(FONT_DIR, name + '.ttf'), size, layout_engine=ImageFont.Layout.RAQM)
HE_BLACK, HE_XB, HE_B, HE_M = 'heebo-900', 'heebo-800', 'heebo-700', 'heebo-500'
NUM = 'rubik-900'

# ---------------- easing ----------------
def clamp(x, a=0., b=1.): return max(a, min(b, x))
def ease_out_cubic(x): x = clamp(x); return 1 - (1 - x) ** 3
def ease_in_out(x): x = clamp(x); return 3 * x * x - 2 * x * x * x
def ease_out_back(x, s=1.9):
    x = clamp(x); x -= 1; return x * x * ((s + 1) * x + s) + 1
def prog(t, t0, d): return clamp((t - t0) / d)

def is_rtl(s): return any('֐' <= c <= '׿' for c in s)

# ---------------- cached text sprites ----------------
@lru_cache(maxsize=4096)
def text_sprite(text, font, size, fill, stroke=0, stroke_fill=INK, shadow=0):
    f = F(font, size)
    d = 'rtl' if is_rtl(text) else 'ltr'
    bb = f.getbbox(text, direction=d, stroke_width=stroke)
    pad = stroke + 4 + shadow * 3
    w, h = bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    dr.text((pad - bb[0], pad - bb[1]), text, font=f, fill=fill, direction=d,
            stroke_width=stroke, stroke_fill=stroke_fill)
    if shadow:
        sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((pad - bb[0], pad - bb[1] + shadow), text, font=f, fill=(0, 0, 0, 170),
                                direction=d, stroke_width=stroke, stroke_fill=(0, 0, 0, 170))
        sh = sh.filter(ImageFilter.GaussianBlur(shadow))
        sh.alpha_composite(im); im = sh
    return im

@lru_cache(maxsize=256)
def glow_sprite(text, font, size, color, radius=28):
    base = text_sprite(text, font, size, color + (255,), 0)
    pad = radius * 2
    g = Image.new('RGBA', (base.width + 2 * pad, base.height + 2 * pad), (0, 0, 0, 0))
    g.alpha_composite(base, (pad, pad))
    g = g.filter(ImageFilter.GaussianBlur(radius))
    a = np.array(g); a[..., 3] = np.clip(a[..., 3].astype(np.int32) * 2, 0, 255); return Image.fromarray(a)

def text_w(text, font, size):
    return F(font, size).getlength(text, direction='rtl' if is_rtl(text) else 'ltr')

def place(canvas, im, cx, cy, scale=1.0, alpha=1.0, rot=0.0):
    if alpha <= 0.003 or scale <= 0.01: return
    if abs(scale - 1) > 0.004:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BILINEAR)
    if rot: im = im.rotate(rot, Image.BILINEAR, expand=True)
    if alpha < 0.999:
        a = im.getchannel('A').point(lambda v: int(v * alpha)); im = im.copy(); im.putalpha(a)
    x, y = int(cx - im.width / 2), int(cy - im.height / 2)
    if x >= canvas.width or y >= canvas.height or x + im.width <= 0 or y + im.height <= 0: return
    canvas.alpha_composite(im, (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))

def wrap(text, font, size, maxw):
    words, lines, cur = text.split(), [], ''
    for w_ in words:
        t = (cur + ' ' + w_).strip()
        if text_w(t, font, size) <= maxw or not cur: cur = t
        else: lines.append(cur); cur = w_
    if cur: lines.append(cur)
    return lines

# ---------------- static layers ----------------
def build_static():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    g = (yy / H)[..., None]
    base = (np.array(BG0) * (1 - g) + np.array(BG1) * g)
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.45) / H) ** 2)
    vign = np.clip(1 - (r - 0.25) * 1.25, 0.35, 1)[..., None]
    base = Image.fromarray(np.clip(base * vign, 0, 255).astype(np.uint8)).convert('RGBA')
    # barber-pole diagonal stripes tile (very subtle)
    tile = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(tile)
    period = 180
    for i, k in enumerate(range(-H * 2, W * 4, period)):
        col = (RED, CREAM, BLUE)[i % 3]
        d.polygon([(k, 0), (k + 60, 0), (k + 60 - H * 2, H * 2), (k - H * 2, H * 2)], fill=col + (12,))
    # glow blobs
    def blob(color, rad):
        s = rad * 2; y, x = np.mgrid[0:s, 0:s]; rr = np.sqrt((x - rad) ** 2 + (y - rad) ** 2) / rad
        a = np.clip(1 - rr, 0, 1) ** 2.2
        arr = np.zeros((s, s, 4), np.uint8); arr[..., :3] = color; arr[..., 3] = (a * 120).astype(np.uint8)
        return Image.fromarray(arr)
    rng = np.random.default_rng(11)
    grains = []
    for _ in range(6):
        n = rng.normal(0, 1, (H // 2, W // 2))
        a = np.zeros((H // 2, W // 2, 4), np.uint8)
        v = np.clip(128 + n * 60, 0, 255).astype(np.uint8)
        a[..., 0] = a[..., 1] = a[..., 2] = v; a[..., 3] = 14
        grains.append(Image.fromarray(a).resize((W, H), Image.NEAREST))
    return base, tile, blob(GOLD, 520), blob(RED, 460), blob(BLUE, 420), grains

STATIC = None
def static():
    global STATIC
    if STATIC is None: STATIC = build_static()
    return STATIC

# ---------------- helpers: scene lookup ----------------
def seg_at(t):
    cur = SEGS[0]
    for s in SEGS:
        if t >= s['start'] - 0.001: cur = s
    return cur
CUTS = [s['start'] for s in SEGS[1:]]

def words_timing(chunk):
    ws = chunk['text'].split(); L = [len(w) + 1.5 for w in ws]; tot = sum(L)
    out, acc = [], chunk['start']; span = chunk['end'] - chunk['start']
    for w_, l in zip(ws, L):
        d = span * l / tot; out.append((w_, acc, acc + d)); acc += d
    return out

# ---------------- elements ----------------
def draw_background(c, t):
    base, tile, bg, br, bb, grains = static()
    c.alpha_composite(base)
    off = int((t * 60) % 540)
    c.alpha_composite(tile.crop((off, off, off + W, off + H)))
    place(c, bg, W * 0.5 + 260 * math.sin(t * 0.37), H * 0.33 + 180 * math.cos(t * 0.29), 1.0, 0.55)
    place(c, br, W * 0.5 + 300 * math.cos(t * 0.23 + 1), H * 0.75 + 160 * math.sin(t * 0.31), 1.0, 0.33)
    place(c, bb, W * 0.5 + 320 * math.sin(t * 0.19 + 2), H * 0.12 + 140 * math.sin(t * 0.41), 1.0, 0.25)

def draw_grain(c, t):
    c.alpha_composite(static()[5][int(t * FPS) % 6])

def draw_pole(c, cx, cy, t, h=150, w=40, alpha=1.0):
    """small animated barber pole"""
    im = Image.new('RGBA', (w + 30, h + 60), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    body = Image.new('RGBA', (w, h), CREAM + (255,)); bd = ImageDraw.Draw(body)
    off = (t * 70) % 54
    for k in range(-3, 10):
        y0 = k * 54 + off; col = RED if k % 2 == 0 else BLUE
        bd.polygon([(0, y0), (w, y0 - 26), (w, y0 - 8), (0, y0 + 18)], fill=col)
    mask = Image.new('L', (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), 14, fill=255)
    im.paste(body, (15, 30), mask)
    d.rounded_rectangle((5, 10, w + 25, 32), 8, fill=GOLD); d.rounded_rectangle((5, h + 28, w + 25, h + 50), 8, fill=GOLD)
    d.ellipse((w // 2 + 3, 0, w // 2 + 27, 16), fill=GOLD2)
    place(c, im, cx, cy, 1, alpha)

@lru_cache(None)
def scissors_icon(size=64, color=GOLD):
    s = size * 4; im = Image.new('RGBA', (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(im); lw = s // 14
    d.line((s * .18, s * .82, s * .86, s * .14), fill=color, width=lw)
    d.line((s * .82, s * .82, s * .14, s * .14), fill=color, width=lw)
    for cx in (s * .2, s * .8):
        d.ellipse((cx - s * .16, s * .70, cx + s * .16, s * 1.0 - lw / 2), outline=color, width=lw)
    d.ellipse((s * .46, s * .44, s * .54, s * .52), fill=INK)
    return im.resize((size, size), Image.LANCZOS)

def draw_brand(c, t, alpha=1.0):
    ic = scissors_icon(54)
    txt = text_sprite(BRAND, HE_XB, 30, CREAM + (230,))
    wtot = ic.width + 14 + txt.width + 36
    pill = Image.new('RGBA', (wtot, 74), (0, 0, 0, 0))
    ImageDraw.Draw(pill).rounded_rectangle((0, 0, wtot - 1, 73), 37, fill=(18, 18, 24, 200), outline=GOLD + (140,), width=2)
    pill.alpha_composite(ic, (18, 10)); pill.alpha_composite(txt, (18 + ic.width + 10, (74 - txt.height) // 2))
    place(c, pill, W - 60 - wtot / 2, 250, 1, alpha)

def draw_progress(c, t, n, seg):
    """20 segment progress bar + 'טיפ n/20'"""
    if n == 0: return
    x0, x1, y = 60, W - 60, 315
    gap = 8; segw = (x1 - x0 - gap * 19) / 20
    d = ImageDraw.Draw(c)
    p = ease_out_cubic(prog(t, seg['start'], 0.5))
    for i in range(20):
        # RTL: tip 1 starts at right
        xr = x1 - i * (segw + gap); xl = xr - segw
        d.rounded_rectangle((xl, y, xr, y + 10), 5, fill=(255, 255, 255, 40))
        if i + 1 < n: d.rounded_rectangle((xl, y, xr, y + 10), 5, fill=GOLD)
        elif i + 1 == n and p > 0.02:
            d.rounded_rectangle((xr - max(segw * p, 10), y, xr, y + 10), 5, fill=GOLD2)
    lab = text_sprite(f"טיפ {n}/20", HE_B, 38, CREAM + (220,))
    place(c, lab, 60 + lab.width / 2, 250, 1, 1)

def draw_captions(c, t, seg, y=1400):
    """TikTok-style word-by-word captions with active word highlight (RTL)."""
    ch = None
    for k in seg['chunks']:
        if k['start'] - 0.08 <= t <= k['end'] + 0.25: ch = k
    if ch is None: return
    wt = words_timing(ch)
    # paginate into groups of max 4 words / 2 lines
    pages, cur = [], []
    for w_ in wt:
        cur.append(w_)
        if len(cur) == 4 or w_[0].endswith((',', '.', '?')) and len(cur) >= 2: pages.append(cur); cur = []
    if cur: pages.append(cur)
    page = pages[0]
    for pg in pages:
        if t >= pg[0][1] - 0.05: page = pg
    size = 76; font = HE_BLACK; maxw = 900
    # line breaking
    lines, line, lw = [], [], 0
    for w_ in page:
        ww = text_w(w_[0], font, size) + 26
        if lw + ww > maxw and line: lines.append(line); line, lw = [], 0
        line.append(w_); lw += ww
    if line: lines.append(line)
    pin = ease_out_back(prog(t, page[0][1] - 0.05, 0.22), 1.4)
    lh = 104
    ytop = y - (len(lines) - 1) * lh / 2
    for li, ln in enumerate(lines):
        widths = [text_w(w_[0], font, size) for w_ in ln]
        total = sum(widths) + 26 * (len(ln) - 1)
        x = W / 2 + total / 2  # start from right edge (RTL)
        for (word, a, b), ww in zip(ln, widths):
            active = a - 0.03 <= t < b + 0.02
            spoken = t >= b
            cx = x - ww / 2; cy = ytop + li * lh
            if active:
                k = ease_out_back(prog(t, a - 0.03, 0.14), 2.2)
                box = Image.new('RGBA', (int(ww + 34), 96), (0, 0, 0, 0))
                ImageDraw.Draw(box).rounded_rectangle((0, 0, box.width - 1, 95), 18, fill=RED + (255,))
                place(c, box, cx, cy + 4, (0.85 + 0.15 * k) * pin, 1)
                sp = text_sprite(word, font, size, CREAM + (255,), 0, INK, 0)
                place(c, sp, cx, cy, (1.0 + 0.08 * k) * pin, 1)
            else:
                col = (CREAM + (255,)) if spoken else (CREAM + (255,))
                sp = text_sprite(word, font, size, col, 7, INK, 6)
                place(c, sp, cx, cy, pin, 1.0 if spoken else 0.92)
            x -= ww + 26

def stripe_wipe(c, t):
    """barber-pole stripe band sweeping right->left across each cut"""
    for tc in CUTS:
        p = (t - (tc - 0.22)) / 0.44
        if 0 <= p <= 1:
            p = ease_in_out(p)
            ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
            span = W + H * 0.6 + 900
            lead = W + 450 - p * span   # left edge of band
            bandw = 900; stripes = 9; sw = bandw / stripes
            for i in range(stripes):
                col = (RED, CREAM, BLUE)[i % 3]
                xl = lead + i * sw
                d.polygon([(xl, 0), (xl + sw + 2, 0), (xl + sw + 2 + H * 0.6, H), (xl + H * 0.6, H)], fill=col + (255,))
            c.alpha_composite(ov)

def punch_zoom(t):
    z = 1.0
    for tc in CUTS + [SEGS[0]['chunks'][0]['start']]:
        if tc <= t < tc + 0.45: z = 1 + 0.07 * (1 - ease_out_cubic((t - tc) / 0.45))
    return z

def shake(t):
    dx = dy = 0.0
    hits = [SEGS[0]['chunks'][0]['start'], SEGS[0]['chunks'][2]['start'], SEGS[-1]['chunks'][0]['start']]
    for th in hits:
        if th <= t < th + 0.35:
            a = 16 * (1 - (t - th) / 0.35)
            dx += a * math.sin(t * 93); dy += a * math.cos(t * 71)
    return dx, dy

# ---------------- scenes ----------------
def scene_hook(c, t, seg):
    ch = seg['chunks']
    # pre-roll: pulsing dot + riser
    if t < ch[0]['start']:
        p = t / max(0.01, ch[0]['start'])
        place(c, glow_sprite('?', NUM, 300, RED, 40), W / 2, H * 0.47, 0.6 + 0.5 * p, p)
    # chunk 0: "למה הלקוחות שלך / לא חוזרים?"
    if ch[0]['start'] <= t < ch[1]['start']:
        wt = words_timing(ch[0])
        l1 = "למה הלקוחות שלך"
        p1 = ease_out_back(prog(t, wt[0][1], 0.3))
        place(c, text_sprite(l1, HE_BLACK, 112, CREAM + (255,), 0, INK, 8), W / 2, 820 - 40 * (1 - p1), p1 ** 0.5, clamp(p1 * 1.5))
        p2 = ease_out_back(prog(t, wt[2][1] - 0.05, 0.32), 2.4)
        l2 = text_sprite("לא חוזרים?", HE_BLACK, 170, CREAM + (255,))
        box = Image.new('RGBA', (l2.width + 70, l2.height + 30), (0, 0, 0, 0))
        ImageDraw.Draw(box).rounded_rectangle((0, 0, box.width - 1, box.height - 1), 26, fill=RED)
        rot = -3 * (1 - prog(t, wt[2][1], 0.5))
        place(c, box, W / 2, 1040, 1.6 - 0.6 * p2 if p2 > 0 else 0, clamp(p2 * 2), rot - 2)
        place(c, l2, W / 2, 1035, 1.6 - 0.6 * p2 if p2 > 0 else 0, clamp(p2 * 2), rot - 2)
        # orbiting scissors
        place(c, scissors_icon(140), W / 2 + 330 * math.cos(t * 2), 1300 + 40 * math.sin(t * 3), 1, clamp(p2), t * 90)
    # chunk 1: "זה לא מזל רע." with strike
    if ch[1]['start'] <= t < ch[2]['start']:
        p = ease_out_back(prog(t, ch[1]['start'], 0.28))
        sp = text_sprite("זה לא מזל רע.", HE_BLACK, 150, CREAM + (255,), 0, INK, 8)
        place(c, sp, W / 2, 940, 0.6 + 0.4 * p, clamp(p * 2))
        ps = ease_out_cubic(prog(t, ch[1]['start'] + 0.35, 0.3))
        if sp.width * ps > 22:
            d = ImageDraw.Draw(c); x1 = W / 2 + sp.width / 2; xl = x1 - sp.width * ps
            d.rounded_rectangle((xl, 932, x1, 952), 10, fill=GOLD)
        pq = ease_out_back(prog(t, ch[1]['start'] + 0.5, 0.3))
        place(c, text_sprite("זה כן בידיים שלך", HE_B, 70, GOLD2 + (255,), 0, INK, 6), W / 2, 1130, pq, clamp(pq))
    # chunk 2: big "20"
    if t >= ch[2]['start']:
        p = ease_out_back(prog(t, ch[2]['start'], 0.45), 1.6)
        place(c, glow_sprite('20', NUM, 520, GOLD, 40), W / 2, 820, (2.2 - 1.2 * p), clamp(p) * 0.9)
        place(c, text_sprite('20', NUM, 520, GOLD + (255,), 0, INK, 10), W / 2, 820, (2.2 - 1.2 * p), clamp(p * 1.4))
        p2 = ease_out_cubic(prog(t, ch[2]['start'] + 0.35, 0.35))
        place(c, text_sprite("טיפים לספרים", HE_BLACK, 120, CREAM + (255,), 0, INK, 8), W / 2, 1160 + 60 * (1 - p2), 1, p2)
        p3 = ease_out_cubic(prog(t, ch[2]['start'] + 0.7, 0.35))
        place(c, text_sprite("שיגרמו ללקוחות לחזור", HE_B, 70, GOLD2 + (255,), 0, INK, 6), W / 2, 1290 + 50 * (1 - p3), 1, p3)
        draw_pole(c, W / 2 - 400, 820, t, alpha=p3); draw_pole(c, W / 2 + 400, 820, t, alpha=p3)

def scene_tip(c, t, seg):
    n = seg['index']; tip = S['tips'][n - 1]; ch = seg['chunks']
    t0 = ch[0]['start']
    # giant number
    p = ease_out_back(prog(t, t0 - 0.05, 0.42), 1.7)
    numtxt = f"{n:02d}"
    breath = 1 + 0.015 * math.sin((t - t0) * 3)
    sc = (2.0 - 1.0 * p) * breath
    place(c, glow_sprite(numtxt, NUM, 430, GOLD, 34), W / 2, 690, sc, clamp(p) * 0.75)
    place(c, text_sprite(numtxt, NUM, 430, GOLD + (255,), 0, INK, 12), W / 2, 690, sc, clamp(p * 1.5))
    # "טיפ" label above number
    pl = ease_out_cubic(prog(t, t0 + 0.1, 0.3))
    lab = text_sprite("ט י פ", HE_XB, 46, CREAM + (200,))
    place(c, lab, W / 2, 450 + 30 * (1 - pl), 1, pl)
    d = ImageDraw.Draw(c)
    if pl > 0:
        lw_ = 120 * pl
        d.rounded_rectangle((W / 2 - lab.width / 2 - 30 - lw_, 448, W / 2 - lab.width / 2 - 30, 454), 3, fill=GOLD)
        d.rounded_rectangle((W / 2 + lab.width / 2 + 30, 448, W / 2 + lab.width / 2 + 30 + lw_, 454), 3, fill=GOLD)
    # title card
    t1 = ch[1]['start'] - 0.06
    pt = ease_out_back(prog(t, t1, 0.36), 1.5)
    if pt > 0:
        lines = wrap(tip['title'], HE_BLACK, 118, 880)
        size = 118 if len(lines) <= 2 else 100
        lines = wrap(tip['title'], HE_BLACK, size, 880)
        lh = size * 1.18; ycen = 1070
        y0 = ycen - (len(lines) - 1) * lh / 2
        cardh = len(lines) * lh + 90; cardw = max(text_w(l, HE_BLACK, size) for l in lines) + 120
        # highlight swipe (RTL: grows from right)
        sw = ease_out_cubic(prog(t, t1, 0.45))
        card = Image.new('RGBA', (int(cardw), int(cardh)), (0, 0, 0, 0))
        cd = ImageDraw.Draw(card)
        if card.width * sw > 80:
            cd.rounded_rectangle((card.width * (1 - sw), 0, card.width - 1, card.height - 1), 34, fill=RED + (255,))
            cd.rounded_rectangle((card.width * (1 - sw) + 10, card.height - 18, card.width - 11, card.height - 10), 4, fill=GOLD2 + (255,))
        tilt = -2.2 + 1.0 * math.sin((t - t1) * 1.5) * 0.4
        place(c, card, W / 2, ycen + 8 + 40 * (1 - pt), 0.92 + 0.08 * pt, clamp(pt * 2), tilt)
        for i, l in enumerate(lines):
            pi = ease_out_back(prog(t, t1 + 0.06 * i, 0.34), 1.8)
            place(c, text_sprite(l, HE_BLACK, size, CREAM + (255,), 0, INK, 8),
                  W / 2, y0 + i * lh + 50 * (1 - pi), 0.8 + 0.2 * pi, clamp(pi * 2), tilt)
    # side barber pole + floating scissors
    pp = ease_out_cubic(prog(t, t0, 0.5))
    draw_pole(c, 70 - 120 * (1 - pp), 690, t, alpha=pp)
    place(c, scissors_icon(110), W - 110 + 120 * (1 - pp), 690 + 20 * math.sin(t * 2.4), 1, pp * 0.9, 15 * math.sin(t * 1.7))

ICONS = {}
def icon(kind, s=150):
    key = (kind, s)
    if key in ICONS: return ICONS[key]
    S4 = s * 4; im = Image.new('RGBA', (S4, S4), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((0, 0, S4 - 1, S4 - 1), fill=GOLD)
    if kind == 'save':
        d.polygon([(S4 * .32, S4 * .24), (S4 * .68, S4 * .24), (S4 * .68, S4 * .78), (S4 * .5, S4 * .64), (S4 * .32, S4 * .78)], fill=INK)
    elif kind == 'share':
        d.polygon([(S4 * .62, S4 * .22), (S4 * .84, S4 * .48), (S4 * .62, S4 * .74), (S4 * .62, S4 * .6),
                   (S4 * .3, S4 * .6), (S4 * .2, S4 * .76), (S4 * .22, S4 * .5), (S4 * .36, S4 * .38), (S4 * .62, S4 * .36)], fill=INK)
    else:
        lw = S4 * .1
        d.rounded_rectangle((S4 * .5 - lw / 2, S4 * .24, S4 * .5 + lw / 2, S4 * .76), lw / 2, fill=INK)
        d.rounded_rectangle((S4 * .24, S4 * .5 - lw / 2, S4 * .76, S4 * .5 + lw / 2), lw / 2, fill=INK)
    im = im.resize((s, s), Image.LANCZOS); ICONS[key] = im; return im

def scene_cta(c, t, seg):
    ch = seg['chunks']
    p0 = ease_out_back(prog(t, seg['start'], 0.4))
    place(c, text_sprite("רוצה עוד לקוחות", HE_BLACK, 104, CREAM + (255,), 0, INK, 8), W / 2, 500 + 40 * (1 - p0), 1, p0)
    place(c, text_sprite("שחוזרים?", HE_BLACK, 140, GOLD + (255,), 0, INK, 8), W / 2, 640 + 40 * (1 - p0), 1, p0)
    rows = [('save', 'שמור את הסרטון', ch[0]), ('share', 'שלח לחבר ספר', ch[1]), ('follow', 'עקוב לעוד טיפים', ch[2])]
    for i, (k, label, chk) in enumerate(rows):
        pr = ease_out_back(prog(t, chk['start'] - 0.05, 0.4), 2.0)
        y = 860 + i * 190
        active = chk['start'] <= t < chk['end'] + 0.2
        bump = 1 + (0.06 * math.sin((t - chk['start']) * 10) if active else 0)
        bar = Image.new('RGBA', (800, 160), (0, 0, 0, 0))
        ImageDraw.Draw(bar).rounded_rectangle((0, 0, 799, 159), 40, fill=(255, 255, 255, 26 if not active else 44),
                                              outline=GOLD + (200 if active else 90,), width=3)
        place(c, bar, W / 2 - 30 + 200 * (1 - pr), y, 1, clamp(pr * 2))
        place(c, icon(k), W / 2 + 270 + 200 * (1 - pr), y, pr * bump, clamp(pr * 2))
        place(c, text_sprite(label, HE_BLACK, 74, CREAM + (255,)), W / 2 - 100 + 200 * (1 - pr), y, 1, clamp(pr * 2))
    draw_pole(c, 70, 640, t, alpha=p0); draw_pole(c, W - 70, 640, t, alpha=p0)

# ---------------- frame ----------------
def render_frame(fi):
    t = fi / FPS
    c = Image.new('RGBA', (W, H)); draw_background(c, t)
    seg = seg_at(t)
    fg = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if seg['kind'] == 'hook': scene_hook(fg, t, seg)
    elif seg['kind'] == 'tip': scene_tip(fg, t, seg)
    else: scene_cta(fg, t, seg)
    if seg['kind'] != 'hook': draw_captions(fg, t, seg)
    dx, dy = shake(t)
    c.alpha_composite(fg, (int(dx) if dx > 0 else 0, int(dy) if dy > 0 else 0), (int(-dx) if dx < 0 else 0, int(-dy) if dy < 0 else 0))
    z = punch_zoom(t)
    if z > 1.001:
        cw, chh = W / z, H / z
        c = c.crop((int((W - cw) / 2), int((H - chh) / 2), int((W + cw) / 2), int((H + chh) / 2))).resize((W, H), Image.BILINEAR)
    # HUD (not zoomed)
    draw_brand(c, t, clamp(t / 0.6))
    draw_progress(c, t, seg['index'] if seg['kind'] == 'tip' else (20 if seg['kind'] == 'cta' else 0), seg)
    stripe_wipe(c, t)
    draw_grain(c, t)
    # fade in / out
    fade = min(clamp(t / 0.25), clamp((DUR - t) / 0.5))
    out = c.convert('RGB')
    if fade < 1: out = Image.blend(Image.new('RGB', (W, H)), out, fade)
    return out

def render_range(args):
    a, b, path = args
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                          '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16',
                          '-pix_fmt', 'yuv420p', path], stdin=subprocess.PIPE)
    for fi in range(a, b): p.stdin.write(render_frame(fi).tobytes())
    p.stdin.close(); p.wait(); return path

if __name__ == '__main__':
    if '--preview' in sys.argv:
        ts = [float(x) for x in sys.argv[sys.argv.index('--preview') + 1].split(',')]
        os.makedirs('build/preview2', exist_ok=True)
        for tt in ts:
            render_frame(int(tt * FPS)).save(f'build/preview2/f_{tt:06.2f}.png')
        print('previews done'); sys.exit()
    total = int(math.ceil(DUR * FPS)); nw = os.cpu_count() or 4
    chunks = 16; step = math.ceil(total / chunks)
    jobs = [(i, min(total, i + step), f'build/part_{k:02d}.mp4') for k, i in enumerate(range(0, total, step))]
    with Pool(nw) as pool:
        for pth in pool.imap(render_range, jobs): print('done', pth, flush=True)
    with open('build/parts.txt', 'w') as f:
        for _, _, pth in jobs: f.write(f"file '{os.path.basename(pth)}'\n")
    print('frames', total)
