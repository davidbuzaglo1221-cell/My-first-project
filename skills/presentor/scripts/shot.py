#!/usr/bin/env python3
"""Screenshot slides in presentation mode at 1600x900, plus grid.png and a fit report.

  python shot.py deck.html all
  python shot.py deck.html 1,3,5-7 [--out DIR] [--no-grid]

Default output folder: shots/<deck name>/ next to the deck.
The report lists, per slide: zoom, how much of the height is used, and problems
(OVERFLOW = content does not fit, EMPTY = very little content).
"""
import argparse
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import count_slides, die, file_url, parse_selection, run_chrome  # noqa: E402

W, H = 1600, 900


def shoot_one(deck, i, out_png):
    out_png = Path(out_png).resolve()
    if out_png.exists():
        out_png.unlink()
    r = run_chrome(["--window-size=%d,%d" % (W, H), "--force-device-scale-factor=1",
                    "--virtual-time-budget=6000", "--screenshot=" + str(out_png),
                    file_url(deck, "present=%d" % i)])
    if not out_png.is_file():
        die("screenshot of slide %d failed:\n%s" % (i, r.stderr[-2000:]))
    return out_png


def capture(deck, slides, out_dir):
    deck = Path(deck).resolve()
    out_dir = Path(out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    jobs = [(i, out_dir / ("slide-%02d.png" % i)) for i in slides]
    with ThreadPoolExecutor(max_workers=4) as ex:
        list(ex.map(lambda j: shoot_one(deck, j[0], j[1]), jobs))
    return [p for _, p in jobs]


def fit_report(deck):
    r = run_chrome(["--window-size=%d,%d" % (W, H), "--virtual-time-budget=6000", "--dump-dom", file_url(deck)])
    rows = []
    for m in re.finditer(r"<section\b([^>]*)>", r.stdout):
        a = m.group(1)
        get = lambda k: (re.search(r'%s="([^"]*)"' % k, a) or [None, ""])[1]
        rows.append({"zoom": get("data-zoom"), "fill": get("data-fill"),
                     "overflow": get("data-overflow") == "1", "nofit": "data-nofit" in a})
    return rows


def print_report(rows):
    probs = 0
    print("slide  zoom  fill  notes")
    for i, row in enumerate(rows, 1):
        notes = []
        if row["nofit"]:
            notes.append("nofit")
        elif row["overflow"]:
            notes.append("OVERFLOW - shorten the text or split the slide")
        elif row["fill"] and float(row["fill"]) < 0.45:
            notes.append("EMPTY - very little content")
        probs += any(n.startswith(("OVERFLOW", "EMPTY")) for n in notes)
        print("%5d  %4s  %4s  %s" % (i, row["zoom"] or "-", row["fill"] or "-", ", ".join(notes)))
    print("problems: %d" % probs)
    return probs


def make_grid(pngs, out_png, cols=4, tw=400):
    try:
        import cv2
        import numpy as np
    except ImportError:
        print("grid skipped (pip install opencv-python)")
        return None
    th, gap = int(tw * 9 / 16), 16
    rows = (len(pngs) + cols - 1) // cols
    grid = np.full((rows * (th + gap) + gap, cols * (tw + gap) + gap, 3), 235, np.uint8)
    for k, p in enumerate(pngs):
        img = cv2.imdecode(np.fromfile(str(p), dtype=np.uint8), cv2.IMREAD_COLOR)
        img = cv2.resize(img, (tw, th), interpolation=cv2.INTER_AREA)
        r, c = divmod(k, cols)
        y, x = gap + r * (th + gap), gap + c * (tw + gap)
        grid[y:y + th, x:x + tw] = img
        num = re.search(r"(\d+)", Path(p).stem).group(1).lstrip("0")
        cv2.rectangle(grid, (x, y), (x + 44, y + 30), (40, 40, 40), -1)
        cv2.putText(grid, num, (x + 6, y + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", grid)
    buf.tofile(str(out_png))
    return out_png


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("deck")
    ap.add_argument("slides", nargs="?", default="all")
    ap.add_argument("--out")
    ap.add_argument("--no-grid", action="store_true")
    a = ap.parse_args()
    deck = Path(a.deck).resolve()
    if not deck.is_file():
        die("not found: %s" % deck)
    n = count_slides(deck.read_text(encoding="utf-8"))
    slides = parse_selection(a.slides, n)
    name = deck.name[:-5] if deck.name.endswith(".html") else deck.stem
    out = Path(a.out).resolve() if a.out else deck.parent / "shots" / name
    pngs = capture(deck, slides, out)
    for p in pngs:
        print(p)
    if not a.no_grid:
        g = make_grid(pngs, out / "grid.png")
        if g:
            print(g)
    print_report(fit_report(deck))


if __name__ == "__main__":
    main()
