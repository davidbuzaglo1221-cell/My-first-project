#!/usr/bin/env python3
"""PDF backup: one 16:9 page per slide, made from presentation-mode screenshots.

  python export_pdf.py deck.html [--out deck.pdf]

Never use Chrome print-to-PDF for decks (it breaks the layout). Needs: pip install pymupdf
"""
import argparse
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import count_slides, die  # noqa: E402
from shot import capture  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("deck")
    ap.add_argument("--out")
    a = ap.parse_args()
    try:
        import pymupdf as fitz
    except ImportError:
        try:
            import fitz  # older pymupdf
        except ImportError:
            fitz = None
    if fitz is None:
        die("pymupdf is missing: pip install pymupdf")
    deck = Path(a.deck).resolve()
    if not deck.is_file():
        die("not found: %s" % deck)
    n = count_slides(deck.read_text(encoding="utf-8"))
    out = Path(a.out).resolve() if a.out else deck.with_suffix(".pdf")
    tmp = Path(tempfile.mkdtemp(prefix="presentor-pdf-"))
    try:
        pngs = capture(deck, list(range(1, n + 1)), tmp)
        doc = fitz.open()
        for p in pngs:
            page = doc.new_page(width=960, height=540)
            page.insert_image(page.rect, filename=str(p))
        doc.save(str(out), deflate=True)
        doc.close()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    chk = fitz.open(str(out))
    pages = chk.page_count
    chk.close()
    if pages != n:
        die("PDF has %d pages, expected %d" % (pages, n))
    print("saved %s  (%d pages)" % (out, pages))


if __name__ == "__main__":
    main()
