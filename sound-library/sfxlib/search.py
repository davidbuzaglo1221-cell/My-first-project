"""Natural-language search over the library, in Hebrew or English, plus hard filters.

  search("צליל של מעבר קולנועי עמוק")      -> deep cinematic transitions first
  search("explosion", max_dur=3, loudness="loud", min_quality=3.5)

Same algorithm as preview/app.js (keep them in step): query -> weighted English terms (Hebrew dictionary,
prefix stripping, synonyms), modifiers (deep, short, loud, soft, realistic...) and category hints;
BM25 over title/tags/description/categories; boosts from modifiers and quality.
"""
from __future__ import annotations

import json
import math
import re
from functools import lru_cache

from .common import DATA

_tok = re.compile(r"[֐-׿']+|[a-z0-9]+(?:-[a-z0-9]+)?")


@lru_cache(1)
def lexicon() -> dict:
    p = DATA / "lexicon.json"
    if not p.exists():
        from .lexicon import build
        return build()
    return json.loads(p.read_text())


@lru_cache(1)
def _index_cached(mtime: float) -> list[dict]:
    return json.loads((DATA / "index.json").read_text())


def index() -> list[dict]:
    p = DATA / "index.json"
    return _index_cached(p.stat().st_mtime)


def parse(q: str) -> dict:
    lx = lexicon()
    he, mods, syn, stop, pre = lx["he"], lx["mods"], lx["en_syn"], set(lx["stop"]), lx["prefixes"]
    toks = _tok.findall(q.lower())
    terms: dict[str, float] = {}
    out_mods: dict = {}
    cats: set[str] = set()

    def add(words: str, w: float) -> None:
        for t in words.split():
            terms[t] = max(terms.get(t, 0), w)

    i = 0
    while i < len(toks):
        t = toks[i]
        two = f"{t} {toks[i + 1]}" if i + 1 < len(toks) else None
        if two and two in he:
            add(he[two], 1.0)
            i += 2
            continue
        if t in stop:
            i += 1
            continue
        cand = [t] + ([t[1:], t[2:]] if t and t[0] in pre else [])
        hit = False
        for c in cand:
            if not c:
                continue
            if c in mods:
                out_mods.update(mods[c])
                hit = True
                break
            if c in he:
                ws = he[c].split()
                add(ws[0], 1.0)
                add(" ".join(ws[1:]), 0.7)
                hit = True
                break
        if not hit and re.match(r"[a-z0-9]", t):
            add(t, 1.0)
            if t.endswith("s") and len(t) > 3:
                add(t[:-1], 0.9)
            base = t[:-1] if t.endswith("s") and len(t) > 3 and t[:-1] in syn else t
            if base in syn:
                add(syn[base], 0.5)
        elif not hit:
            add(t, 0.6)  # unknown Hebrew word: still try it against Hebrew category names
        i += 1
    for cid, c in lx["categories"].items():
        names = {cid, c["en"].lower(), *c["en"].lower().split()}
        if names & set(terms) or c["he"] in q:
            cats.add(cid)
    return {"terms": terms, "mods": out_mods, "cats": sorted(cats)}


def _doc_tokens(r: dict) -> dict[str, float]:
    f: dict[str, float] = {}

    def put(text: str, w: float) -> None:
        for t in _tok.findall((text or "").lower().replace("_", " ")):
            f[t] = f.get(t, 0) + w
            if t.endswith("s") and len(t) > 3:
                f[t[:-1]] = f.get(t[:-1], 0) + w * 0.9
    put(r.get("title", ""), 3)
    put(" ".join(r.get("tags", [])), 2)
    put(" ".join(r.get("categories", [])), 1.5)
    put(r.get("description", ""), 1)
    put(" ".join(r.get("use_for", [])), 1)
    return f


@lru_cache(4)
def _prepared(mtime: float):
    docs = [_doc_tokens(r) for r in _index_cached(mtime)]
    df: dict[str, int] = {}
    for d in docs:
        for t in d:
            df[t] = df.get(t, 0) + 1
    avg = sum(sum(d.values()) for d in docs) / max(1, len(docs))
    return docs, df, avg


def passes(r: dict, min_dur=None, max_dur=None, loudness=None, style=None, min_quality=None, category=None,
           source=None, no_attribution=False, tone=None) -> bool:
    d = r.get("duration", 0)
    if min_dur is not None and d < min_dur:
        return False
    if max_dur is not None and d > max_dur:
        return False
    if loudness and r.get("loudness_class") != loudness:
        return False
    if style and style not in r.get("styles", []):
        return False
    if min_quality is not None and r.get("quality", 0) < min_quality:
        return False
    if category and category not in r.get("categories", []):
        return False
    if source and r.get("source") != source:
        return False
    if no_attribution and r.get("attribution_required"):
        return False
    if tone and r.get("tone") != tone:
        return False
    return True


def search(q: str = "", limit: int = 20, **filters) -> list[dict]:
    rows = index()
    mtime = (DATA / "index.json").stat().st_mtime
    docs, df, avg = _prepared(mtime)
    p = parse(q) if q.strip() else {"terms": {}, "mods": {}, "cats": []}
    N = len(rows)
    k1, b = 1.2, 0.6
    scored = []
    for r, d in zip(rows, docs):
        if not passes(r, **filters):
            continue
        s = 0.0
        matched = 0
        dl = sum(d.values())
        for t, w in p["terms"].items():
            tf = d.get(t)
            if not tf:
                continue
            matched += 1
            idf = math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5))
            s += w * idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * dl / avg))
        if p["terms"] and not matched:
            continue
        if p["terms"]:
            s *= 0.35 + 0.65 * matched / len(p["terms"])  # reward matching more of the query
        for c in p["cats"]:
            if c in r.get("categories", []):
                s += 1.5
        m = p["mods"]
        if m.get("tone") and r.get("tone") == m["tone"]:
            s += 1.2
        if m.get("low"):
            s += 3 * r.get("low_share", 0)
        if m.get("length") and r.get("length_class") in m["length"]:
            s += 1.0
        if m.get("loud") and r.get("loudness_class") == m["loud"]:
            s += 1.0
        if m.get("style") and m["style"] in r.get("styles", []):
            s += 1.0
        if m.get("quality") and r.get("quality", 0) >= m["quality"]:
            s += 0.8
        s += 0.35 * (r.get("quality", 3) - 3)
        scored.append((s, r))
    scored.sort(key=lambda x: -x[0])
    # variety: don't return five takes of the same thing in a row (same title stem)
    out, seen = [], {}
    for s, r in scored:
        stem = re.sub(r"[\d_\-\s().]+$", "", r["title"].lower())[:24]
        if seen.get(stem, 0) >= 2 and len(scored) > limit * 2:
            continue
        seen[stem] = seen.get(stem, 0) + 1
        out.append({**r, "score": round(s, 3)})
        if len(out) >= limit:
            break
    return out
