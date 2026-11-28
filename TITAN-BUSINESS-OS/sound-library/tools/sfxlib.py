#!/usr/bin/env python3
"""Studio sound library: one permanent, indexed, de-duplicated SFX collection with on-demand fetching.

Layout (all paths relative to the library root, TITAN-BUSINESS-OS/sound-library/):
  sfx/<category>/<id>.ogg   sounds whose licence allows redistribution (CC0, CC-BY) - committed to git
  .cache/<category>/<id>.*  sounds that may be used in videos but not redistributed (Mixkit) - gitignored,
                            re-downloaded automatically from `download_url` when missing (see `ensure`)
  index.json                one entry per sound: name, category, tags, description, mood, source, licence ...
  usage.json                which sound went into which video, so the next video picks different takes
  embeddings.npz            optional CLAP vectors for semantic search (built by embed.py)

Commands (python3 sfxlib.py <cmd> -h for options):
  stats                         counts by category / source / licence
  search "deep cinematic hit"   ranked matches by text, --category, --mood, --max-dur, --semantic
  fetch  "camera shutter" --category camera --n 10     Freesound API -> download -> index (needs a key)
  import-openverse results.json --category camera      import Openverse search results (no key)
  import-manifest <manifest.json>                      import the motion-graphics bundled CC0 + Mixkit list
  import-dir <folder> --license "CC0 1.0" --source me  import your own files
  pick --cue scene_cut --mood dark --video reel-07     choose a varied sound for an edit cue (anti-repeat)
  ensure                        re-download every cached (non-committed) sound that is missing
  verify                        check every indexed file exists, hashes match, no duplicates
Only stdlib + ffmpeg/ffprobe are required. numpy is used only by --semantic.
"""
import argparse, datetime, hashlib, json, os, random, re, shutil, subprocess, sys, tempfile, urllib.parse, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from taxonomy import CATEGORIES, CUE_TYPES, MOODS, guess_category  # noqa: E402

ROOT = Path(os.environ.get("SFX_LIBRARY", Path(__file__).resolve().parent.parent))
INDEX = ROOT / "index.json"
USAGE = ROOT / "usage.json"
UA = "studio-sfx-library/1.0"

REDISTRIBUTABLE = ("cc0", "creative commons 0", "public domain", "attribution 4.0", "attribution 3.0", "cc-by", "cc by")
BLOCKED = ("noncommercial", "non-commercial", "-nc", " nc ", "sampling+")
LONG_CATS = {"ambience-nature", "ambience-urban", "dark"}
MID_CATS = {"riser", "drop", "reverse", "explosion", "music-stinger", "barber", "human"}


# ---------------------------------------------------------------- index helpers
def load_index():
    if INDEX.exists():
        return json.loads(INDEX.read_text(encoding="utf-8"))
    return {"version": 1, "sounds": []}


def save_index(idx):
    idx["sounds"].sort(key=lambda s: (s["category"], s["id"]))
    idx["updated"] = datetime.date.today().isoformat()
    idx["count"] = len(idx["sounds"])
    tmp = INDEX.with_suffix(".tmp")
    tmp.write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(INDEX)


def license_ok(lic):
    l = (lic or "").lower()
    if any(b in l for b in BLOCKED):
        return False
    return True


def redistributable(lic):
    l = (lic or "").lower()
    return license_ok(lic) and any(r in l for r in REDISTRIBUTABLE)


