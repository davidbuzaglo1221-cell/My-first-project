#!/usr/bin/env python3
"""Build a deck:  python build.py path/to/<name>.src.html   ->  path/to/<name>.html

  {{IMG:name}}   base64 data URI of images/name(.png/.jpg/...) next to the source file
  {{QR:link}}    inline SVG QR code for the link (needs: pip install qrcode)
  Hebrew prefix letters glued to an English word (like "לZoom", "בChatGPT") are wrapped
  in <span class="nw"> (white-space:nowrap) so they never break apart.
  Fails if any "{{" is left in the result.
"""
import base64
import mimetypes
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import die  # noqa: E402

IMG_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg")


def img_uri(name, img_dir):
    name = name.strip()
    p = img_dir / name
    if not p.is_file():
        hits = [img_dir / (name + e) for e in IMG_EXT if (img_dir / (name + e)).is_file()]
        if not hits:
            die("image '%s' not found in %s" % (name, img_dir))
        p = hits[0]
    mime = mimetypes.guess_type(str(p))[0] or "image/png"
    if p.suffix.lower() == ".svg":
        mime = "image/svg+xml"
    return "data:%s;base64,%s" % (mime, base64.b64encode(p.read_bytes()).decode("ascii"))


def qr_svg(link):
    try:
        import qrcode
    except ImportError:
        die("qrcode is missing: pip install qrcode")
    qr = qrcode.QRCode(border=2, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(link.strip())
    qr.make(fit=True)
    m = qr.get_matrix()
    n = len(m)
    d = "".join("M%d %dh1v1h-1z" % (x, y) for y, row in enumerate(m) for x, v in enumerate(row) if v)
    return ('<svg class="qrsvg" viewBox="0 0 %d %d" shape-rendering="crispEdges" role="img" '
            'aria-label="QR"><path fill="currentColor" d="%s"/></svg>' % (n, n, d))


TOKEN = re.compile(r"(<!--.*?-->|<script\b.*?</script>|<style\b.*?</style>|<svg\b.*?</svg>|"
                   r"<title\b.*?</title>|<[^>]+>)", re.S | re.I)
PREFIX = re.compile(r"(?<![֐-׿A-Za-z0-9])([והבכלמש]{1,3}[-־]?)"
                    r"([A-Za-z][A-Za-z0-9.+#]*)")


def wrap_prefixes(html):
    parts = TOKEN.split(html)
    out, prev_tag = [], ""
    for i, part in enumerate(parts):
        if i % 2 == 1:  # a tag / comment / script / style
            out.append(part)
            prev_tag = part
            continue
        if prev_tag.lower().startswith('<span class="nw"'):
            out.append(part)
            continue
        out.append(PREFIX.sub(r'<span class="nw">\1\2</span>', part))
    return "".join(out)


def build(src):
    src = Path(src).resolve()
    if not src.name.endswith(".src.html"):
        die("the source file must be named <name>.src.html (got %s)" % src.name)
    dst = src.with_name(src.name[: -len(".src.html")] + ".html")
    html = src.read_text(encoding="utf-8")
    img_dir = src.parent / "images"
    html = re.sub(r"\{\{IMG:([^}]+)\}\}", lambda m: img_uri(m.group(1), img_dir), html)
    html = re.sub(r"\{\{QR:([^}]+)\}\}", lambda m: qr_svg(m.group(1)), html)
    html = wrap_prefixes(html)
    if "{{" in html:
        i = html.index("{{")
        die("unreplaced placeholder left: %r" % html[i:i + 60])
    dst.write_text(html, encoding="utf-8")
    print("built %s  (%d slides, %d KB)" % (dst, html.count('<div class="item"'), len(html.encode()) // 1024))
    return dst


if __name__ == "__main__":
    if len(sys.argv) != 2:
        die("usage: python build.py <name>.src.html")
    build(sys.argv[1])
