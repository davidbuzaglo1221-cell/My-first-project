"""Discover sounds on each free source and add them to the manifest (metadata only, no download).

Sources and the licences we accept from each:
  sfxkit     wyzowl/sfx-kit                  CC0 (all 320)
  mixkit     mixkit.co                       Mixkit Sound Effects Free License (commercial OK, no redistribution)
  kenney     kenney.nl audio packs           CC0
  freesound  freesound.org                   only CC0 and CC-BY (NC / Sampling+ rejected); previews (mp3)
  opengameart opengameart.org                only CC0 sound effects
  pixabay    pixabay.com                     Pixabay Content License (blocked by Cloudflare from here; see README)
"""
from __future__ import annotations

import html
import json
import re
import subprocess
import urllib.parse
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .common import CACHE, ROOT, fetch, fetch_cached, license_fields, load_manifest, save_manifest, slug

SFXKIT_REPO = "https://github.com/wyzowl/sfx-kit"


def _merge(recs: dict, new: list[dict]) -> int:
    added = 0
    for r in new:
        if r["id"] in recs:
            old = recs[r["id"]]
            old["tags"] = sorted(set(old.get("tags", [])) | set(r.get("tags", [])))
            for k, v in r.items():
                old.setdefault(k, v)
        else:
            recs[r["id"]] = r
            added += 1
    return added


# ---------------------------------------------------------------- SFX Kit
def sfxkit() -> list[dict]:
    repo = CACHE / "sfx-kit"
    if not (repo / "sounds.json").exists():
        repo.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--depth", "1", SFXKIT_REPO, str(repo)], check=True)
    data = json.loads((repo / "sounds.json").read_text())
    sounds = data["sounds"] if isinstance(data, dict) else data
    out = []
    for s in sounds:
        sid = s.get("id") or s.get("name")
        rel = s.get("file") or s.get("path")
        cat = s.get("category", "")
        out.append({
            "id": f"sk:{sid}", "source": "sfxkit", "source_id": sid,
            "title": s.get("name") or sid, "description": s.get("description", ""),
            "use_for": s.get("use_for", []), "avoid_for": s.get("avoid_for", []),
            "tags": sorted(set(s.get("tags", []) + [cat])), "source_category": cat,
            "author": "Wyzowl", "page_url": f"{SFXKIT_REPO}/blob/main/{rel}",
            "download_url": f"local:{repo / rel}", "preview_url": f"https://raw.githubusercontent.com/wyzowl/sfx-kit/main/{rel}",
            "sync_at": (s.get("sync") or {}).get("at"), "layers_with": s.get("layers_with", []),
            "under_voiceover_db": s.get("under_voiceover_db"), "fits_seconds": s.get("fits_seconds"),
            "tier": (s.get("level") or {}).get("tier"), "character": s.get("character"),
            "pairs_with": [p.get("category") for p in s.get("pairs_with", [])],
            **license_fields("CC0"),
        })
    return out


# ---------------------------------------------------------------- Mixkit
MK = "https://mixkit.co/free-sound-effects/"


def _mk_page(path: str) -> tuple[list[dict], set[str]]:
    try:
        h = fetch_cached(MK + path, "mk_" + path)
    except OSError:
        return [], set()
    rows, tags = [], set()
    for blk in h.split('data-audio-player-item-id-value="')[1:]:
        i = blk.split('"', 1)[0]
        if not i.isdigit():
            continue
        t = re.search(r'item-grid-card__title">\s*(.*?)\s*</h2>', blk, re.S)
        d = re.search(r'data-test-id="duration">\s*([\d:]+)', blk)
        tg = re.findall(r'meta-links__link"[^>]*href="/free-sound-effects/([a-z0-9-]+)/">([^<]+)</a>', blk)
        tags |= {a for a, _ in tg}
        title = html.unescape(t.group(1)).strip() if t else f"Mixkit {i}"
        rows.append({
            "id": f"mk:{i}", "source": "mixkit", "source_id": i, "title": title,
            "tags": sorted({b.strip().lower() for _, b in tg}), "author": "Mixkit",
            "page_url": f"https://mixkit.co/free-sound-effects/{tg[0][0] if tg else 'discover'}/",
            "download_url": f"https://assets.mixkit.co/active_storage/sfx/{i}/{i}.wav",
            "preview_url": f"https://assets.mixkit.co/active_storage/sfx/{i}/{i}-preview.mp3",
            "listed_duration": d.group(1) if d else None, **license_fields("Mixkit-SFX"),
        })
    return rows, tags