def norm_license(lic):
    l = (lic or "").lower()
    if "zero" in l or "cc0" in l or l.strip() in ("creative commons 0",):
        return "CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/"
    if "by/4.0" in l or "attribution 4.0" in l or l == "by-4.0":
        return "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"
    if "by/3.0" in l or "attribution 3.0" in l or l == "attribution" or l == "by-3.0":
        return "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0/"
    if "mixkit" in l:
        return "Mixkit Sound Effects Free License", "https://mixkit.co/license/#sfxFree"
    return lic, None


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 16), b""):
            h.update(b)
    return h.hexdigest()


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe_duration(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    try:
        return round(float(r.stdout.strip()), 3)
    except ValueError:
        return None


def fingerprint(path):
    """Coarse loudness envelope (24 bins, 4 levels) of the first 6 s: catches the same sound re-encoded."""
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-t", "6", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
                       capture_output=True)
    data = r.stdout
    n = len(data) // 2
    if n < 800:
        return None
    import array
    a = array.array("h"); a.frombytes(data[: n * 2])
    bins = 24; step = max(1, n // bins); env = []
    for i in range(bins):
        seg = a[i * step:(i + 1) * step]
        env.append(max((abs(x) for x in seg), default=0))
    peak = max(env) or 1
    return "".join(str(min(3, int(4 * e / peak))) for e in env)


def find_duplicate(idx, src_key=None, raw_sha=None, fp=None, dur=None):
    for s in idx["sounds"]:
        if src_key and s.get("source_key") == src_key:
            return s, "same source id"
        if raw_sha and s.get("raw_sha256") == raw_sha:
            return s, "identical download"
        if fp and dur and s.get("fingerprint") == fp and s.get("duration") and abs(s["duration"] - dur) <= 0.03 * max(dur, 0.1):
            return s, "same audio fingerprint"
    return None, None


# ---------------------------------------------------------------- download + process
def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)
    return dest


def process(src, dest, category):
    """Trim leading silence, cap length, normalise, encode OGG Vorbis 48 kHz."""
    cap = 30 if category in LONG_CATS else 8 if category in MID_CATS else 6
    chain = ["silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.01"]
    if category in LONG_CATS:
        chain += [f"atrim=0:{cap}", f"afade=t=out:st={cap - 1.5}:d=1.5", "loudnorm=I=-30:TP=-6:LRA=11"]
    else:
        chain += [f"atrim=0:{cap}"]
    tmp = dest.with_suffix(".tmp.wav")
    r = run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", ",".join(chain), "-ar", "48000", str(tmp)])
    if r.returncode != 0 or not tmp.exists():
        raise RuntimeError(f"ffmpeg failed: {r.stderr[-300:]}")
    gain = 0.0
    if category not in LONG_CATS:  # peak-normalise one-shots to -3 dBFS
        m = re.search(r"max_volume: (-?[\d.]+) dB", run(["ffmpeg", "-v", "info", "-i", str(tmp), "-af", "volumedetect", "-f", "null", "-"]).stderr)
        if m:
            gain = -3.0 - float(m.group(1))
    r = run(["ffmpeg", "-y", "-v", "error", "-i", str(tmp), "-af", f"volume={gain:.2f}dB", "-c:a", "libvorbis", "-q:a", "5", str(dest)])
    tmp.unlink(missing_ok=True)
    if r.returncode != 0:
        raise RuntimeError(f"encode failed: {r.stderr[-300:]}")
    return dest


