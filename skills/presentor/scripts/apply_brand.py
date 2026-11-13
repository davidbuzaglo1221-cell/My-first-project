#!/usr/bin/env python3
"""Apply brand.json to a deck or to the template.

  python apply_brand.py brand.json                 -> rewrites the skill's template/deck.html
  python apply_brand.py brand.json deck.src.html   -> rewrites that file (one or more files)

Rewrites: the :root colors (missing ones are derived from "accent"), --radius, the font
(any Google Font, embedded as base64; Noto Sans Hebrew is added for Hebrew when the font
has no Hebrew), the logo (base64 into every img.logo), <html dir lang>, light/dark backgrounds.
Prints a contrast check.
"""
import base64
import json
import mimetypes
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import SKILL_DIR, die, embed_google_font  # noqa: E402

RADIUS = {"square": "0cqw", "soft": "1.2cqw", "round": "2.6cqw"}
KEYS = ["accent", "ink", "paper", "tint", "muted", "line", "on-accent"]


def hex2rgb(h):
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        die("bad color: #%s (use #RRGGBB)" % h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb2hex(c):
    return "#%02X%02X%02X" % tuple(max(0, min(255, round(v))) for v in c)


def mix(a, b, t):  # t = amount of a
    a, b = hex2rgb(a), hex2rgb(b)
    return rgb2hex([a[i] * t + b[i] * (1 - t) for i in range(3)])


def lum(h):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(v) for v in hex2rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def derive(colors):
    c = {k.replace("_", "-"): (v or "").strip() for k, v in colors.items()}
    acc = c.get("accent") or die("brand.json: colors.accent is required")
    acc = rgb2hex(hex2rgb(acc))
    c["accent"] = acc
    c["ink"] = c.get("ink") or mix(acc, "#000000", 0.18)
    while contrast(c["ink"], "#FFFFFF") < 12:
        c["ink"] = mix(c["ink"], "#000000", 0.85)
    c["paper"] = c.get("paper") or mix(acc, "#FBF8F2", 0.05)
    c["tint"] = c.get("tint") or mix(acc, "#FFFFFF", 0.12)
    c["muted"] = c.get("muted") or mix(c["ink"], "#FFFFFF", 0.68)
    while contrast(c["muted"], "#FFFFFF") < 5.5:
        c["muted"] = mix(c["muted"], "#000000", 0.9)
    c["line"] = c.get("line") or mix(c["ink"], "#FFFFFF", 0.16)
    if not c.get("on-accent"):
        c["on-accent"] = "#FFFFFF" if contrast(acc, "#FFFFFF") >= contrast(acc, c["ink"]) else c["ink"]
    return {k: rgb2hex(hex2rgb(c[k])) for k in KEYS}


def report(c):
    checks = [("ink on white", c["ink"], "#FFFFFF", 7), ("ink on paper", c["ink"], c["paper"], 7),
              ("ink on tint", c["ink"], c["tint"], 7), ("paper on ink (dark slides)", c["paper"], c["ink"], 7),
              ("muted on white", c["muted"], "#FFFFFF", 4.5), ("on-accent on accent", c["on-accent"], c["accent"], 4.5),
              ("accent on white (big titles)", c["accent"], "#FFFFFF", 3)]
    bad = 0
    for name, a, b, need in checks:
        r = contrast(a, b)
        ok = r >= need
        bad += not ok
        print("  %-30s %5.1f  %s" % (name, r, "ok" if ok else "LOW (need %.1f)" % need))
    return bad


def logo_uri(path):
    p = Path(path)
    if not p.is_file():
        die("logo not found: %s" % p)
    mime = mimetypes.guess_type(str(p))[0] or "image/png"
    return "data:%s;base64,%s" % (mime, base64.b64encode(p.read_bytes()).decode("ascii"))


def replace_block(html, start, end, new):
    pat = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if len(pat.findall(html)) != 1:
        die("marker %s ... %s must appear exactly once" % (start, end))
    return pat.sub(lambda m: start + "\n" + new + "\n" + end, html)


def main():
    if len(sys.argv) < 2:
        die("usage: python apply_brand.py brand.json [file.html ...]")
    bpath = Path(sys.argv[1]).resolve()
    brand = json.loads(bpath.read_text(encoding="utf-8"))
    targets = [Path(t).resolve() for t in sys.argv[2:]] or [SKILL_DIR / "template" / "deck.html"]

    colors = derive(brand.get("colors") or {"accent": brand.get("accent", "")})
    radius = str(brand.get("radius", "soft")).strip()
    radius = RADIUS.get(radius, radius)
    font = (brand.get("font") or "Noto Sans Hebrew").strip()
    lang = (brand.get("lang") or brand.get("language") or "he").strip()
    lang = {"hebrew": "he", "עברית": "he", "english": "en", "אנגלית": "en"}.get(lang.lower(), lang)
    direction = (brand.get("dir") or ("rtl" if lang in ("he", "ar", "fa", "yi") else "ltr")).strip()
    mode = "dark" if str(brand.get("backgrounds", "light")).lower().startswith("dark") else "light"

    print("colors:")
    for k in KEYS:
        print("  --%-10s %s" % (k, colors[k]))
    bad = report(colors)

    font_css, subsets = embed_google_font(font)
    fallback = ""
    if not font_css:
        die("font '%s' has no Latin or Hebrew subset" % font)
    if "hebrew" not in subsets and font != "Noto Sans Hebrew":
        print("note: '%s' has no Hebrew letters; Hebrew text uses Noto Sans Hebrew" % font)
        heb, _ = embed_google_font("Noto Sans Hebrew", subsets=("hebrew",))
        font_css += "\n" + heb
        fallback = ", 'Noto Sans Hebrew'"
    root = (":root{\n" + "".join("  --%s: %s;\n" % (k, colors[k]) for k in KEYS) +
            "  --radius: %s;\n  --font: '%s'%s, 'Noto Sans Hebrew', Arial, sans-serif;\n}" % (radius, font, fallback))

    logo = brand.get("logo") or ""
    if logo:
        lp = Path(logo)
        if not lp.is_absolute():
            lp = (bpath.parent / lp) if (bpath.parent / lp).is_file() else (SKILL_DIR / lp)
        logo = logo_uri(lp)

    for t in targets:
        html = t.read_text(encoding="utf-8")
        html = replace_block(html, "/*THEME-START*/", "/*THEME-END*/", root)
        html = replace_block(html, "/*FONT-START*/", "/*FONT-END*/", font_css)
        html, n = re.subn(r"<html\b[^>]*>", '<html dir="%s" lang="%s" data-mode="%s">' % (direction, lang, mode), html, count=1)
        if n != 1:
            die("no <html> tag in %s" % t)
        if logo:
            def put(m):
                tag = m.group(0)
                if re.search(r'\ssrc="[^"]*"', tag):
                    return re.sub(r'\ssrc="[^"]*"', ' src="%s"' % logo, tag)
                return tag.replace("<img", '<img src="%s"' % logo, 1)
            html = re.sub(r'<img\b[^>]*class="logo"[^>]*>', put, html)
        t.write_text(html, encoding="utf-8")
        print("branded %s  (font: %s, radius: %s, dir: %s, backgrounds: %s, logo: %s)"
              % (t, font, radius, direction, mode, "yes" if logo else "no"))
    if bad:
        print("WARNING: %d contrast check(s) are low - pick a darker/lighter color." % bad)


if __name__ == "__main__":
    main()
