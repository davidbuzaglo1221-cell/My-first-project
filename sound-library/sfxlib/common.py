"""Shared paths, HTTP and manifest helpers for the sound library."""
from __future__ import annotations

import hashlib
import json
import os
import re
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # sound-library/
DATA = ROOT / "data"
AUDIO = ROOT / "audio"                                  # gitignored: the files themselves
CACHE = ROOT / "cache"                                  # gitignored: crawl pages, zips, waveforms
MANIFEST = DATA / "manifest.jsonl"                      # one record per sound, committed
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"}

# Licences we accept. Anything else is rejected at harvest time.
LICENSES = {
    "CC0": {"url": "https://creativecommons.org/publicdomain/zero/1.0/", "commercial": True, "attribution": False,
            "redistribute": True},
    "CC-BY-4.0": {"url": "https://creativecommons.org/licenses/by/4.0/", "commercial": True, "attribution": True,
                  "redistribute": True},
    "CC-BY-3.0": {"url": "https://creativecommons.org/licenses/by/3.0/", "commercial": True, "attribution": True,
                  "redistribute": True},
    "Mixkit-SFX": {"url": "https://mixkit.co/license/#sfxFree", "commercial": True, "attribution": False,
                   "redistribute": False},
    "Pixabay": {"url": "https://pixabay.com/service/license-summary/", "commercial": True, "attribution": False,
                "redistribute": False},
}


def fetch(url: str, timeout: int = 60, tries: int = 3, headers: dict | None = None) -> bytes:
    last = None
    for n in range(tries):
        try:
            req = urllib.request.Request(url, headers={**UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
            if getattr(e, "code", None) in (403, 404, 410):
                break
            time.sleep(1.5 * (n + 1))
    raise OSError(f"{url}: {last!r}")


def fetch_cached(url: str, name: str, max_age_h: float = 72) -> str:
    p = CACHE / "pages" / (re.sub(r"[^\w.-]+", "_", name)[:180] + ".html")
    if p.exists() and time.time() - p.stat().st_mtime < max_age_h * 3600:
        return p.read_text(errors="replace")
    txt = fetch(url).decode("utf-8", "replace")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(txt)
    return txt


def slug(s: str, n: int = 48) -> str:
    s = re.sub(r"[^\w]+", "-", s.lower(), flags=re.A).strip("-")
    return s[:n] or "sound"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


_lock = threading.Lock()


def load_manifest() -> dict[str, dict]:
    out: dict[str, dict] = {}
    if MANIFEST.exists():
        for line in MANIFEST.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                out[r["id"]] = r
    return out


def save_manifest(recs: dict[str, dict]) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    tmp = MANIFEST.with_suffix(".tmp")
    with _lock, open(tmp, "w") as f:
        for k in sorted(recs):
            f.write(json.dumps(recs[k], ensure_ascii=False, sort_keys=True) + "\n")
    os.replace(tmp, MANIFEST)


def license_fields(lic: str, author: str | None = None, title: str = "", page: str = "") -> dict:
    info = LICENSES[lic]
    credit = None
    if info["attribution"]:
        credit = f'"{title}" by {author or "unknown"} ({page}), licensed {lic}'
    return {"license": lic, "license_url": info["url"], "commercial_ok": info["commercial"],
            "attribution_required": info["attribution"], "redistribute_ok": info["redistribute"], "credit": credit}
