"""Download, analyse, de-duplicate and index every sound in the manifest.

Per sound we store: file path, sha256, duration, sample rate, channels, format, integrated and max short-term
loudness (LUFS), true-ish peak, crest factor, spectral centroid (brightness), low-end share (bassiness),
attack and peak time (sync point), noise floor, a quality score 1-5, length/loudness classes, categories, styles,
and a 64-point waveform for previews.

Duplicates are refused twice: identical files (sha256) and identical audio in another wrapper or source
(an acoustic fingerprint compared among sounds of near-equal length).
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import urllib.parse
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

from .common import AUDIO, CACHE, DATA, ROOT, fetch, load_manifest, save_manifest, sha256, slug
from .taxonomy import classify, styles

SR = 22050
AUDIO_EXT = (".wav", ".ogg", ".mp3", ".flac", ".aif", ".aiff", ".m4a")
FORMAT_Q = {"wav": 1.0, "flac": 1.0, "aiff": 1.0, "aif": 1.0, "ogg": 0.8, "mp3": 0.65, "m4a": 0.7}


# ---------------------------------------------------------------- decoding & features
def decode(path: Path, sr: int = SR) -> np.ndarray:
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32)


def probe(path: Path) -> dict:
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
                                  capture_output=True, check=True).stdout)
    st = next(s for s in j["streams"] if s["codec_type"] == "audio")
    return {"sample_rate": int(st.get("sample_rate", 0)), "channels": int(st.get("channels", 1)),
            "codec": st.get("codec_name"), "bit_rate": int(j["format"].get("bit_rate") or 0),
            "duration": float(j["format"].get("duration") or st.get("duration") or 0)}


def _lufs(x: np.ndarray, sr: int) -> tuple[float, float]:
    import pyloudnorm as pyln
    meter = pyln.Meter(sr, block_size=min(0.4, max(0.05, len(x) / sr * 0.9)))
    try:
        integ = float(meter.integrated_loudness(x.astype(np.float64)))
    except Exception:  # noqa: BLE001
        integ = float("-inf")
    # max short window (150 ms) loudness, like SFX Kit's scale, approximated on RMS of K-free signal
    win = max(1, int(0.15 * sr))
    if len(x) > win:
        c = np.convolve(x.astype(np.float64) ** 2, np.ones(win) / win, mode="valid")
        mx = 10 * np.log10(c.max() + 1e-12) - 0.691 + 3.0
    else:
        mx = 10 * np.log10(np.mean(x ** 2) + 1e-12) - 0.691 + 3.0
    return integ, float(mx)


def features(x: np.ndarray, sr: int = SR) -> dict:
    n = len(x)
    dur = n / sr
    if n < 64:
        raise ValueError("empty audio")
    peak = float(np.max(np.abs(x)) + 1e-12)
    rms = float(np.sqrt(np.mean(x ** 2)) + 1e-12)
    hop = max(1, int(0.01 * sr))
    frames = np.sqrt(np.add.reduceat(x ** 2, np.arange(0, n, hop)) / hop + 1e-12)
    env_db = 20 * np.log10(frames + 1e-9)
    top = env_db.max()
    audible = np.where(env_db > top - 40)[0]
    peak_t = float(np.argmax(frames) * hop / sr)
    onset = float(audible[0] * hop / sr) if len(audible) else 0.0
    above = np.where(env_db > top - 10)[0]
    attack = float(max(0.0, (above[0] * hop / sr) - onset)) if len(above) else 0.0
    noise_floor = float(np.percentile(env_db, 5)) if len(env_db) > 20 else float(env_db.min())
    clip_ratio = float(np.mean(np.abs(x) > 0.995))
    # spectrum on up to 30 s
    seg = x[: sr * 30]
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    freqs = np.fft.rfftfreq(len(seg), 1 / sr)
    tot = spec.sum() + 1e-12
    centroid = float((freqs * spec).sum() / tot)
    low_share = float(spec[freqs < 150].sum() / tot)
    integ, mx = _lufs(x, sr)
    # waveform for previews (64 points, 0-99)
    pts = 64
    edges = np.linspace(0, n, pts + 1).astype(int)
    wf = [float(np.max(np.abs(x[a:b]))) if b > a else 0.0 for a, b in zip(edges[:-1], edges[1:])]
    wf = [int(round(99 * v / peak)) for v in wf]
    # acoustic fingerprint: 32-point log envelope + 8-band spectral shape
    e32 = np.interp(np.linspace(0, len(frames) - 1, 32), np.arange(len(frames)), env_db)
    bands = np.array_split(spec[: len(spec) // 2 + 1], 8)
    sh = np.log10(np.array([b.sum() for b in bands]) + 1e-12)
    fp = np.concatenate([(e32 - e32.mean()) / (e32.std() + 1e-6), (sh - sh.mean()) / (sh.std() + 1e-6)])
    return {"duration": round(dur, 3), "peak_db": round(float(20 * np.log10(peak)), 2), "rms_db": round(20 * np.log10(rms), 2),
            "lufs": round(integ, 1) if np.isfinite(integ) else None, "lufs_max_150ms": round(mx, 1),
            "crest_db": round(20 * np.log10(peak / rms), 1), "centroid_hz": round(centroid), "low_share": round(low_share, 3),
            "onset": round(onset, 3), "peak_time": round(peak_t, 3), "attack": round(attack, 3),
            "noise_floor_db": round(noise_floor, 1), "clip_ratio": round(clip_ratio, 5), "waveform": wf,
            "fingerprint": [round(float(v), 3) for v in fp]}


def quality(rec: dict) -> float:
    """1-5: format and bandwidth, clean ends, no clipping, low noise floor, source reputation."""
    q = 2.0 + 1.6 * FORMAT_Q.get(rec.get("format", ""), 0.6)
    if (rec.get("sample_rate") or 0) >= 44100:
        q += 0.3
    if rec.get("clip_ratio", 0) > 0.002:
        q -= 0.8
    nf = rec.get("noise_floor_db")
    if nf is not None and rec.get("duration", 0) > 1.0 and nf > -45:
        q -= 0.4
    if rec["source"] in ("sfxkit",):
        q += 0.6
    if rec["source"] == "freesound":
        q += 0.25 * (rec.get("rating", 3) - 3.5)
    if rec.get("duration", 0) < 0.04:
        q -= 1
    return round(max(1.0, min(5.0, q)), 2)


def classes(rec: dict) -> None:
    d = rec.get("duration", 0)
    rec["length_class"] = ("micro" if d < 0.5 else "short" if d < 2 else "medium" if d < 6 else "long" if d < 20 else "bed")
    m = rec.get("lufs_max_150ms", -30)
    rec["loudness_class"] = "soft" if m < -24 else "medium" if m < -16 else "loud"
    c = rec.get("centroid_hz", 2000)
    rec["tone"] = "dark" if c < 900 else "bright" if c > 4000 else "mid"
    if rec.get("sync_at") is None:
        rec["sync_at"] = rec.get("peak_time")


# ---------------------------------------------------------------- downloading
def _dest(rec: dict, ext: str) -> Path:
    cat = (rec.get("categories") or classify(rec))[0]
    base = slug(rec.get("title", "sound"), 40) + "__" + slug(str(rec["source_id"]).replace("/", "-"), 40)
    return AUDIO / rec["source"] / cat / f"{base}{ext}"


def _download(rec: dict) -> Path:
    url = rec["download_url"]
    if url.startswith("local:"):
        src = Path(url[6:])
        dst = _dest(rec, src.suffix.lower())
        if not dst.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        return dst
    ext = Path(urllib.parse.urlparse(url).path).suffix.lower() or ".mp3"
    dst = _dest(rec, ext)
    if not dst.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        tmp = dst.with_suffix(ext + ".part")
        tmp.write_bytes(fetch(url, timeout=300))
        tmp.replace(dst)
    return dst


def _fetch_archive(rid: str, url: str) -> tuple[str, Path | None, str | None]:
    zdir = CACHE / "archives" / slug(rid, 80)
    if zdir.exists():
        return rid, zdir, None
    zp = zdir.with_suffix(".zip")
    try:
        if not zp.exists():
            zp.parent.mkdir(parents=True, exist_ok=True)
            tmp = zp.with_suffix(".part")
            tmp.write_bytes(fetch(url, timeout=900))
            tmp.replace(zp)
        with zipfile.ZipFile(zp) as z:
            for m in z.infolist():
                name = m.filename
                if (name.lower().endswith(AUDIO_EXT) and ".." not in name and not name.startswith("/")
                        and "__MACOSX" not in name and m.file_size < 60e6):
                    z.extract(m, zdir)
        zdir.mkdir(parents=True, exist_ok=True)
        return rid, zdir, None
    except (OSError, zipfile.BadZipFile) as e:
        return rid, None, repr(e)[:200]


def expand_archives(recs: dict, workers: int = 8) -> int:
    """Turn archive records (zips on OpenGameArt) into one record per audio file inside."""
    added = 0
    todo = [(k, r["download_url"]) for k, r in recs.items() if r.get("archive") and not r.get("expanded")]
    with ThreadPoolExecutor(workers) as ex:
        results = list(ex.map(lambda a: _fetch_archive(*a), todo))
    for rid, zdir, err in results:
        r = recs[rid]
        r["expanded"] = True
        r["skip"] = True  # the archive itself is not a sound
        if err:
            r["error"] = err
            continue
        for f in sorted(zdir.rglob("*")):
            if f.suffix.lower() not in AUDIO_EXT or f.name.startswith("._"):
                continue
            rel = f.relative_to(zdir).as_posix()
            nid = f"{rid}/{rel}"
            if nid in recs:
                continue
            words = f.stem.replace("_", " ").replace("-", " ")
            recs[nid] = {**{k: v for k, v in r.items() if k not in ("archive", "expanded", "id", "source_id", "skip", "error")},
                         "id": nid, "source_id": nid.split(":", 1)[1], "title": f"{r['title'].split(' - ')[0]} - {words}",
                         "download_url": f"local:{f}", "archive_member": rel}
            added += 1
    return added


def process(rec: dict) -> dict:
    try:
        p = _download(rec)
        info = probe(p)
        x = decode(p)
        f = features(x)
    except Exception as e:  # noqa: BLE001
        rec["error"] = repr(e)[:300]
        return rec
    rec.pop("error", None)
    rec.update(info)
    rec.update(f)
    rec["file"] = p.relative_to(ROOT).as_posix()
    rec["bytes"] = p.stat().st_size
    rec["format"] = p.suffix.lower().lstrip(".")
    rec["sha256"] = sha256(p)
    rec["categories"] = rec.get("categories") or classify(rec)
    rec["styles"] = styles(rec)
    classes(rec)
    rec["quality"] = quality(rec)
    return rec


def dedupe(recs: dict) -> int:
    """Mark duplicates (same sha256, or same audio by fingerprint at near-equal length). Keeps the best copy."""
    rank = lambda r: (r.get("quality", 0), {"sfxkit": 4, "kenney": 3, "mixkit": 3, "opengameart": 2, "freesound": 1}.get(r["source"], 0))  # noqa: E731
    live = [r for r in recs.values() if r.get("file") and not r.get("skip")]
    for r in live:
        r.pop("duplicate_of", None)
    by_sha: dict[str, list] = {}
    for r in live:
        by_sha.setdefault(r["sha256"], []).append(r)
    dups = 0
    for group in by_sha.values():
        if len(group) > 1:
            group.sort(key=rank, reverse=True)
            for r in group[1:]:
                r["duplicate_of"] = group[0]["id"]
                dups += 1
    rest = sorted([r for r in live if "duplicate_of" not in r], key=lambda r: r["duration"])
    fps = np.array([r["fingerprint"] for r in rest]) if rest else np.zeros((0, 40))
    durs = np.array([r["duration"] for r in rest])
    for i, r in enumerate(rest):
        if "duplicate_of" in r:
            continue
        j = np.searchsorted(durs, r["duration"] * 1.02 + 0.01, side="right")
        for k in range(i + 1, j):
            o = rest[k]
            if "duplicate_of" in o:
                continue
            corr = float(np.dot(fps[i], fps[k]) / len(fps[i]))
            if corr > 0.985 and abs(o.get("lufs_max_150ms", 0) - r.get("lufs_max_150ms", 0)) < 6:
                keep, drop = (r, o) if rank(r) >= rank(o) else (o, r)
                drop["duplicate_of"] = keep["id"]
                dups += 1
    return dups


def sync(limit: int | None = None, workers: int = 8, sources: list[str] | None = None) -> dict:
    recs = load_manifest()
    expand_archives(recs)
    todo = [r for r in recs.values() if not r.get("skip") and not r.get("file")
            and (not sources or r["source"] in sources)]
    # restore: files missing on disk (fresh container) are downloaded again
    todo += [r for r in recs.values() if r.get("file") and not (ROOT / r["file"]).exists() and r not in todo
             and not r.get("skip") and (not sources or r["source"] in sources)]
    if limit:
        todo = todo[:limit]
    done = 0
    with ThreadPoolExecutor(workers) as ex:
        for i, r in enumerate(ex.map(process, todo), 1):
            recs[r["id"]] = r
            done += "error" not in r
            if i % 200 == 0:
                print(f"  {i}/{len(todo)}", flush=True)
                save_manifest(recs)
    d = dedupe(recs)
    save_manifest(recs)
    build_index(recs)
    return {"processed": len(todo), "ok": done, "duplicates": d}


# ---------------------------------------------------------------- index for search & preview
INDEX_FIELDS = ["id", "title", "source", "categories", "styles", "tags", "duration", "length_class", "loudness_class",
                "tone", "quality", "lufs_max_150ms", "peak_db", "sync_at", "attack", "license", "license_url",
                "attribution_required", "credit", "author", "page_url", "file", "format", "description", "use_for",
                "preview_url", "redistribute_ok", "under_voiceover_db", "low_share", "centroid_hz"]


def available(recs: dict) -> list[dict]:
    return [r for r in recs.values() if r.get("file") and not r.get("skip") and not r.get("duplicate_of")
            and "error" not in r]


def build_index(recs: dict | None = None) -> Path:
    recs = recs or load_manifest()
    rows = []
    for r in sorted(available(recs), key=lambda r: (r["categories"][0], -r.get("quality", 0))):
        row = {k: r.get(k) for k in INDEX_FIELDS if r.get(k) not in (None, [], "")}
        row["tags"] = row.get("tags", [])[:14]
        row["wf"] = "".join(chr(48 + min(74, v * 74 // 99)) for v in r.get("waveform", []))
        rows.append(row)
    out = DATA / "index.json"
    out.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
    return out


def stats(recs: dict | None = None) -> dict:
    recs = recs or load_manifest()
    live = available(recs)
    from collections import Counter
    return {
        "manifest_records": sum(1 for r in recs.values() if not r.get("skip")),
        "downloaded_files": sum(1 for r in recs.values() if r.get("file") and not r.get("skip") and "error" not in r),
        "available_unique": len(live),
        "duplicates_blocked": sum(1 for r in recs.values() if r.get("duplicate_of")),
        "errors": sum(1 for r in recs.values() if "error" in r and not r.get("skip")),
        "by_source": dict(Counter(r["source"] for r in live)),
        "by_category": dict(Counter(c for r in live for c in r["categories"]).most_common()),
        "by_license": dict(Counter(r["license"] for r in live)),
        "hours": round(sum(r["duration"] for r in live) / 3600, 2),
        "gigabytes": round(sum(r.get("bytes", 0) for r in live) / 1e9, 2),
    }


if __name__ == "__main__":
    print(sync(limit=int(sys.argv[1]) if len(sys.argv) > 1 else None))
