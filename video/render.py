"""Frame renderer for "20 טיפים לכושר".

Usage:
    python3 render.py still <seconds> <out.png>      # one frame
    python3 render.py chunk <f0> <f1> <out.mp4>      # frames [f0, f1) to a silent mp4
"""
import math
import re
import os
import random
import subprocess
import sys
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter, ImageFont

import content as C

W, H, FPS = 1080, 1920, 30
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "fonts")
EMOJI_FONT = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"

# ---- graphic concept: "ניאון חדר כושר" -------------------------------------
BG = (9, 9, 13)
CARD = (22, 22, 30)
CARD2 = (32, 32, 42)
LIME = (212, 255, 58)
PINK = (255, 51, 119)
CYAN = (56, 236, 255)
ORANGE = (255, 140, 36)
WHITE = (255, 255, 255)
GRAY = (150, 150, 168)
DIM = (80, 80, 96)
BLACK = (0, 0, 0)
ACCENTS = [LIME, PINK, CYAN, ORANGE]

# Content column, kept clear of TikTok's right-hand buttons and bottom caption
CX = 510           # visual centre of the content column
COL_L, COL_R = 70, 950
COL_W = COL_R - COL_L

FONTS = {"h9": "Heebo-900.ttf", "h7": "Heebo-700.ttf", "h5": "Heebo-500.ttf",
         "r9": "Rubik-900.ttf", "r9i": "Rubik-900i.ttf"}


@lru_cache(maxsize=None)
def F(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, FONTS[name]), size)


# ---- easing -------------------------------------------------------------------
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def prog(t, start, dur):
    return clamp((t - start) / dur) if dur > 0 else float(t >= start)


def ease_out(x):
    return 1 - (1 - x) ** 3


def ease_in(x):
    return x ** 3


def ease_io(x):
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def back_out(x, s=2.2):
    x -= 1
    return x * x * ((s + 1) * x + s) + 1


def lerp(a, b, x):
    return a + (b - a) * x


def mix(c1, c2, x):
    return tuple(int(lerp(a, b, x)) for a, b in zip(c1, c2))