def mixkit(max_pages: int = 1500) -> list[dict]:
    home = fetch_cached(MK, "mk_home")
    queue = sorted(set(re.findall(r'/free-sound-effects/([a-z0-9-]+)/"', home)) - {"discover", "page"})
    seen, out = set(), {}
    while queue and len(seen) < max_pages:
        batch = [q for q in queue if q not in seen][:24]
        queue = [q for q in queue if q not in seen and q not in batch]
        if not batch:
            break
        seen |= set(batch)
        with ThreadPoolExecutor(8) as ex:
            for rows, tags in ex.map(lambda p: _mk_page(p + "/"), batch):
                for r in rows:
                    if r["id"] in out:
                        out[r["id"]]["tags"] = sorted(set(out[r["id"]]["tags"]) | set(r["tags"]))
                    else:
                        out[r["id"]] = r
                for t in tags:  # tags discovered on cards become new pages (discover/<tag>)
                    if t not in seen:
                        queue.append(t)
    return list(out.values())


# ---------------------------------------------------------------- Kenney
KENNEY_PACKS = ["casino-audio", "digital-audio", "impact-sounds", "interface-sounds", "music-jingles", "rpg-audio",
                "sci-fi-sounds", "ui-audio", "voiceover-pack", "voiceover-pack-fighter"]


def kenney() -> list[dict]:
    out = []
    try:
        listing = fetch("https://kenney.nl/assets/category:Audio").decode()
        packs = sorted(set(re.findall(r"kenney\.nl/assets/([a-z0-9-]+)['\"]", listing)) | set(KENNEY_PACKS))
        packs = [p for p in packs if not p.startswith("category")]
    except OSError:
        packs = KENNEY_PACKS
    for pack in packs:
        d = CACHE / "kenney" / pack
        if not d.exists():
            try:
                h = fetch(f"https://kenney.nl/assets/{pack}").decode()
            except OSError:
                continue
            z = re.search(r"https://kenney\.nl/media/[^\"']+\.zip", h)
            zurl = z.group(0) if z else None
            if not zurl:  # current site: "Continue without donating" asks for a fresh signed link
                did = re.search(r"data-download-id='([0-9a-f]+)'", h)
                if not did:
                    continue
                try:
                    zurl = json.loads(fetch(f"https://kenney.nl/download-link/{did.group(1)}",
                                            headers={"Referer": f"https://kenney.nl/assets/{pack}"}))["url"]
                except (OSError, KeyError, ValueError):
                    continue
            zp = d.with_suffix(".zip")
            zp.parent.mkdir(parents=True, exist_ok=True)
            zp.write_bytes(fetch(zurl, timeout=600))
            zipfile.ZipFile(zp).extractall(d)
        for f in sorted(d.rglob("*")):
            if f.suffix.lower() not in (".ogg", ".wav", ".mp3"):
                continue
            rel = f.relative_to(d).as_posix()
            name = re.sub(r"[_-]?\d+$", "", f.stem).replace("_", " ").strip() or f.stem
            out.append({
                "id": f"kn:{pack}/{rel}", "source": "kenney", "source_id": f"{pack}/{rel}",
                "title": f"{name} ({f.stem})", "tags": sorted({pack.replace("-", " "), *name.lower().split()}),
                "source_category": pack, "author": "Kenney", "page_url": f"https://kenney.nl/assets/{pack}",
                "download_url": f"local:{f}", "preview_url": None, **license_fields("CC0"),
            })
    return out


# ---------------------------------------------------------------- Freesound
FS_LIC = {"Creative Commons 0": "CC0", "Attribution": "CC-BY-4.0", "Attribution 3.0": "CC-BY-3.0"}
FS_FILTER = 'license:("Creative Commons 0" OR "Attribution") duration:[0.2 TO 30]'


def _fs_page(query: str, page: int, sort: str) -> list[dict]:
    q = {"q": query, "f": FS_FILTER, "s": sort, "page": page}
    url = "https://freesound.org/search/?" + urllib.parse.urlencode(q)
    try:
        h = fetch_cached(url, f"fs_{query}_{page}_{sort[:4]}")
    except OSError:
        return []
    rows = []
    for blk in h.split('class="bw-search__result"')[1:]:
        g = lambda k: (re.search(rf'data-{k}="([^"]*)"', blk) or [None, ""])[1]  # noqa: E731
        lic = re.search(r'title="License: ([^"]+)"', blk)
        lic = FS_LIC.get(lic.group(1).strip()) if lic else None
        sid, user, mp3 = g("sound-id"), g("username"), g("mp3")
        if not (lic and sid and mp3):
            continue
        tags = re.findall(r'href="/browse/tags/([^/"]+)/', blk)
        title = html.unescape(g("title"))
        page_url = f"https://freesound.org/people/{user}/sounds/{sid}/"
        rows.append({
            "id": f"fs:{sid}", "source": "freesound", "source_id": sid, "title": title,
            "tags": sorted({urllib.parse.unquote(t).lower() for t in tags}), "author": user,
            "page_url": page_url, "download_url": mp3.replace("-lq.mp3", "-hq.mp3"), "preview_url": mp3,
            "rating": float(g("score") or 0), "downloads": int(g("num-downloads") or 0),
            "listed_duration": float(g("duration") or 0), "query": query,
            **license_fields(lic, user, title, page_url),
        })
    return rows