def add_sound(idx, *, url=None, local=None, name, category, source, source_id, source_url, license, author="",
              tags=(), description="", mood=(), redistribute=None, quiet=False):
    """Download (or copy) one sound, process it, de-duplicate and add it to the index. Returns the entry or None."""
    if category not in CATEGORIES:
        category = guess_category(f"{name} {' '.join(tags)}")
    if not license_ok(license):
        if not quiet: print(f"  skip {name!r}: licence {license!r} does not allow commercial use")
        return None
    src_key = f"{source}:{source_id}"
    dup, why = find_duplicate(idx, src_key=src_key)
    if dup:
        if not quiet: print(f"  cached  {dup['id']} ({why})")
        return dup
    lic, lic_url = norm_license(license)
    commit = redistributable(lic) if redistribute is None else redistribute
    sid = re.sub(r"[^a-z0-9-]+", "-", f"{source[:2]}-{source_id}".lower()).strip("-")
    base = ROOT / ("sfx" if commit else ".cache") / category
    base.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / ("raw" + (Path(urllib.parse.urlparse(url).path).suffix if url else Path(local).suffix or ".wav"))
        try:
            download(url, raw) if url else shutil.copy(local, raw)
        except Exception as e:  # noqa: BLE001
            if not quiet: print(f"  FAIL download {name!r}: {e}")
            return None
        raw_sha = sha256(raw)
        dup, why = find_duplicate(idx, raw_sha=raw_sha)
        if dup:
            if not quiet: print(f"  dup     {name!r} = {dup['id']} ({why})")
            return dup
        dest = base / f"{sid}.ogg"
        try:
            process(raw, dest, category)
        except RuntimeError as e:
            if not quiet: print(f"  FAIL process {name!r}: {e}")
            return None
    dur = probe_duration(dest)
    fp = fingerprint(dest)
    dup, why = find_duplicate(idx, fp=fp, dur=dur)
    if dup:
        dest.unlink(missing_ok=True)
        if not quiet: print(f"  dup     {name!r} = {dup['id']} ({why})")
        return dup
    text = f"{name} {' '.join(tags)} {description}".lower()
    entry = {
        "id": sid, "name": name.strip()[:120], "category": category, "category_he": CATEGORIES[category]["he"],
        "tags": sorted({t.lower() for t in tags if t})[:30], "description": (description or "").strip()[:400],
        "mood": sorted(set(mood) | {m for m in MOODS if re.search(rf"\b{m}\b", text)}),
        "duration": dur, "file": str(dest.relative_to(ROOT)), "committed": commit,
        "source": source, "source_id": str(source_id), "source_key": src_key, "source_url": source_url,
        "download_url": url, "author": author, "license": lic, "license_url": lic_url,
        "attribution": f"\"{name.strip()}\" by {author} ({source}, {lic})" if author else f"\"{name.strip()}\" ({source}, {lic})",
        "sha256": sha256(dest), "raw_sha256": raw_sha, "fingerprint": fp, "added": datetime.date.today().isoformat(),
    }
    idx["sounds"].append(entry)
    if not quiet: print(f"  added   {sid:<22} {category:<16} {dur:>6}s  {lic}  {name[:50]}")
    return entry


# ---------------------------------------------------------------- Freesound
def freesound_key():
    k = os.environ.get("FREESOUND_API_KEY")
    if k:
        return k
    cfg = Path.home() / ".sfx-finder" / "config.json"
    if cfg.exists():
        try:
            return json.loads(cfg.read_text()).get("freesound_api_key")
        except json.JSONDecodeError:
            pass
    return "injected-by-proxy"  # the session's network proxy substitutes the saved key, if one is saved


def freesound_search(query, n=15, max_dur=30, page=1):
    params = {"query": query, "page_size": min(150, n), "page": page, "sort": "score",
              "fields": "id,name,tags,description,license,username,duration,previews,url",
              "filter": f'license:("Creative Commons 0" OR "Attribution") duration:[0.05 TO {max_dur}]'}
    url = "https://freesound.org/apiv2/search/text/?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Authorization": f"Token {freesound_key()}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r).get("results", [])
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            print("FREESOUND_KEY_MISSING: Freesound needs a free API key (https://freesound.org/apiv2/apply/). "
                  "Save it as a network secret for freesound.org (Authorization: Token <key>), or set FREESOUND_API_KEY.", file=sys.stderr)
            sys.exit(3)
        raise


