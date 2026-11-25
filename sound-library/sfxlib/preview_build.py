"""Build the preview browser's data: compact records + audio sprites of short previews.

Only sounds whose licence allows redistribution (CC0, CC-BY) are put into sprites. Mixkit sounds are listed with a
link to their source page (their licence forbids redistributing the files).

Output: preview/dist/{data.json, lexicon.json, a/<n>.mp3}
"""
from __future__ import annotations

import json
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

from .common import DATA, ROOT
from .search import index

DIST = ROOT / "preview" / "dist"
SR = 16000
MAX_S = 3.0        # preview length
GAP_S = 0.15       # silence between previews in a sprite
PER_SPRITE = 200


def _clip(path: Path, onset: float) -> np.ndarray:
    start = max(0.0, onset - 0.02)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{MAX_S:.2f}", "-i", str(path),
                          "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32).copy()
    if len(x) == 0:
        return x
    pk = np.abs(x).max()
    if pk > 0:
        x *= min(1.0, 0.89 / pk) if pk > 0.89 else 1.0
    n = min(len(x), int(0.06 * SR))
    if len(x) >= int(MAX_S * SR * 0.98):  # truncated: fade the end
        x[-n:] *= np.linspace(1, 0, n)
    return x


def build(per_sprite: int = PER_SPRITE, workers: int = 8) -> dict:
    rows = index()
    if DIST.exists():
        shutil.rmtree(DIST)
    (DIST / "a").mkdir(parents=True)
    recs = {}
    from .common import load_manifest
    man = load_manifest()
    host = [r for r in rows if r.get("redistribute_ok")]
    groups = [host[i:i + per_sprite] for i in range(0, len(host), per_sprite)]
    place: dict[str, tuple[int, float, float]] = {}

    def make(gi_group):
        gi, group = gi_group
        parts, t, local = [], 0.0, {}
        gap = np.zeros(int(GAP_S * SR), np.float32)
        for r in group:
            m = man[r["id"]]
            x = _clip(ROOT / r["file"], float(m.get("onset") or 0))
            if len(x) == 0:
                continue
            local[r["id"]] = (gi, round(t, 3), round(len(x) / SR, 3))
            parts += [x, gap]
            t += (len(x) + len(gap)) / SR
        pcm = np.concatenate(parts) if parts else np.zeros(1, np.float32)
        out = DIST / "a" / f"{gi}.mp3"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                        "-c:a", "libmp3lame", "-b:a", "24k", str(out)], input=pcm.tobytes(), check=True)
        return local

    with ThreadPoolExecutor(workers) as ex:
        for local in ex.map(make, enumerate(groups)):
            place.update(local)

    out = []
    for r in rows:
        o = {"i": r["id"], "t": r["title"], "c": r["categories"], "s": r.get("styles", []), "d": r["duration"],
             "L": r["loudness_class"][0], "T": r["tone"][0], "q": r["quality"], "l": r["license"], "a": r.get("author", ""),
             "src": r["source"], "u": r.get("page_url", ""), "w": r.get("wf", ""), "g": r.get("tags", [])[:10]}
        if r.get("credit"):
            o["cr"] = r["credit"]
        if r.get("description"):
            o["ds"] = r["description"][:160]
        if r.get("use_for"):
            o["uf"] = r["use_for"][:4]
        if r.get("low_share") is not None:
            o["lo"] = round(r["low_share"], 2)
        if r["id"] in place:
            o["p"] = place[r["id"]]
        out.append(o)
    with open(DIST / "data.json", "w") as f:
        f.write("[\n" + ",\n".join(json.dumps(o, ensure_ascii=False, separators=(",", ":")) for o in out) + "\n]\n")
    shutil.copy(DATA / "lexicon.json", DIST / "lexicon.json")
    size = sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file())
    return {"records": len(out), "previewable": len(place), "sprites": len(groups), "mb": round(size / 1e6, 1)}


if __name__ == "__main__":
    print(build())