def freesound(queries: list[str], pages: int = 2, min_rating: float = 3.0, min_downloads: int = 60) -> list[dict]:
    jobs = [(q, p, s) for q in queries for p in range(1, pages + 1)
            for s in ("Rating (highest first)", "Downloads (most first)")]
    out = {}
    with ThreadPoolExecutor(6) as ex:
        for rows in ex.map(lambda j: _fs_page(*j), jobs):
            for r in rows:
                if r["rating"] < min_rating and r["downloads"] < min_downloads:
                    continue  # quality gate
                if r["id"] in out:
                    out[r["id"]]["tags"] = sorted(set(out[r["id"]]["tags"]) | set(r["tags"]))
                else:
                    out[r["id"]] = r
    return list(out.values())


# ---------------------------------------------------------------- OpenGameArt (CC0 sound effects)
OGA = "https://opengameart.org"


def oga_meta(h: str) -> tuple[str, str, list[str], str]:
    t = re.search(r'og:title" content="([^"]+)"', h) or re.search(r"<title>([^|<]+)", h)
    title = html.unescape(t.group(1)).strip() if t else "OpenGameArt sound"
    a = re.search(r'field-name-author-submitter.*?<a href="/users/[^"]+">([^<]+)</a>', h, re.S)
    author = html.unescape(a.group(1)).strip() if a else "unknown"
    tags = [html.unescape(x).lower() for x in re.findall(r'field_art_tags_tid=[^"]*"[^>]*>([^<]+)</a>', h)]
    d = re.search(r'name="description" content="([^"]*)"', h)
    return title, author, tags, html.unescape(d.group(1))[:300] if d else ""


def opengameart(pages: int = 12) -> list[dict]:
    """Collections of CC0 sound effects. Each entry can hold zips with many files."""
    entries = []
    for p in range(pages):
        url = (f"{OGA}/art-search-advanced?field_art_type_tid%5B%5D=13&field_art_licenses_tid%5B%5D=4"
               f"&sort_by=count&sort_order=DESC&items_per_page=48&page={p}")
        try:
            h = fetch_cached(url, f"oga_list_{p}")
        except OSError:
            break
        found = re.findall(r'<a href="(/content/[a-z0-9-]+)"', h)
        if not found:
            break
        entries += [e for e in dict.fromkeys(found) if e not in entries]
    out = []

    def one(path):
        try:
            h = fetch_cached(OGA + path, "oga_" + path)
        except OSError:
            return []
        lic = re.findall(r'field-name-field-art-licenses.*?</div>\s*</div>\s*</div>', h, re.S)
        lic_txt = " ".join(lic)
        if "CC0" not in lic_txt or any(x in lic_txt for x in ("GPL", "BY-SA", "OGA-BY")) and "CC0" not in lic_txt:
            return []
        title, author, tags, desc = oga_meta(h)
        files = re.findall(r'href="(https://opengameart\.org/sites/default/files/[^"]+\.(?:zip|ogg|wav|mp3|flac))"', h)
        rows = []
        for f in dict.fromkeys(files):
            rows.append({"entry": path, "title": title, "author": author, "tags": tags, "file": f, "desc": desc})
        return rows

    with ThreadPoolExecutor(6) as ex:
        for rows in ex.map(one, entries):
            for r in rows:
                fname = urllib.parse.unquote(r["file"].rsplit("/", 1)[1])
                out.append({
                    "id": f"oga:{r['entry'].rsplit('/', 1)[1]}/{fname}", "source": "opengameart",
                    "source_id": f"{r['entry']}/{fname}", "title": f"{r['title']} - {Path(fname).stem}",
                    "tags": sorted(set(urllib.parse.unquote_plus(t) for t in r["tags"])), "author": r["author"],
                    "page_url": OGA + r["entry"], "download_url": r["file"], "preview_url": None, "description": r["desc"],
                    "archive": fname.lower().endswith(".zip"), **license_fields("CC0"),
                })
    return out


def run(sources: list[str], fs_queries: list[str] | None = None, fs_pages: int = 2) -> dict:
    recs = load_manifest()
    report = {}
    for s in sources:
        if s == "sfxkit":
            new = sfxkit()
        elif s == "mixkit":
            new = mixkit()
        elif s == "kenney":
            new = kenney()
        elif s == "freesound":
            from .taxonomy import freesound_queries
            new = freesound(fs_queries or freesound_queries(), pages=fs_pages)
        elif s == "opengameart":
            new = opengameart()
        else:
            raise SystemExit(f"unknown source {s}")
        report[s] = {"found": len(new), "added": _merge(recs, new)}
        save_manifest(recs)
        print(s, report[s], flush=True)
    return report


if __name__ == "__main__":
    import sys
    run(sys.argv[1:] or ["sfxkit", "mixkit", "kenney"])
    print(ROOT)