# ---- text and emoji -----------------------------------------------------------
@lru_cache(maxsize=8192)
def T(text, font="h9", size=60, fill=WHITE, stroke=0, sfill=BLACK):
    """Render one run of text (RTL aware) into a tight RGBA image."""
    text = re.sub(r"(\d)–(\d)", r"\1-\2", text)   # keep number ranges in reading order under RTL
    f = F(font, size)
    asc, desc = f.getmetrics()
    x0, _, x1, _ = f.getbbox(text, direction="rtl", stroke_width=stroke)
    pad = 6 + stroke
    img = Image.new("RGBA", (int(x1 - x0) + 2 * pad, asc + desc + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((pad - x0, pad), text, font=f, fill=fill, direction="rtl",
                             stroke_width=stroke, stroke_fill=sfill)
    return img


@lru_cache(maxsize=None)
def _emoji_font():
    return ImageFont.truetype(EMOJI_FONT, 109)


@lru_cache(maxsize=512)
def E(ch, size):
    img = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((10, 10), ch, font=_emoji_font(), embedded_color=True)
    bb = img.getbbox()
    img = img.crop(bb) if bb else img
    r = size / max(img.size)
    return img.resize((max(1, int(img.width * r)), max(1, int(img.height * r))), Image.LANCZOS)


def split_emoji(s):
    """'תכתוב 💪 בתגובות' -> ('תכתוב בתגובות'-ish words, emoji list) for layouts that put emoji aside."""
    words, emos = [], []
    for w in s.split():
        (emos if ord(w[0]) > 0x2500 else words).append(w)
    return " ".join(words), emos


def fade(img, a):
    if a >= 0.999:
        return img
    img = img.copy()
    img.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
    return img


def scaled(img, s):
    if abs(s - 1) < 0.01:
        return img
    return img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.BILINEAR)


def paste_c(base, img, cx, cy, a=1.0):
    """Paste centred on (cx, cy)."""
    if a <= 0.01:
        return
    img = fade(img, a)
    base.paste(img, (int(cx - img.width / 2), int(cy - img.height / 2)), img)


def paste_r(base, img, rx, ty, a=1.0):
    """Paste with right edge at rx (RTL alignment)."""
    if a <= 0.01:
        return
    img = fade(img, a)
    base.paste(img, (int(rx - img.width), int(ty)), img)


def rotated(img, deg):
    return img.rotate(deg, resample=Image.BICUBIC, expand=True)


def wrap(words, font, size, maxw):
    space = F(font, size).getlength(" ")
    rows, row, w = [], [], 0
    for word in words:
        ww = T(word, font, size).width - 12
        if row and w + space + ww > maxw:
            rows.append(row)
            row, w = [], 0
        w += (space if row else 0) + ww
        row.append(word)
    if row:
        rows.append(row)
    return rows, space


@lru_cache(maxsize=256)
def text_block(text, font="h9", size=90, fill=WHITE, maxw=COL_W, lh=1.12, stroke=0, align="c"):
    """Multi-line RTL block as one RGBA image."""
    rows, space = wrap(text.split(), font, size, maxw)
    imgs = [T(" ".join(r), font, size, fill, stroke) for r in rows]
    step = int(size * lh)
    bw = max(i.width for i in imgs)
    bh = step * (len(imgs) - 1) + imgs[-1].height
    out = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    for k, im in enumerate(imgs):
        x = (bw - im.width) // 2 if align == "c" else bw - im.width
        out.paste(im, (x, k * step), im)
    return out


def check(d, cx, cy, s, color, width=None):
    d.line([(cx - s * 0.5, cy), (cx - s * 0.15, cy + s * 0.38), (cx + s * 0.55, cy - s * 0.42)],
           fill=color, width=width or max(4, int(s * 0.18)), joint="curve")


def arrow_left(d, cx, cy, s, color):
    w = max(6, int(s * 0.16))
    d.line([(cx + s * 0.5, cy), (cx - s * 0.4, cy)], fill=color, width=w)
    d.polygon([(cx - s * 0.55, cy), (cx - s * 0.15, cy - s * 0.35), (cx - s * 0.15, cy + s * 0.35)], fill=color)


def rrect(draw, box, r, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)


@lru_cache(maxsize=64)
def pill(text, font="h9", size=40, bg=LIME, fg=BLACK, padx=28, pady=10):
    t = T(text, font, size, fg)
    img = Image.new("RGBA", (t.width + 2 * padx, t.height + 2 * pady - 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rrect(d, (0, 0, img.width - 1, img.height - 1), img.height // 2, fill=bg)
    img.paste(t, (padx, pady - 6), t)
    return img


# ---- background ---------------------------------------------------------------
@lru_cache(maxsize=None)
def glow_layer(color, level):
    """Radial glow (pre-rendered at 6 intensities to pulse on the beat)."""
    small = Image.new("RGB", (108, 192), BG)
    d = ImageDraw.Draw(small)
    strength = 0.16 + 0.045 * level
    for r in range(70, 0, -2):
        x = (1 - r / 70) ** 1.6 * strength
        d.ellipse((54 - r * 1.25, 70 - r, 54 + r * 1.25, 70 + r), fill=mix(BG, color, x))
    for r in range(60, 0, -2):
        x = (1 - r / 60) ** 2 * strength * 0.55
        d.ellipse((90 - r, 175 - r, 90 + r, 175 + r), fill=mix(BG, color, x))
    return small.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(8))


@lru_cache(maxsize=None)
def stripes():
    period = 120
    img = Image.new("RGBA", (W + 400, H + period), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(-W - 400, H + period + 400, period):
        d.line((0, y, W + 400, y + W + 400), fill=(255, 255, 255, 9), width=34)
    return img, period


@lru_cache(maxsize=None)
def grain():
    rnd = random.Random(7)
    img = Image.new("L", (W // 2, H // 2))
    img.putdata([128 + int(rnd.gauss(0, 18)) for _ in range(img.width * img.height)])
    img = img.resize((W, H), Image.NEAREST)
    a = img.point(lambda v: abs(v - 128) // 5)
    out = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    out.putalpha(a)
    return out


@lru_cache(maxsize=None)
def vignette():
    small = Image.new("L", (108, 192), 0)
    d = ImageDraw.Draw(small)
    for r in range(120, 0, -2):
        d.ellipse((54 - r * 0.9, 96 - r * 1.2, 54 + r * 0.9, 96 + r * 1.2), fill=int(clamp((r - 55) / 65) * 200))
    small = small.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(10))
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.putalpha(small)
    return out


def beat_level(t):
    ph = (t / C.BEAT) % 1.0
    return int(round(5 * (1 - ph) ** 3))


def background(t, color, intensity=1.0):
    lvl = int(beat_level(t) * intensity)
    frame = glow_layer(color, lvl).copy()
    st, period = stripes()
    off = int((t * 40) % period)
    frame.paste(st.crop((200, off, 200 + W, off + H)), (0, 0), st.crop((200, off, 200 + W, off + H)))
    frame.paste(grain(), (0, 0), grain())
    frame.paste(vignette(), (0, 0), vignette())
    return frame


@lru_cache(maxsize=64)
def outline_number(text, color):
    f = F("r9i", 760)
    x0, y0, x1, y1 = f.getbbox(text, stroke_width=5)
    img = Image.new("RGBA", (x1 - x0 + 40, y1 - y0 + 40), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((20 - x0, 20 - y0), text, font=f, fill=(0, 0, 0, 0),
                             stroke_width=5, stroke_fill=color + (46,))
    return img


# ---- shared UI ----------------------------------------------------------------
@lru_cache(maxsize=64)
def topbar(n, frac_bucket):
    img = Image.new("RGBA", (W, 190), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    segw, gap = (COL_W - 19 * 8) / 20, 8
    for i in range(20):
        # tip 1 sits at the right edge (RTL)
        x1 = COL_R - i * (segw + gap)
        x0 = x1 - segw
        d.rounded_rectangle((x0, 70, x1, 80), 5, fill=(255, 255, 255, 40))
        if i + 1 < n:
            d.rounded_rectangle((x0, 70, x1, 80), 5, fill=LIME)
        elif i + 1 == n:
            fw = segw * frac_bucket / 20
            if fw > 2:
                d.rounded_rectangle((x1 - fw, 70, x1, 80), 5, fill=LIME)
    chip = pill(f"טיפ {n} מתוך 20", "h9", 34, CARD2, WHITE, 24, 10)
    img.paste(chip, (COL_R - chip.width, 104), chip)
    tag = T("#20טיפים", "h7", 32, GRAY)
    img.paste(tag, (COL_L - 4, 106), tag)
    return img


def draw_topbar(frame, n, lt):
    frame.paste(topbar(n, int(clamp(lt / C.TIP) * 20)), (0, 0), topbar(n, int(clamp(lt / C.TIP) * 20)))


# ---- karaoke captions ---------------------------------------------------------
CAP_FONT, CAP_SIZE = "h9", 76
CAP_TOP = 1190


def caption(frame, text, lt, dur, color=LIME, top=CAP_TOP, size=CAP_SIZE, maxw=COL_W - 40):
    words = text.split()
    rows, space = wrap(words, CAP_FONT, size, maxw)
    reveal = min(dur * 0.72, 0.36 * len(words) + 0.5)
    per = reveal / len(words)
    step = int(size * 1.32)
    k = 0
    for ri, row in enumerate(rows):
        widths = [T(w, CAP_FONT, size).width - 12 for w in row]
        roww = sum(widths) + space * (len(row) - 1)
        x = CX + roww / 2
        y = top + ri * step
        for w, ww in zip(row, widths):
            ws = k * per
            k += 1
            if lt < ws:
                x -= ww + space
                continue
            p = prog(lt, ws, 0.16)
            s = lerp(0.55, 1.0, back_out(p)) if p < 1 else 1.0
            current = ws <= lt < ws + per + 0.05 and lt < reveal + 0.3
            if current:
                img = T(w, CAP_FONT, size, BLACK)
                bw, bh = int((ww + 26) * s), int(size * 1.18 * s)
                box = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
                rrect(ImageDraw.Draw(box), (0, 0, bw - 1, bh - 1), 16, fill=color)
                cx, cy = x - ww / 2, y + size * 0.62
                frame.paste(box, (int(cx - bw / 2), int(cy - bh / 2)), box)
            else:
                img = T(w, CAP_FONT, size, WHITE, 4)
            img = scaled(img, s)
            frame.paste(img, (int(x - ww / 2 - img.width / 2), int(y + size * 0.62 - img.height / 2 - 6 * s)), img)
            x -= ww + space


# ---- modules (the infographic for each tip) -----------------------------------
MW, MH = 880, 580
MOD_TOP = 560


def _canvas():
    img = Image.new("RGBA", (MW, MH), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def _card(d, box, fill=CARD, r=36, outline=None):
    rrect(d, box, r, fill=fill + (235,), outline=outline, width=3)


def _ptxt(img, text, cx, cy, font="h9", size=48, fill=WHITE, a=1.0):
    paste_c(img, T(text, font, size, fill), cx, cy, a)


def fmt_num(v, dec):
    s = f"{v:,.{dec}f}"
    return s


def mod_stat(m, a, lt, acc):
    img, d = _canvas()
    _card(d, (20, 20, MW - 20, MH - 20))
    paste_c(img, pill(m["label"], "h9", 40, acc, BLACK), MW / 2, 92)
    if "text" in m:
        s = back_out(prog(lt, 0.2, 0.5))
        paste_c(img, scaled(T(m["text"], "r9i", 250, acc), max(0.01, s)), MW / 2, 285)
    else:
        v = m["value"] * ease_out(prog(lt, 0.2, 1.4))
        paste_c(img, T(fmt_num(v, m["decimals"]), "r9i", 230 if m["value"] < 1000 else 190, acc), MW / 2, 285)
    _ptxt(img, m["unit"], MW / 2, 470, "h9", 62, WHITE)
    return img


def mod_mythfact(m, a, lt, acc):
    img, d = _canvas()
    p1, p2 = ease_out(prog(lt, 0.0, 0.5)), ease_out(prog(lt, 1.6, 0.5))
    # myth card
    y = int(lerp(60, 0, p1))
    card = Image.new("RGBA", (MW, 260), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    _card(cd, (20, 10, MW - 20, 250), CARD, 32, PINK)
    paste_r(card, pill("מיתוס", "h9", 36, PINK, WHITE), MW - 60, 34)
    paste_c(card, E("❌", 48), MW - 60 - pill("מיתוס", "h9", 36, PINK, WHITE).width - 40, 60)
    t = text_block(m["myth"], "h9", 56, GRAY, MW - 140)
    paste_c(card, t, MW / 2, 160)
    st = ease_io(prog(lt, 0.8, 0.5))
    if st > 0:
        x1 = MW / 2 + t.width / 2 + 10
        cd.line((x1, 160, x1 - (t.width + 20) * st, 160), fill=PINK, width=8)
    paste_c(img, card, MW / 2, 130 + y, p1)
    # fact card
    y = int(lerp(60, 0, p2))
    card = Image.new("RGBA", (MW, 280), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    _card(cd, (20, 10, MW - 20, 270), (18, 30, 14), 32, LIME)
    paste_r(card, pill("עובדה", "h9", 36, LIME, BLACK), MW - 60, 34)
    paste_c(card, E("✅", 48), MW - 60 - pill("עובדה", "h9", 36, LIME, BLACK).width - 40, 60)
    paste_c(card, text_block(m["fact"], "h9", 58, WHITE, MW - 140), MW / 2, 170)
    paste_c(img, card, MW / 2, 430 + y, p2)
    return img


def mod_bars(m, a, lt, acc):
    img, d = _canvas()
    _card(d, (20, 20, MW - 20, MH - 20))
    paste_c(img, pill(m["label"], "h9", 36, acc, BLACK), MW / 2, 78)
    items = m["items"]
    n = len(items)
    vmax = max(v for _, v in items)
    base, top = 470, 160
    slot = (MW - 120) / n
    bw = min(150, slot * 0.62)
    for i, (lab, v) in enumerate(items):
        p = ease_out(prog(lt, 0.15 + i * 0.18, 0.7))
        cx = MW - 60 - slot * (i + 0.5)       # RTL: first bar on the right
        h = (base - top) * v / vmax * p
        col = acc if i == n - 1 else mix(acc, CARD2, 0.45)
        rrect(d, (cx - bw / 2, base - max(h, 12), cx + bw / 2, base), 14, fill=col)
        if p > 0.05:
            _ptxt(img, fmt_num(v * p, 1 if v % 1 else 0), cx, base - h - 34, "r9i", 44 if n > 2 else 64,
                  WHITE, clamp(p * 2))
        _ptxt(img, lab, cx, base + 42, "h7", 32 if n > 2 else 36, GRAY)
    return img


def mod_hbars(m, a, lt, acc):
    img, d = _canvas()
    _card(d, (20, 20, MW - 20, MH - 20))
    paste_c(img, pill(m["label"], "h9", 36, acc, BLACK), MW / 2, 78)
    vmax = max(v for _, v in m["items"])
    for i, (lab, v) in enumerate(m["items"]):
        y = 175 + i * 130
        p = ease_out(prog(lt, 0.15 + i * 0.22, 0.8))
        paste_r(img, T(lab, "h9", 44, WHITE), MW - 60, y - 34)
        x1 = MW - 60
        L = (MW - 260) * (v / vmax) * p
        col = PINK if i == 0 else acc if v else CYAN
        rrect(d, (x1 - max(L, 14), y + 34, x1, y + 74), 20, fill=col)
        _ptxt(img, fmt_num(v * p, 0), x1 - max(L, 14) - 70, y + 54, "r9i", 52, WHITE, clamp(p * 3))
    return img


def mod_checklist(m, a, lt, acc):
    img, d = _canvas()
    _card(d, (20, 20, MW - 20, MH - 20))
    n = len(m["items"])
    for i, it in enumerate(m["items"]):
        y = 70 + i * (440 / n) + 20
        p = prog(lt, 0.3 + i * 0.9, 0.35)
        bx = MW - 130
        rrect(d, (bx, y, bx + 64, y + 64), 16, outline=acc if p > 0 else DIM, width=5,
              fill=acc if p >= 1 else None)
        if p > 0:
            check(d, bx + 32, y + 32, 40 * clamp(back_out(p), 0.05, 1.2), BLACK if p >= 1 else acc)
        paste_r(img, T(it, "h9", 52, WHITE if p > 0 else GRAY), bx - 30, y - 6)
    return img


def mod_timer(m, a, lt, acc):
    img, d = _canvas()
    cx, cy, r = MW / 2, MH / 2, 245
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=CARD + (240,))
    d.arc((cx - r + 24, cy - r + 24, cx + r - 24, cy + r - 24), 0, 360, fill=CARD2, width=34)
    p = ease_out(prog(lt, 0.2, 1.8)) * m["frac"]
    if p > 0.005:
        d.arc((cx - r + 24, cy - r + 24, cx + r - 24, cy + r - 24), -90, -90 + 360 * p, fill=acc, width=34)
    _ptxt(img, m["text"], cx, cy - 30, "r9i", 170, WHITE)
    _ptxt(img, m["unit"], cx, cy + 105, "h9", 54, acc)
    return img


def mod_plate(m, a, lt, acc):
    img, d = _canvas()
    _card(d, (20, 20, MW - 20, MH - 20))
    cx, cy, r = 300, MH / 2, 210
    d.ellipse((cx - r - 16, cy - r - 16, cx + r + 16, cy + r + 16), fill=(235, 235, 240))
    cols = [LIME, PINK, ORANGE]
    ang = -90
    p = ease_out(prog(lt, 0.1, 1.4))
    for i, (lab, frac) in enumerate(m["items"]):
        sweep = 360 * frac * p
        if sweep > 0.5:
            d.pieslice((cx - r, cy - r, cx + r, cy + r), ang, ang + sweep, fill=cols[i], outline=(235, 235, 240), width=6)
        ang += sweep
    for i, (lab, frac) in enumerate(m["items"]):
        y = 150 + i * 120
        q = prog(lt, 0.4 + i * 0.3, 0.3)
        d.rounded_rectangle((MW - 110, y, MW - 66, y + 44), 10, fill=cols[i])
        paste_r(img, T(lab, "h9", 50, WHITE), MW - 130, y - 18, q)
        paste_r(img, T(f"{int(frac * 100)}%", "r9i", 40, GRAY), MW - 130, y + 40, q)
    return img


def mod_trend(m, a, lt, acc):
    img, d = _canvas()
    _card(d, (20, 20, MW - 20, MH - 20))
    paste_c(img, pill("משקל בבוקר, 4 שבועות", "h9", 34, CARD2, WHITE), MW / 2, 70)
    rnd = random.Random(3)
    pts = []
    for i in range(28):
        avg = 80 - i * 0.08
        pts.append((i, avg + rnd.uniform(-0.9, 0.9) + (0.7 if i % 7 == 5 else 0)))
    x0, x1, y0, y1 = 80, MW - 80, 140, 500
    vmin, vmax = 76.5, 81.5

    def P(i, v):
        return x0 + (x1 - x0) * i / 27, y1 - (y1 - y0) * (v - vmin) / (vmax - vmin)
    p = prog(lt, 0.1, 2.0)
    shown = int(28 * p)
    for i, v in pts[:shown]:
        x, y = P(i, v)
        d.ellipse((x - 9, y - 9, x + 9, y + 9), fill=GRAY)
    q = ease_io(prog(lt, 1.2, 1.6))
    if q > 0:
        line = []
        for k in range(int(4 * q * 10) + 1):
            i = k / 40 * 27
            line.append(P(i, 80 - i * 0.08 - 0.05))
        if len(line) > 1:
            d.line(line, fill=acc, width=12, joint="curve")
    paste_c(img, pill("ממוצע שבועי", "h9", 32, acc, BLACK), MW - 190, 540 - 20, q)
    paste_c(img, pill("ימים בודדים", "h7", 30, CARD2, GRAY), 180, 540 - 20, clamp(p * 2))
    return img


def mod_curves(m, a, lt, acc):
    img, d = _canvas()
    _card(d, (20, 20, MW - 20, MH - 20))
    paste_c(img, pill(m["label"], "h9", 34, CARD2, WHITE), MW / 2, 70)
    x0, x1, base = 80, MW - 80, 470
    p = ease_io(prog(lt, 0.2, 1.8))

    def curve(peak, width, col):
        pts = []
        n = int(80 * p)
        for k in range(n + 1):
            u = k / 80
            v = peak * math.exp(-((u - 0.35) / width) ** 2) * (1 - 0.15 * u)
            pts.append((x1 - (x1 - x0) * u, base - v))      # time flows right-to-left
        if len(pts) > 1:
            d.line(pts, fill=col, width=12, joint="curve")
    curve(300, 0.2, PINK)
    curve(160, 0.24, acc)
    d.line((x0, base + 6, x1, base + 6), fill=DIM, width=4)
    q = prog(lt, 1.6, 0.4)
    paste_c(img, pill(m["a"], "h9", 32, PINK, WHITE), 300, 140, q)
    paste_c(img, pill(m["b"], "h9", 32, acc, BLACK), 470, 370, q)
    _ptxt(img, "זמן", 190, 515, "h7", 30, GRAY)
    arrow_left(d, 120, 517, 50, GRAY)
    return img


def mod_log(m, a, lt, acc):
    img, d = _canvas()
    _card(d, (60, 20, MW - 60, MH - 20), (242, 242, 236), 32)
    rrect(d, (60, 20, MW - 60, 120), 32, fill=acc)
    d.rectangle((60, 90, MW - 60, 120), fill=acc)
    paste_c(img, T("אימון רגליים · יום ג׳", "h9", 46, BLACK), MW / 2, 70)
    for i, (ex, val) in enumerate(m["rows"]):
        y = 150 + i * 98
        p = prog(lt, 0.3 + i * 0.6, 0.3)
        d.line((100, y + 84, MW - 100, y + 84), fill=(210, 210, 200), width=3)
        paste_r(img, T(ex, "h9", 46, (20, 20, 24)), MW - 110, y + 6, p)
        # weight x reps, reversed so it still reads "60 × 8" inside an RTL run
        paste_c(img, T(" × ".join(reversed(val.split(" × "))), "r9", 46, (60, 60, 70)), 330, y + 40, p)
        if p >= 1:
            check(d, 150, y + 40, 44, (40, 160, 60))
    return img


def mod_tank(m, a, lt, acc):
    img, d = _canvas()
    _card(d, (20, 20, MW - 20, MH - 20))
    paste_c(img, pill(m["label"], "h9", 36, acc, BLACK), MW / 2, 78)
    n, used = m["total"], m["used"]
    bx0, bx1, by0, by1 = 90, MW - 120, 170, 360
    rrect(d, (bx0, by0, bx1, by1), 30, outline=WHITE, width=8)
    d.rounded_rectangle((bx0 - 34, by0 + 60, bx0 - 6, by1 - 60), 8, fill=WHITE)
    cw = (bx1 - bx0 - 30 - (n - 1) * 10) / n
    for i in range(n):
        x1 = bx1 - 15 - i * (cw + 10)       # fill from the right (RTL)
        p = prog(lt, 0.2 + i * 0.12, 0.2)
        if i < used:
            col = mix(CARD2, PINK, p)
        else:
            blink = 0.65 + 0.35 * math.sin(lt * 6) if lt > 1.6 else p
            col = mix(CARD2, acc, blink * p)
        rrect(d, (x1 - cw, by0 + 15, x1, by1 - 15), 12, fill=col)
    q = prog(lt, 1.5, 0.4)
    _ptxt(img, "עבדת", bx1 - (used * (cw + 10)) / 2 - 10, 420, "h9", 46, PINK, q)
    _ptxt(img, "1–3 בטנק", bx0 + ((n - used) * (cw + 10)) / 2 + 20, 420, "h9", 46, acc, q)
    _ptxt(img, "עוצרים כאן ולא בכישלון", MW / 2, 500, "h7", 38, GRAY, q)
    return img


def mod_week(m, a, lt, acc):
    img, d = _canvas()
    _card(d, (20, 20, MW - 20, MH - 20))
    paste_c(img, pill("שבוע לדוגמה", "h9", 36, CARD2, WHITE), MW / 2, 78)
    slot = (MW - 100) / 7
    for i, (day, what) in enumerate(m["days"]):
        cx = MW - 50 - slot * (i + 0.5)
        p = back_out(prog(lt, 0.2 + i * 0.15, 0.35))
        rest = what == "מנוחה"
        col = acc if rest else CARD2
        r = 48 * clamp(p, 0, 1.3)
        if r > 1:
            d.ellipse((cx - r, 260 - r, cx + r, 260 + r), fill=col)
        _ptxt(img, day, cx, 255, "h9", 42, BLACK if rest else WHITE, clamp(p))
        _ptxt(img, what, cx, 350, "h7", 26, acc if rest else GRAY, clamp(p))
    return img


def mod_photos(m, a, lt, acc):
    img, d = _canvas()
    for k, (lab, cx, glow) in enumerate([(m["a"], MW - 230, 0.0), (m["b"], 230, 1.0)]):
        p = ease_out(prog(lt, 0.2 + k * 0.6, 0.5))
        layer = Image.new("RGBA", (330, 540), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        rrect(ld, (0, 0, 329, 539), 40, fill=CARD, outline=acc if k else DIM, width=6)
        body = mix(GRAY, acc, glow * 0.6)
        ld.ellipse((125, 90, 205, 170), fill=body)
        sh = 1.0 + 0.18 * glow
        ld.polygon([(165 - 95 * sh, 200), (165 + 95 * sh, 200), (165 + 62, 390), (165 - 62, 390)], fill=body)
        ld.rectangle((165 - 60, 390, 165 + 60, 470), fill=body)
        paste_c(layer, pill(lab, "h9", 34, acc if k else CARD2, BLACK if k else WHITE), 165, 505)
        paste_c(img, layer, cx, 290 + (1 - p) * 60, p)
    q = back_out(prog(lt, 1.2, 0.4))
    if q > 0.01:
        arrow_left(d, MW / 2, 280, 90 * min(q, 1.2), acc)
    return img


def mod_weeks12(m, a, lt, acc):
    img, d = _canvas()
    cx, cy, r = MW / 2, MH / 2, 250
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=CARD + (240,))
    p = prog(lt, 0.2, 2.4)
    for i in range(12):
        s = -90 + i * 30 + 2
        on = p * 12 > i + 1 or (i == 0 and p > 0)
        col = acc if i == 0 else (mix(CARD2, acc, 0.35) if on else CARD2)
        d.arc((cx - r + 26, cy - r + 26, cx + r - 26, cy + r - 26), s, s + 26, fill=col, width=40)
    _ptxt(img, "12", cx, cy - 40, "r9i", 190, WHITE)
    _ptxt(img, "שבועות", cx, cy + 90, "h9", 54, acc)
    return img


MODULES = dict(stat=mod_stat, mythfact=mod_mythfact, bars=mod_bars, hbars=mod_hbars, checklist=mod_checklist,
               timer=mod_timer, plate=mod_plate, trend=mod_trend, curves=mod_curves, log=mod_log,
               tank=mod_tank, week=mod_week, photos=mod_photos, weeks12=mod_weeks12)
STATIC_AFTER = 5.0       # seconds after which a module stops animating and is cached
_mod_cache = {}


def module_img(tip, lt, acc):
    m = tip["module"]
    if m["type"] == "tank" and lt > 1.6:
        lt_key = round(lt * 10) / 10      # keeps blinking, still cheap
        key = (tip["n"], lt_key % 1.1)
        if key not in _mod_cache:
            _mod_cache[key] = MODULES["tank"](m, 1, lt_key, acc)
        return _mod_cache[key]
    if lt >= STATIC_AFTER:
        key = (tip["n"], "static")
        if key not in _mod_cache:
            _mod_cache[key] = MODULES[m["type"]](m, 1, STATIC_AFTER, acc)
        return _mod_cache[key]
    return MODULES[m["type"]](m, 1, lt, acc)


# ---- scenes -------------------------------------------------------------------
def shake(t, amp, seed=0):
    return (amp * math.sin(t * 91 + seed) * math.cos(t * 37), amp * math.cos(t * 83 + seed) * math.sin(t * 29))


def flash(frame, a, color=WHITE):
    if a <= 0.01:
        return frame
    return Image.blend(frame, Image.new("RGB", (W, H), color), clamp(a))


@lru_cache(maxsize=32)
def tip_number(n, acc):
    return T(f"#{n:02d}", "r9i", 470, acc, 10, BLACK)


@lru_cache(maxsize=32)
def title_block(n, title, size):
    return text_block(title, "h9", size, WHITE, COL_W - 40, 1.08, 3)


def wipe(frame, p, color, out=False):
    """Diagonal band; p 0..1 covers the screen (or uncovers it when out=True)."""
    if p <= 0 or p >= 1 and out:
        return
    d = ImageDraw.Draw(frame)
    sk = 500
    if not out:
        x = lerp(W + sk, -sk, ease_in(p) if p < 1 else 1)
        d.polygon([(x, 0), (W + sk, 0), (W + sk, H), (x + sk, H)], fill=color)
    else:
        x = lerp(W + sk, -sk, ease_out(p))
        d.polygon([(-sk, 0), (x, 0), (x + sk, H), (-sk, H)], fill=color)


def scene_tip(t, lt, tip):
    n = tip["n"]
    acc = ACCENTS[(n - 1) % 4]
    frame = background(t, acc)
    # big outline number drifting in the back
    on = outline_number(f"{n:02d}", acc)
    paste_c(frame, on, CX + 60 * math.sin(lt * 0.15), 980 + 40 * math.cos(lt * 0.11), clamp(lt / 1.0) * 0.9)

    if lt < C.T_SLAM_END + 0.4:
        # 1) number slam
        p = prog(lt, 0.0, 0.32)
        s = lerp(2.4, 1.0, ease_out(p))
        out = prog(lt, C.T_SLAM_END - 0.3, 0.4)
        s *= lerp(1, 0.2, ease_in(out))
        dx, dy = shake(lt, 26 * (1 - prog(lt, 0.3, 0.8)), n)
        num = scaled(tip_number(n, acc), s)
        paste_c(frame, num, CX + dx, 840 + dy, (1 - out) * clamp(p * 3))
        ep = back_out(prog(lt, 0.35, 0.35))
        if ep > 0.01 and out < 1:
            emo = scaled(E(tip["emoji"], 220), max(0.02, ep * (1 - out)))
            paste_c(frame, rotated(emo, -12 + 6 * math.sin(lt * 5)), CX + 290, 590)
        lab = T("טיפ", "h9", 90, WHITE, 4)
        paste_c(frame, lab, CX - 250 + dx, 600 + dy, clamp(p * 2) * (1 - out))
        frame = flash(frame, 0.85 * (1 - prog(lt, 0.0, 0.18)))

    if C.T_SLAM_END - 0.1 <= lt < C.T_HEADER + 0.6:
        # 2) title, word by word in the centre, then flying to the header
        words = tip["title"].split()
        rows, space = wrap(words, "h9", 112, COL_W - 40)
        span = C.T_TITLE_END - 0.9 - C.T_SLAM_END
        per = span / len(words)
        mv = ease_io(prog(lt, C.T_TITLE_END, C.T_HEADER - C.T_TITLE_END))
        if mv <= 0:
            step = int(112 * 1.1)
            top = 960 - step * len(rows) / 2
            k = 0
            for ri, row in enumerate(rows):
                widths = [T(w, "h9", 112, WHITE, 3).width - 18 for w in row]
                roww = sum(widths) + space * (len(row) - 1)
                x = CX + roww / 2
                for w, ww in zip(row, widths):
                    ws = C.T_SLAM_END + k * per
                    k += 1
                    if lt >= ws:
                        p = prog(lt, ws, 0.2)
                        hot = lt < ws + per
                        img = T(w, "h9", 112, acc if hot else WHITE, 3)
                        img = scaled(img, lerp(1.5, 1.0, back_out(p)))
                        paste_c(frame, img, x - ww / 2, top + ri * step + 60, clamp(p * 3))
                    x -= ww + space
        else:
            big = title_block(n, tip["title"], 112)
            small = title_block(n, tip["title"], 74)
            s = lerp(1.0, small.width / big.width, mv)
            cy = lerp(960, 200 + small.height / 2, mv)
            paste_c(frame, scaled(big, s), CX, cy)

    if lt >= C.T_HEADER + 0.6:
        hb = title_block(n, tip["title"], 74)
        hy = 200 + hb.height / 2
        paste_c(frame, hb, CX, hy)

    draw_topbar(frame, n, lt)

    # 3) module
    if lt >= C.T_HEADER:
        ml = lt - C.T_HEADER
        p = ease_out(prog(ml, 0, 0.55))
        dim = 1 - 0.7 * ease_io(prog(lt, C.T_TAKE, 0.4))
        img = module_img(tip, ml, acc)
        paste_c(frame, img, CX, MOD_TOP + MH / 2 + (1 - p) * 120, p * dim)

    # 4) karaoke captions
    if C.T_BODY <= lt < C.T_TAKE:
        lines = tip["lines"]
        dur = (C.T_TAKE - C.T_BODY) / len(lines)
        i = int((lt - C.T_BODY) / dur)
        caption(frame, lines[i], lt - C.T_BODY - i * dur, dur, acc)

    # 5) takeaway
    if lt >= C.T_TAKE:
        p = ease_out(prog(lt, C.T_TAKE, 0.45))
        lab = pill("תכל׳ס 👇".replace(" 👇", ""), "h9", 46, PINK, WHITE)
        paste_c(frame, lab, CX + (1 - p) * 700, 1150)
        slab_txt = text_block(tip["take"], "h9", 78, BLACK, COL_W - 120, 1.1)
        slab = Image.new("RGBA", (COL_W, slab_txt.height + 80), (0, 0, 0, 0))
        rrect(ImageDraw.Draw(slab), (0, 0, slab.width - 1, slab.height - 1), 34, fill=acc)
        paste_c(slab, slab_txt, slab.width / 2, slab.height / 2 + 4)
        slab = rotated(slab, -2.5)
        paste_c(frame, slab, CX + (1 - p) * 900, 1230 + slab.height / 2)

    # 6) save sticker
    if lt >= C.T_STICKER:
        p = back_out(prog(lt, C.T_STICKER, 0.35))
        st = sticker("שמור את זה", "🔖")
        wob = 7 + 2 * math.sin(lt * 7)
        paste_c(frame, scaled(rotated(st, wob), max(0.02, p)), 300, 1610)

    # 7) wipes in/out
    if lt < 0.3:
        wipe(frame, lt / 0.3, ACCENTS[(n - 2) % 4], out=True)
    if lt >= C.T_WIPE:
        wipe(frame, prog(lt, C.T_WIPE, C.TIP - C.T_WIPE - 0.02), acc)
    return frame


@lru_cache(maxsize=16)
def sticker(text, emo, bg=WHITE, fg=BLACK, size=50):
    t = T(text, "h9", size, fg)
    e = E(emo, int(size * 1.15))
    w = t.width + e.width + 70
    h = max(t.height, e.height) + 30
    img = Image.new("RGBA", (w + 12, h + 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rrect(d, (8, 10, w + 8, h + 10), 26, fill=(0, 0, 0, 140))
    rrect(d, (0, 0, w, h), 26, fill=bg)
    img.paste(t, (w - t.width - 20, (h - t.height) // 2 + 2), t)
    img.paste(e, (26, (h - e.height) // 2), e)
    return img


def big_line(frame, text, cy, lt, start, size=120, color=WHITE, stroke=4, emo=None, emo_size=None):
    if lt < start:
        return
    p = prog(lt, start, 0.25)
    blk = text_block(text, "h9", size, color, COL_W - 20, 1.06, stroke)
    paste_c(frame, scaled(blk, lerp(1.35, 1.0, back_out(p))), CX, cy, clamp(p * 3))
    if emo:
        q = back_out(prog(lt, start + 0.2, 0.35))
        paste_c(frame, rotated(scaled(E(emo, emo_size or size * 1.4), max(0.02, q)), 10 * math.sin(lt * 4)),
                CX, cy - blk.height / 2 - (emo_size or size * 1.4) / 2 - 20)


def scene_intro(t, lt):
    frame = background(t, PINK if lt < 16 else LIME, 1.0 if lt > 16 else 0.4)
    if lt < 1.6:
        dx, dy = shake(lt, 30 * (1 - prog(lt, 0, 0.8)))
        frame2 = frame
        big_line(frame2, "תפסיק לגלול", 960 + dy, lt, 0.0, 150, WHITE, 6, "✋", 260)
        frame = flash(frame2, 0.9 * (1 - prog(lt, 0, 0.2)))
    elif lt < 5.0:
        big_line(frame, "20 טיפים", 840, lt, 1.6, 190, LIME, 6)
        big_line(frame, "לכושר", 1050, lt, 2.2, 190, WHITE, 6)
        big_line(frame, "בלי שטויות", 1260, lt, 3.0, 100, PINK, 4)
    elif lt < 10.0:
        big_line(frame, "שאף אחד", 860, lt, 5.0, 150, WHITE, 5)
        big_line(frame, "לא אומר לך", 1060, lt, 5.6, 150, LIME, 5, None)
        if lt > 6.5:
            paste_c(frame, rotated(E("🤫", 230), -8 + 6 * math.sin(lt * 4)), CX, 620,
                    clamp((lt - 6.5) * 4))
    elif lt < 16.0:
        big_line(frame, "טיפ 17", 800, lt, 10.0, 200, PINK, 6)
        big_line(frame, "הולך לשבור לך את הראש", 1070, lt, 10.8, 110, WHITE, 4)
        if lt > 12:
            paste_c(frame, scaled(E("🤯", 240), back_out(prog(lt, 12, 0.4))), CX, 1380)
    elif lt < 22.0:
        big_line(frame, "תשמור את הסרטון", 860, lt, 16.0, 120, WHITE, 5)
        big_line(frame, "תחזור אליו כל שבוע", 1060, lt, 16.8, 96, LIME, 4)
        if lt > 17.5:
            paste_c(frame, rotated(scaled(sticker("שמור", "🔖", LIME, BLACK, 70), back_out(prog(lt, 17.5, 0.4))), 6),
                    CX, 1340)
    elif lt < 30.0:
        # rapid-fire preview of all 20, two per second on the beat
        i = min(19, int((lt - 22.0) / 0.4))
        tip = C.TIPS[i]
        acc = ACCENTS[i % 4]
        q = prog(lt, 22.0 + i * 0.4, 0.12)
        paste_c(frame, scaled(T(f"#{i + 1:02d}", "r9i", 300, acc, 8), lerp(1.3, 1, ease_out(q))), CX, 820)
        paste_c(frame, text_block(tip["short"], "h9", 96, WHITE, COL_W, 1.05, 4), CX, 1080)
        paste_c(frame, E(tip["emoji"], 170), CX, 560)
        frame = flash(frame, 0.25 * (1 - q))
    else:
        k = int((lt - 30.0) / 2.0)   # 3, 2, 1
        q = prog(lt, 30.0 + k * 2.0, 0.3)
        label = ["3", "2", "1"][min(k, 2)]
        paste_c(frame, scaled(T(label, "r9i", 640, [LIME, PINK, CYAN][min(k, 2)], 10), lerp(1.8, 1, ease_out(q))), CX, 900)
        big_line(frame, "יוצאים לדרך", 1350, lt, 30.0, 90, WHITE, 4)
        frame = flash(frame, 0.5 * (1 - prog(lt, 30.0 + k * 2.0, 0.2)))
        if lt > 35.4:
            wipe(frame, prog(lt, 35.4, 0.58), ACCENTS[3])
    return frame


def scene_inter(t, lt, data):
    frame = background(t, PINK)
    if lt < 0.3:
        wipe(frame, lt / 0.3, ACCENTS[(data["n"] - 1) % 4], out=True)
    dx, dy = shake(lt, 20 * (1 - prog(lt, 0, 0.6)))
    stop, semo = split_emoji(data["stop"])
    big_line(frame, stop, 700 + dy, lt, 0.0, 170, LIME, 6, semo[0] if semo else None, 200)
    big_line(frame, data["line1"], 960, lt, 1.4, 96, WHITE, 4)
    words, emos = split_emoji(data["line2"])
    big_line(frame, words, 1150, lt, 3.0, 96, WHITE, 4)
    if emos and lt > 3.4:
        q = back_out(prog(lt, 3.4, 0.4))
        bounce = abs(math.sin(lt * 6)) * 30
        paste_c(frame, scaled(E(emos[0], 200), max(0.02, q)), CX, 1380 - bounce)
    if lt > 5.0:
        paste_c(frame, pill(data["line3"], "h9", 46, PINK, WHITE), CX, 1580, clamp((lt - 5) * 4))
    if lt >= C.INTER - 0.6:
        wipe(frame, prog(lt, C.INTER - 0.6, 0.58), ACCENTS[(data["n"] - 1) % 4])
    return frame


def scene_outro(t, lt):
    frame = background(t, LIME, 0.8)
    if lt < 0.3:
        wipe(frame, lt / 0.3, ACCENTS[3], out=True)
    if lt < 9.0:
        big_line(frame, "כל ה-20 במבט אחד", 200, lt, 0.0, 78, LIME, 3)
        for i, tip in enumerate(C.TIPS):
            col, row = i // 10, i % 10
            s = 0.4 + i * 0.3
            if lt < s:
                continue
            p = ease_out(prog(lt, s, 0.25))
            x = COL_R - 10 - col * 445
            y = 320 + row * 118
            card = Image.new("RGBA", (430, 100), (0, 0, 0, 0))
            cd = ImageDraw.Draw(card)
            rrect(cd, (0, 0, 429, 99), 24, fill=CARD + (235,))
            num = T(f"{i + 1:02d}", "r9i", 50, ACCENTS[i % 4])
            card.paste(num, (430 - num.width - 14, 18), num)
            lab = T(tip["short"], "h9", 36, WHITE)
            card.paste(lab, (430 - num.width - 24 - lab.width, 26), lab)
            paste_c(frame, card, x - 215 + (1 - p) * 120, y + 50, p)
    elif lt < 14.0:
        big_line(frame, "איזה טיפ", 800, lt, 9.0, 150, WHITE, 5)
        big_line(frame, "הכי הפתיע אותך?", 990, lt, 9.5, 120, LIME, 5)
        if lt > 10.5:
            bounce = abs(math.sin(lt * 5)) * 30
            paste_c(frame, E("👇", 200), CX, 1300 + bounce)
            paste_c(frame, pill("כתוב את המספר בתגובות", "h9", 44, PINK, WHITE), CX, 1500, clamp((lt - 10.5) * 4))
    elif lt < 19.0:
        big_line(frame, "חלק 2", 820, lt, 14.0, 220, LIME, 7)
        big_line(frame, "כבר בדרך", 1060, lt, 14.6, 130, WHITE, 5)
        if lt > 15.6:
            p = back_out(prog(lt, 15.6, 0.4))
            paste_c(frame, scaled(sticker("עקוב כדי לא לפספס", "➕", LIME, BLACK, 56), max(0.02, p)), CX, 1330)
    else:
        # last second hands back to the very first frame so the video loops
        big_line(frame, "תפסיק לגלול", 960, lt, 19.0, 150, WHITE, 6, "✋", 260)
        frame = flash(frame, 0.6 * prog(lt, 19.6, 0.4))
    return frame


def render_at(t):
    for kind, s, d, data in C.SEGMENTS:
        if s <= t < s + d:
            lt = t - s
            if kind == "tip":
                return scene_tip(t, lt, data)
            if kind == "inter":
                return scene_inter(t, lt, data)
            if kind == "intro":
                return scene_intro(t, lt)
            return scene_outro(t, lt)
    return scene_outro(C.TOTAL - 0.001, C.OUTRO - 0.001)


def main():
    mode = sys.argv[1]
    if mode == "still":
        render_at(float(sys.argv[2])).save(sys.argv[3])
    elif mode == "chunk":
        f0, f1, out = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
        ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                               "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "fast",
                               "-crf", "23", "-tune", "animation", "-pix_fmt", "yuv420p", "-threads", "2",
                               "-g", "60", out], stdin=subprocess.PIPE)
        for f in range(f0, f1):
            ff.stdin.write(render_at(f / FPS).tobytes())
            if f % 300 == 0:
                print(f"{out}: frame {f}", flush=True)
        ff.stdin.close()
        ff.wait()


if __name__ == "__main__":
    main()