def cmd_fetch(a):
    idx = load_index()
    cats = [a.category] if a.category else [guess_category(a.query)]
    results = freesound_search(a.query, n=a.n * 2, max_dur=a.max_dur)
    added = 0
    for r in results:
        if added >= a.n:
            break
        prev = (r.get("previews") or {}).get("preview-hq-mp3")
        if not prev:
            continue
        before = len(idx["sounds"])
        e = add_sound(idx, url=prev, name=r["name"], category=cats[0], source="freesound", source_id=r["id"],
                      source_url=r.get("url"), license=r.get("license"), author=r.get("username", ""),
                      tags=r.get("tags", []), description=r.get("description", ""))
        if e and len(idx["sounds"]) > before:
            added += 1
    save_index(idx)
    print(f"fetch: {added} new sounds for {a.query!r} -> {cats[0]} (library now {len(idx['sounds'])})")


def cmd_import_openverse(a):
    idx = load_index()
    data = json.loads(Path(a.file).read_text())
    rows = data.get("results", data) if isinstance(data, dict) else data
    n = 0
    for r in rows:
        lic = r.get("license")
        lic = lic.get("name") if isinstance(lic, dict) else lic
        page = r.get("page_url") or r.get("foreign_landing_url") or ""
        m = re.search(r"/sounds/(\d+)", page)
        sid, src = (m.group(1), "freesound") if m else (r.get("id"), "openverse")
        creator = r.get("creator"); creator = creator.get("name") if isinstance(creator, dict) else creator
        before = len(idx["sounds"])
        add_sound(idx, url=r.get("preview_url") or r.get("url"), name=r.get("title", "untitled"),
                  category=r.get("category_slug") or a.category, source=src, source_id=sid, source_url=page,
                  license=lic, author=creator or "", tags=r.get("tags", []), description=r.get("description", ""))
        n += len(idx["sounds"]) > before
    save_index(idx)
    print(f"import-openverse: {n} new (library now {len(idx['sounds'])})")


def cmd_import_tsv(a):
    """Rows: preview_url, freesound_id, creator, licence, duration, title, tags (comma) - category guessed from title+tags."""
    idx = load_index(); n = 0
    for line in Path(a.file).read_text().splitlines():
        f = line.split("\t")
        if len(f) < 7 or not f[0].startswith("http"):
            continue
        url, sid, creator, lic, dur, title, tags = f[:7]
        tags = [t for t in tags.split(",") if t]
        cat = a.category or guess_category(f"{title} {' '.join(tags)}")
        before = len(idx["sounds"])
        add_sound(idx, url=url, name=title, category=cat, source="freesound", source_id=sid,
                  source_url=f"https://freesound.org/s/{sid}/", license="CC0 1.0" if lic.lower() == "cc0" else lic,
                  author=creator, tags=tags)
        n += len(idx["sounds"]) > before
    save_index(idx); print(f"import-tsv: {n} new (library now {len(idx['sounds'])})")


def cmd_import_manifest(a):
    idx = load_index()
    man = json.loads(Path(a.file).read_text())
    base = Path(a.file).parent
    catmap = {"click": "ui", "ui-blip": "ui", "kit": None, "ambience": "ambience-urban"}
    n = 0
    for e in man.get("bundled", []):
        cat = e["category"]; cat = catmap.get(cat, cat) if cat in catmap else cat
        cat = cat if cat in CATEGORIES else guess_category(e["file"])
        m = re.search(r"/sounds/(\d+)", e.get("source_url", ""))
        sid = m.group(1) if m else Path(e["file"]).stem
        src = "freesound" if m else ("kenney" if "kenney" in e["file"] else "bundled")
        name = Path(e["file"]).stem.replace("fs-", "").replace("-", " ")
        author = e.get("attribution", "").split(" via ")[0]
        before = len(idx["sounds"])
        add_sound(idx, local=str(base / e["file"]), name=name, category=cat, source=src, source_id=sid,
                  source_url=e.get("source_url"), license=e.get("license"), author=author,
                  tags=name.split(), description=e.get("note", ""))
        n += len(idx["sounds"]) > before
    for e in man.get("runtime", []) if a.runtime else []:
        cat = catmap.get(e["category"], e["category"]); cat = cat if cat in CATEGORIES else "foley"
        before = len(idx["sounds"])
        add_sound(idx, url=e["runtime_url"], name=f"Mixkit {e['category']} {e.get('mixkit_id')}", category=cat,
                  source="mixkit", source_id=e.get("mixkit_id"), source_url=e.get("source_page"),
                  license=e.get("license"), author="Mixkit", tags=[e["category"]], redistribute=False)
        n += len(idx["sounds"]) > before
    save_index(idx)
    print(f"import-manifest: {n} new (library now {len(idx['sounds'])})")


