#!/usr/bin/env python3
"""Renumber slides after adding / deleting:  python renumber.py <name>.src.html

Every slide is  <!-- n --> <div class="item"><section class="slide"> ... <span class="no">n</span> ...
A new slide may be marked <!-- X --> (or have no comment at all); it gets the right number.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import die  # noqa: E402

ITEM = '<div class="item"'
COMMENT_AT_END = re.compile(r"<!--\s*(\d+|X|x|\?)\s*-->(\s*)$")
NO_SPAN = re.compile(r'<span class="no">[^<]*</span>')


def renumber(path):
    path = Path(path).resolve()
    text = path.read_text(encoding="utf-8")
    chunks = text.split(ITEM)
    if len(chunks) < 2:
        die("no slides found (looking for %s)" % ITEM)
    n = len(chunks) - 1
    added_no = 0
    for i in range(1, n + 1):
        before = chunks[i - 1]
        m = COMMENT_AT_END.search(before)
        if m:
            before = before[: m.start()] + "<!-- %d -->%s" % (i, m.group(2))
        else:
            ws = re.search(r"\s*$", before).group(0)
            before = before[: len(before) - len(ws)] + "\n<!-- %d -->\n" % i
        chunks[i - 1] = before
        body = chunks[i]
        if NO_SPAN.search(body.split(ITEM)[0]):
            body = NO_SPAN.sub('<span class="no">%d</span>' % i, body, count=1)
        else:
            body = re.sub(r'(<section class="slide[^"]*"[^>]*>)', r'\1<span class="no">%d</span>' % i, body, count=1)
            added_no += 1
        chunks[i] = body
    out = ITEM.join(chunks)
    # sanity
    nums = [int(x) for x in re.findall(r"<!--\s*(\d+)\s*-->\s*" + re.escape(ITEM), out)]
    if nums != list(range(1, n + 1)):
        die("renumber check failed: %s" % nums)
    if len(NO_SPAN.findall(out)) < n:
        die("some slides have no <span class=\"no\">")
    path.write_text(out, encoding="utf-8")
    print("renumbered %d slides in %s%s" % (n, path, (" (added %d number spans)" % added_no) if added_no else ""))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        die("usage: python renumber.py <name>.src.html")
    renumber(sys.argv[1])
