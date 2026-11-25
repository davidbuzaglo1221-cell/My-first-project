"""Tests for the sound library. Run: python3 -m pytest -q sound-library/tests"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sfxlib import library, mix, search, taxonomy  # noqa: E402
from sfxlib.common import DATA  # noqa: E402

HAS_INDEX = (DATA / "index.json").exists()


def tone(path, freq=440, dur=0.5, sr=48000, noise=False, fmt="wav"):
    args = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
            (f"anoisesrc=d={dur}:c=pink:a=0.5" if noise else f"sine=f={freq}:d={dur}:sample_rate={sr}"),
            "-af", f"afade=t=out:st={dur * 0.7}:d={dur * 0.3}", str(path)]
    subprocess.run(args, check=True)
    return path


# ---------------------------------------------------------------- taxonomy
def test_classify_whoosh():
    cats = taxonomy.classify({"title": "Fast cinematic whoosh", "tags": ["whoosh", "transition"]})
    assert "whoosh" in cats and "transitions" in cats


def test_classify_source_category_wins():
    assert taxonomy.classify({"title": "x", "tags": [], "source_category": "booms-and-bass"})[0] in ("bass", "cinematic")


def test_classify_barber():
    assert "barber" in taxonomy.classify({"title": "Hair clipper buzzing", "tags": ["clipper", "barber"]})


# ---------------------------------------------------------------- query parsing (Hebrew)
def test_parse_hebrew_cinematic_deep_transition():
    p = search.parse("צליל של מעבר קולנועי עמוק")
    assert {"transition", "cinematic"} <= set(p["terms"])
    assert p["mods"].get("tone") == "dark" and p["mods"].get("low")


def test_parse_prefix_and_phrase():
    p = search.parse("נפילת חפץ")
    assert "fall" in p["terms"] and "object" in p["terms"]
    p = search.parse("מכונת תספורת")
    assert "clipper" in p["terms"] or "haircut" in p["terms"]
    p = search.parse("והפיצוץ")  # ו + ה prefixes
    assert "explosion" in p["terms"]


def test_parse_english_plural_and_synonyms():
    p = search.parse("explosions")
    assert "explosion" in p["terms"] and "blast" in p["terms"]


# ---------------------------------------------------------------- features & dedupe
def test_features_and_quality(tmp_path):
    f = tone(tmp_path / "a.wav", 220, 1.0)
    x = library.decode(f)
    feat = library.features(x)
    assert 0.95 < feat["duration"] < 1.05
    assert feat["centroid_hz"] < 600 and feat["peak_db"] <= 0
    rec = {"source": "kenney", "format": "wav", "sample_rate": 48000, **feat}
    library.classes(rec)
    assert rec["length_class"] == "short" and rec["tone"] == "dark"
    assert 1 <= library.quality(rec) <= 5


def test_dedupe_catches_reencoded_copy(tmp_path):
    a = tone(tmp_path / "a.wav", 330, 1.2, noise=True)
    b = tmp_path / "b.mp3"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(a), "-b:a", "128k", str(b)], check=True)
    c = tone(tmp_path / "c.wav", 1200, 3.0)
    recs = {}
    for i, p in enumerate([a, b, c]):
        feat = library.features(library.decode(p))
        recs[f"t:{i}"] = {"id": f"t:{i}", "source": "freesound" if i == 1 else "kenney", "file": str(p),
                          "sha256": library.sha256(p), "quality": 4 - i * 0.1, **feat}
    assert library.dedupe(recs) == 1
    assert recs["t:1"]["duplicate_of"] == "t:0" and "duplicate_of" not in recs["t:2"]


def test_dedupe_exact_hash(tmp_path):
    a = tone(tmp_path / "a.wav", 500, 0.4)
    feat = library.features(library.decode(a))
    h = library.sha256(a)
    recs = {k: {"id": k, "source": s, "file": str(a), "sha256": h, "quality": 3, **feat}
            for k, s in (("x:1", "mixkit"), ("x:2", "freesound"))}
    assert library.dedupe(recs) == 1 and recs["x:2"]["duplicate_of"] == "x:1"


# ---------------------------------------------------------------- mixing
def test_snap_time():
    assert mix.snap_time(1.03, 120, "beat") == pytest.approx(1.0)
    assert mix.snap_time(1.3, 120, "beat") == pytest.approx(1.5)
    assert mix.snap_time(1.3, None, "beat") == 1.3


def test_render_layers_eq_fades(tmp_path):
    w = tone(tmp_path / "w.wav", 0, 0.6, noise=True)
    s = tone(tmp_path / "s.wav", 50, 1.0)
    h = tone(tmp_path / "h.wav", 900, 0.3)
    sheet = {"duration": 3.0, "target_lufs": -14, "bpm": 120, "snap": "beat", "cues": [
        {"t": 1.02, "sound": str(w), "layer": "transition", "align": "start", "fade_out": 0.1},
        {"t": 1.0, "sound": str(s), "layer": "sub", "align": "start", "eq": {"low_shelf": [80, 3]}},
        {"t": 2.0, "sound": str(h), "layer": "hit", "align": "start", "gain_db": -3, "eq": {"bell": [[900, -4, 1.0]]},
         "reverb": 0.4, "rate": 1.1},
    ]}
    out = tmp_path / "mix.wav"
    res = mix.render(sheet, out, recs={})
    assert out.exists() and len(res["cues"]) == 3
    assert res["cues"][0]["at"] == pytest.approx(1.0)  # snapped to the beat
    x = library.decode(out)
    sr = library.SR
    silent = np.abs(x[: int(0.8 * sr)]).max()
    loud = np.abs(x[int(1.0 * sr): int(1.5 * sr)]).max()
    assert loud > 0.05 and silent < loud * 0.1  # nothing before the first cue, sound right on it


def test_render_with_music_and_voice_ducking(tmp_path):
    m = tone(tmp_path / "m.wav", 220, 4.0)
    v = tone(tmp_path / "v.wav", 600, 1.5)
    hit = tone(tmp_path / "h.wav", 1500, 0.3)
    sheet = {"duration": 4.0, "music": {"file": str(m), "gain_db": -6}, "voice": {"file": str(v)},
             "cues": [{"t": 2.5, "sound": str(hit), "align": "start", "layer": "hit"}]}
    out = tmp_path / "full.m4a"
    mix.render(sheet, out, recs={})
    assert out.exists() and out.stat().st_size > 10000


# ---------------------------------------------------------------- video analysis
def make_video(path):
    """3 shots (2 s each) with hard cuts at 2.0 s and 4.0 s, plus a white flash at 5.0 s."""
    cmd = ["ffmpeg", "-y", "-v", "error",
           "-f", "lavfi", "-i", "color=c=#202020:s=360x640:d=2:r=30",
           "-f", "lavfi", "-i", "testsrc2=s=360x640:d=2:r=30",
           "-f", "lavfi", "-i", "color=c=#103060:s=360x640:d=1:r=30",
           "-f", "lavfi", "-i", "color=c=white:s=360x640:d=0.2:r=30",
           "-f", "lavfi", "-i", "color=c=#103060:s=360x640:d=0.8:r=30",
           "-filter_complex", "[0][1][2][3][4]concat=n=5:v=1[v]", "-map", "[v]", "-pix_fmt", "yuv420p", str(path)]
    subprocess.run(cmd, check=True)
    return path


def test_video_analysis_finds_cuts_and_flash(tmp_path):
    from sfxlib import autoscore
    v = make_video(tmp_path / "v.mp4")
    a = autoscore.analyse(str(v))
    assert any(abs(c - 2.0) < 0.1 for c in a["cuts"]) and any(abs(c - 4.0) < 0.1 for c in a["cuts"])
    assert any(abs(f - 5.0) < 0.15 for f in a["flashes"])


def test_beats_detects_tempo(tmp_path):
    from sfxlib import autoscore
    click = tmp_path / "click.wav"
    # 120 BPM click track, 8 s
    sr = 22050
    x = np.zeros(sr * 8, np.float32)
    for k in range(16):
        i = int(k * 0.5 * sr)
        x[i:i + 300] = np.hanning(300) * 0.9
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-", str(click)],
                   input=x.tobytes(), check=True)
    b = autoscore.beats(str(click))
    assert b and abs(b["bpm"] - 120) < 3 or abs(b["bpm"] - 60) < 2 or abs(b["bpm"] - 240) < 4


# ---------------------------------------------------------------- the real library (after `sfx sync`)
@pytest.mark.skipif(not HAS_INDEX, reason="library not built")
def test_library_natural_queries():
    for q, cat in [("צליל של מעבר קולנועי עמוק", {"transitions", "whoosh", "cinematic", "trailer", "bass", "risers"}),
                   ("פיצוץ", {"explosions", "cinematic", "weapons", "impacts", "bass"}),
                   ("חיה מדברת", {"animals", "human", "voice", "cartoon"}),
                   ("נפילת חפץ", {"drops", "impacts", "foley", "household", "breaking"}),
                   ("מכונת תספורת", {"barber", "household", "mechanical"})]:
        res = search.search(q, limit=5)
        assert res, q
        hits = sum(1 for r in res if set(r["categories"]) & cat)
        assert hits >= 3, (q, [(r["title"], r["categories"]) for r in res])


@pytest.mark.skipif(not HAS_INDEX, reason="library not built")
def test_library_filters_and_no_duplicates_or_bad_licences():
    rows = json.loads((DATA / "index.json").read_text())
    assert len({r["id"] for r in rows}) == len(rows)
    assert {r["license"] for r in rows} <= {"CC0", "CC-BY-4.0", "CC-BY-3.0", "Mixkit-SFX", "Pixabay"}
    assert all(r.get("license_url") and r.get("source") for r in rows)
    assert all(r.get("credit") for r in rows if r.get("attribution_required"))
    res = search.search("whoosh", limit=30, max_dur=1.0, loudness="loud", min_quality=3.5)
    assert res and all(r["duration"] <= 1.0 and r["loudness_class"] == "loud" and r["quality"] >= 3.5 for r in res)