def cmd_import_dir(a):
    idx = load_index(); n = 0
    for p in sorted(Path(a.folder).rglob("*")):
        if p.suffix.lower() not in {".wav", ".mp3", ".ogg", ".flac", ".aif", ".aiff", ".m4a"}:
            continue
        cat = a.category or guess_category(str(p.relative_to(a.folder)))
        before = len(idx["sounds"])
        add_sound(idx, local=str(p), name=p.stem, category=cat, source=a.source, source_id=sha256(p)[:12],
                  source_url=a.source_url, license=a.license, author=a.author or "", tags=re.split(r"[\W_]+", p.stem),
                  redistribute=not a.private)
        n += len(idx["sounds"]) > before
    save_index(idx); print(f"import-dir: {n} new (library now {len(idx['sounds'])})")


# ---------------------------------------------------------------- search / pick
def tokens(s):
    return [t for t in re.split(r"[^a-z0-9א-ת]+", s.lower()) if len(t) > 1]


def keyword_score(s, q_tokens, mood=()):
    hay_name = " ".join(tokens(s["name"]))
    hay = " ".join([hay_name, " ".join(s["tags"]), s["description"].lower(), s["category"], s["category_he"], " ".join(s["mood"])])
    score = 0.0
    for t in q_tokens:
        if t in hay_name: score += 3
        elif t in s["tags"]: score += 2
        elif t in hay: score += 1
        elif any(t in w for w in CATEGORIES[s["category"]]["words"]): score += 0.5  # weak: category-level match only
    score += sum(2 for m in mood if m in s["mood"] or m in s["tags"])
    return score


def semantic_scores(query, ids):
    emb = ROOT / "embeddings.npz"
    py = ROOT.parent.parent / ".claude/skills/sfx-finder/.venv/bin/python"
    if not emb.exists() or not py.exists():
        return {}
    r = run([str(py), str(Path(__file__).parent / "embed.py"), "query", query])
    if r.returncode != 0:
        print(r.stderr[-400:], file=sys.stderr); return {}
    return json.loads(r.stdout)


def available(s):
    return (ROOT / s["file"]).exists()


def ensure_file(s):
    p = ROOT / s["file"]
    if p.exists():
        return True
    if not s.get("download_url"):
        return False
    p.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / ("raw" + Path(urllib.parse.urlparse(s["download_url"]).path).suffix)
        try:
            download(s["download_url"], raw); process(raw, p, s["category"])
        except Exception as e:  # noqa: BLE001
            print(f"  could not restore {s['id']}: {e}", file=sys.stderr); return False
    return True


def rank(idx, query="", category=None, mood=(), max_dur=None, min_dur=None, semantic=False):
    q = tokens(query)
    pool = [s for s in idx["sounds"] if (not category or s["category"] in category)
            and (not max_dur or (s["duration"] or 0) <= max_dur) and (not min_dur or (s["duration"] or 0) >= min_dur)]
    sem = semantic_scores(query, [s["id"] for s in pool]) if semantic and query else {}
    out = []
    for s in pool:
        k = keyword_score(s, q, mood)
        v = sem.get(s["id"])
        total = k + (v * 10 if v is not None else 0)
        if q and not k and v is None:
            continue
        out.append((total, k, v, s))
    out.sort(key=lambda x: -x[0])
    return out


def cmd_search(a):
    idx = load_index()
    cats = [a.category] if a.category else None
    res = rank(idx, a.query, cats, a.mood or (), a.max_dur, a.min_dur, a.semantic)[: a.top]
    rows = [{"rank": i + 1, "id": s["id"], "name": s["name"], "category": s["category"], "duration": s["duration"],
             "keyword": k, "clap": None if v is None else round(v, 3), "license": s["license"],
             "path": str(ROOT / s["file"]), "on_disk": available(s), "source_url": s["source_url"]}
            for i, (t, k, v, s) in enumerate(res)]
    print(json.dumps({"query": a.query, "results": rows}, ensure_ascii=False, indent=1))
    if not rows:
        print("no local match: try `fetch` (Freesound) with literal sound words", file=sys.stderr)


def load_usage():
    return json.loads(USAGE.read_text()) if USAGE.exists() else {"uses": []}


def cmd_pick(a):
    """Choose one sound for an edit cue: fits the category/mood/length, avoids takes used in recent videos
    and inside this video. Records the choice in usage.json when --video is given."""
    idx = load_index(); usage = load_usage()
    cats = CUE_TYPES.get(a.cue, [a.cue]) if a.cue else ([a.category] if a.category else None)
    recent = [u["id"] for u in usage["uses"][-400:]]
    in_video = [u["id"] for u in usage["uses"] if a.video and u.get("video") == a.video]
    cands = rank(idx, a.query or "", cats, a.mood or (), a.max_dur, a.min_dur, a.semantic)
    if a.query:  # when some sounds match the words themselves, drop the ones that only match the category
        best = max((k for _, k, _, _ in cands), default=0)
        if best >= 2:
            cands = [c for c in cands if c[1] >= 2]
    if not cands:
        print(json.dumps({"error": f"no sound for cue={a.cue} category={a.category}; run fetch"})); sys.exit(2)
    rnd = random.Random(a.seed if a.seed is not None else f"{a.video}:{a.cue}:{len(in_video)}")
    scored = []
    for total, k, v, s in cands[:60]:
        pref = 2.0 if cats and s["category"] == cats[0] else 0
        fit = -abs((s["duration"] or 0) - a.dur) * 1.5 if a.dur else 0
        pen = 6 * in_video.count(s["id"]) + 1.2 * recent.count(s["id"])
        scored.append((total + pref + fit - pen + rnd.random() * 1.5, s))
    scored.sort(key=lambda x: -x[0])
    for _, s in scored:
        if ensure_file(s):
            if a.video:
                usage["uses"].append({"id": s["id"], "video": a.video, "cue": a.cue or a.category, "date": datetime.date.today().isoformat()})
                USAGE.write_text(json.dumps(usage, indent=1))
            print(json.dumps({"id": s["id"], "path": str(ROOT / s["file"]), "category": s["category"], "name": s["name"],
                              "duration": s["duration"], "license": s["license"], "attribution": s["attribution"]}, ensure_ascii=False))
            return
    print(json.dumps({"error": "candidates found but none could be loaded"})); sys.exit(2)


# ---------------------------------------------------------------- maintenance
def cmd_stats(a):
    idx = load_index(); by = {}
    for s in idx["sounds"]:
        by.setdefault(s["category"], []).append(s)
    total_dur = sum(s["duration"] or 0 for s in idx["sounds"])
    print(f"library: {ROOT}")
    print(f"sounds: {len(idx['sounds'])}   on disk: {sum(available(s) for s in idx['sounds'])}   "
          f"committed: {sum(s['committed'] for s in idx['sounds'])}   cache-only: {sum(not s['committed'] for s in idx['sounds'])}   "
          f"total audio: {total_dur/60:.1f} min")
    for c in CATEGORIES:
        lst = by.get(c, [])
        print(f"  {c:<16} {len(lst):>4}   {CATEGORIES[c]['he']}")
    lic = {}; src = {}
    for s in idx["sounds"]:
        lic[s["license"]] = lic.get(s["license"], 0) + 1; src[s["source"]] = src.get(s["source"], 0) + 1
    print("licences:", lic); print("sources:", src)


def cmd_ensure(a):
    idx = load_index(); fixed = miss = 0
    for s in idx["sounds"]:
        if not available(s):
            ok = ensure_file(s); fixed += ok; miss += not ok
    print(f"ensure: restored {fixed}, unrecoverable {miss}")


def cmd_verify(a):
    idx = load_index(); problems = []
    ids = [s["id"] for s in idx["sounds"]]
    if len(ids) != len(set(ids)): problems.append("duplicate ids")
    keys = [s["source_key"] for s in idx["sounds"]]
    if len(keys) != len(set(keys)): problems.append("duplicate source keys")
    for s in idx["sounds"]:
        p = ROOT / s["file"]
        if s["committed"] and not p.exists(): problems.append(f"missing committed file {s['file']}")
        elif p.exists() and s["committed"] and sha256(p) != s["sha256"]: problems.append(f"hash mismatch {s['file']}")
        elif p.exists() and not s["committed"] and fingerprint(p) != s.get("fingerprint"):
            problems.append(f"restored audio differs {s['file']}")  # cache files: OGG serials vary, so compare the audio
        if s["committed"] and not redistributable(s["license"]): problems.append(f"non-redistributable committed {s['id']}")
        if not license_ok(s["license"]): problems.append(f"bad licence {s['id']}")
    print(json.dumps({"sounds": len(ids), "problems": problems}, indent=1))
    sys.exit(1 if problems else 0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("stats").set_defaults(f=cmd_stats)
    sp.add_parser("ensure").set_defaults(f=cmd_ensure)
    sp.add_parser("verify").set_defaults(f=cmd_verify)
    p = sp.add_parser("search"); p.add_argument("query", nargs="?", default=""); p.add_argument("--category")
    p.add_argument("--mood", nargs="*"); p.add_argument("--max-dur", type=float); p.add_argument("--min-dur", type=float)
    p.add_argument("--top", type=int, default=8); p.add_argument("--semantic", action="store_true"); p.set_defaults(f=cmd_search)
    p = sp.add_parser("fetch"); p.add_argument("query"); p.add_argument("--category", choices=list(CATEGORIES))
    p.add_argument("--n", type=int, default=10); p.add_argument("--max-dur", type=float, default=30); p.set_defaults(f=cmd_fetch)
    p = sp.add_parser("import-openverse"); p.add_argument("file"); p.add_argument("--category", choices=list(CATEGORIES)); p.set_defaults(f=cmd_import_openverse)
    p = sp.add_parser("import-tsv"); p.add_argument("file"); p.add_argument("--category", choices=list(CATEGORIES)); p.set_defaults(f=cmd_import_tsv)
    p = sp.add_parser("import-manifest"); p.add_argument("file"); p.add_argument("--runtime", action="store_true"); p.set_defaults(f=cmd_import_manifest)
    p = sp.add_parser("import-dir"); p.add_argument("folder"); p.add_argument("--license", required=True); p.add_argument("--source", default="local")
    p.add_argument("--source-url"); p.add_argument("--author"); p.add_argument("--category", choices=list(CATEGORIES)); p.add_argument("--private", action="store_true")
    p.set_defaults(f=cmd_import_dir)
    p = sp.add_parser("pick"); p.add_argument("--cue", choices=list(CUE_TYPES)); p.add_argument("--category", choices=list(CATEGORIES))
    p.add_argument("--query"); p.add_argument("--mood", nargs="*"); p.add_argument("--dur", type=float); p.add_argument("--max-dur", type=float)
    p.add_argument("--min-dur", type=float); p.add_argument("--video"); p.add_argument("--seed"); p.add_argument("--semantic", action="store_true")
    p.set_defaults(f=cmd_pick)
    a = ap.parse_args(); a.f(a)


if __name__ == "__main__":
    main()
