"""Automatic sound design for a video: find the moments, pick fitting sounds, write a cue sheet, mix.

Moments detected from the picture (ffmpeg + numpy, no GPU):
  cut      scene change                       -> transition whoosh, its sync point on the cut
  flash    sudden brightness jump              -> hit + sub layered
  move     peak of fast motion (not at a cut)  -> swish sized to the move
  stop     fast motion that halts              -> soft impact / thud
  climax   biggest moment after the hook       -> riser that resolves on it
  hook     first frame                         -> a hit (and sub) so second one lands
  end      last 0.6 s                          -> sting / boom
Music (in the video or a separate file) gives a beat grid; cue times snap to the nearest beat when close.

Presets change which sounds are searched for each role. Each sound is used once per video when the pool allows
(variety rule: no machine-gun repeats).
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np

from . import mix
from .search import search

PRESETS = {
    "cinematic": {"cut": "cinematic whoosh transition", "flash": "cinematic hit impact", "sub": "sub drop boom bass",
                  "move": "whoosh swish", "stop": "impact thud", "riser": "riser cinematic tension", "end": "cinematic boom hit",
                  "hook": "cinematic hit braam", "ambience": None},
    "viral": {"cut": "swoosh transition fast", "flash": "vine boom bass hit", "sub": "808 bass drop",
              "move": "swish whoosh quick", "stop": "pop bonk", "riser": "riser build", "end": "record scratch",
              "hook": "boom impact", "ambience": None},
    "comedy": {"cut": "cartoon whoosh", "flash": "boing bonk cartoon", "sub": None, "move": "slide whistle swish",
               "stop": "cartoon bonk", "riser": "cartoon riser slide whistle up", "end": "sad trombone fail",
               "hook": "cartoon pop", "ambience": None},
    "clean": {"cut": "whoosh soft", "flash": "impact soft", "sub": "sub soft", "move": "swish soft", "stop": "pop small",
              "riser": "riser soft", "end": "logo sting", "hook": "shimmer reveal", "ambience": None},
    "horror": {"cut": "horror whoosh dark", "flash": "horror hit jumpscare", "sub": "sub boom rumble", "move": "whoosh dark",
               "stop": "impact deep", "riser": "horror riser tension", "end": "horror stinger", "hook": "horror hit",
               "ambience": "eerie drone ambience"},
}


# ---------------------------------------------------------------- picture analysis
def video_info(path: str) -> dict:
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path],
                                  capture_output=True, check=True).stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    num, den = (v.get("avg_frame_rate") or "30/1").split("/")
    return {"duration": float(j["format"]["duration"]), "fps": float(num) / float(den or 1),
            "has_audio": any(s["codec_type"] == "audio" for s in j["streams"])}


def frames_lowres(path: str, fps: float = 15, w: int = 48, h: int = 64) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps={fps},scale={w}:{h},format=gray",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32) / 255.0


def scene_cuts(path: str, thresh: float = 0.32) -> list[float]:
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", path, "-vf", f"select='gt(scene,{thresh})',showinfo", "-an",
                        "-f", "null", "-"], capture_output=True, text=True)
    out = []
    for line in r.stderr.splitlines():
        if "pts_time:" in line:
            out.append(float(line.split("pts_time:")[1].split()[0]))
    return out


def _peaks(x: np.ndarray, min_gap: int, thresh: float) -> list[int]:
    idx = []
    for i in range(1, len(x) - 1):
        if x[i] >= thresh and x[i] >= x[i - 1] and x[i] >= x[i + 1]:
            if idx and i - idx[-1] < min_gap:
                if x[i] > x[idx[-1]]:
                    idx[-1] = i
                continue
            idx.append(i)
    return idx


def analyse(path: str, fps: float = 15) -> dict:
    info = video_info(path)
    fr = frames_lowres(path, fps)
    cuts = []
    for c in scene_cuts(path):  # one cut can trip the detector on two neighbouring frames
        if not cuts or c - cuts[-1] > 0.25:
            cuts.append(c)
    motion = np.concatenate([[0], np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))])
    luma = fr.mean(axis=(1, 2))
    near_cut = lambda t, d=0.25: any(abs(t - c) < d for c in cuts)  # noqa: E731
    m_s = np.convolve(motion, np.ones(3) / 3, mode="same")
    thr = float(np.percentile(m_s, 80)) if len(m_s) > 10 else 1
    moves = [i / fps for i in _peaks(m_s, int(fps * 0.6), max(thr, 0.02)) if not near_cut(i / fps)]
    stops = []
    for i in range(3, len(m_s) - 2):
        if m_s[i - 2] > max(thr, 0.02) and m_s[i + 1] < m_s[i - 2] * 0.3 and not near_cut(i / fps):
            if not stops or i / fps - stops[-1] > 0.6:
                stops.append(i / fps)
    dl = np.diff(luma, prepend=luma[:1])
    flashes = [i / fps for i in _peaks(dl, int(fps * 0.5), 0.12)]
    return {**info, "cuts": cuts, "moves": moves, "stops": stops, "flashes": flashes,
            "motion_mean": float(motion.mean())}


# ---------------------------------------------------------------- music analysis (beats)
def beats(path: str, sr: int = 22050) -> dict | None:
    try:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                             capture_output=True, check=True).stdout
    except subprocess.CalledProcessError:
        return None
    x = np.frombuffer(raw, np.float32)
    if len(x) < sr * 2 or np.abs(x).max() < 1e-3:
        return None
    hop, n = 512, 2048
    win = np.hanning(n)
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * win
    mag = np.abs(np.fft.rfft(frames, axis=1))
    flux = np.maximum(0, np.diff(np.log1p(mag), axis=0)).sum(axis=1)
    flux = (flux - flux.mean()) / (flux.std() + 1e-9)
    fps = sr / hop
    ac = np.correlate(flux, flux, mode="full")[len(flux) - 1:]
    lo, hi = int(fps * 60 / 180), int(fps * 60 / 70)
    if hi >= len(ac):
        return None
    lag = lo + int(np.argmax(ac[lo:hi]))
    bpm = 60 * fps / lag
    # phase: offset that best lines a comb up with the flux
    best, off = -1e9, 0
    for o in range(lag):
        s = flux[o::lag].sum()
        if s > best:
            best, off = s, o
    return {"bpm": round(bpm, 2), "offset": round(off / fps, 3)}


# ---------------------------------------------------------------- picking sounds
class Picker:
    def __init__(self):
        self.used: set[str] = set()

    def pick(self, query: str | None, max_dur: float | None = None, min_dur: float | None = None,
             loudness: str | None = None) -> dict | None:
        if not query:
            return None
        for relax in (0, 1, 2):
            res = search(query, limit=40, max_dur=(max_dur * (1 + relax) if max_dur else None), min_dur=min_dur,
                         loudness=loudness if relax == 0 else None, min_quality=3.0)
            fresh = [r for r in res if r["id"] not in self.used]
            if fresh:
                # pick from the top few, not always #1, so two videos don't sound identical
                top = fresh[: min(4, len(fresh))]
                r = top[len(self.used) % len(top)]
                self.used.add(r["id"])
                return r
        return None


def plan(video: str, preset: str = "cinematic", music: str | None = None, density: float = 1.0,
         voice: str | None = None) -> dict:
    a = analyse(video)
    P = PRESETS[preset]
    pk = Picker()
    beat = beats(music) if music else (beats(video) if a["has_audio"] else None)
    cues = []

    def cue(t, r, layer, gain=0.0, **kw):
        if r:
            cues.append({"t": round(max(0.0, t), 3), "sound": r["id"], "layer": layer, "gain_db": gain,
                         "why": kw.pop("why", layer), **kw})

    D = a["duration"]
    # hook: hit (+ sub) on frame 0
    cue(0.0, pk.pick(P["hook"], max_dur=3), "hit", -5, align="start", why="hook")
    if P["sub"]:
        cue(0.0, pk.pick(P["sub"], max_dur=4), "sub", -6, align="start", why="hook sub")
    cuts = [c for c in a["cuts"] if 0.3 < c < D - 0.3]
    gaps = np.diff([0.0] + cuts + [D]) if cuts else [D]
    for i, c in enumerate(cuts):
        room = float(min(gaps[i], gaps[i + 1] if i + 1 < len(gaps) else 2.0))
        cue(c, pk.pick(P["cut"], max_dur=max(0.4, room * 1.2)), "transition", -2, fade_out=0.03, why="cut")
    for t in a["flashes"]:
        if t > 0.3:
            cue(t, pk.pick(P["flash"], max_dur=2.5), "hit", -1, why="flash")
            if P["sub"]:
                cue(t, pk.pick(P["sub"], max_dur=3), "sub", -4, why="flash sub")
    if density >= 1:
        for t in a["moves"][:: 1 if density > 1.5 else 2]:
            cue(t, pk.pick(P["move"], max_dur=0.9), "transition", -6, why="motion peak")
        for t in a["stops"][:6]:
            cue(t, pk.pick(P["stop"], max_dur=1.0, loudness="soft"), "foley", -6, why="motion stop")
    # climax: biggest flash, else the cut nearest 60% of the video
    targets = [t for t in a["flashes"] if t > 2.5] or [c for c in cuts if c > 2.5]
    if targets:
        climax = min(targets, key=lambda t: abs(t - D * 0.6))
        r = pk.pick(P["riser"], max_dur=min(6.0, climax - 0.5), min_dur=1.0)
        if r:
            cues.append({"t": round(climax, 3), "sound": r["id"], "layer": "fx", "gain_db": -4,
                         "align": "end", "why": "riser into climax"})
    if D > 3:
        cue(max(0.0, D - 0.6), pk.pick(P["end"], max_dur=4), "hit", 0, align="start", why="end")
    if P.get("ambience"):
        cue(0.0, pk.pick(P["ambience"], min_dur=4), "ambience", 0, align="start", fade_in=0.5, fade_out=1.0,
            trim=[0, D], why="bed")

    # risers aligned to their end; convert to start-aligned time
    from .common import load_manifest
    recs = load_manifest()
    for c in cues:
        if c.get("align") == "end":
            d = recs[c["sound"]].get("duration", 0)
            c["t"] = round(max(0.0, c["t"] - d), 3)
            c["align"] = "start"
            c["snap"] = None
    sheet = {"duration": D, "video": str(Path(video).resolve()), "preset": preset, "target_lufs": -14,
             "analysis": {k: a[k] for k in ("cuts", "moves", "stops", "flashes")}, "cues": sorted(cues, key=lambda c: c["t"])}
    if beat:
        sheet.update({"bpm": beat["bpm"], "beat_offset": beat["offset"], "snap": None})
        step = 60 / beat["bpm"]
        for c in sheet["cues"]:  # snap only when a beat is close: picture sync beats musical sync
            if c.get("snap", True) is None:
                continue
            s = mix.snap_time(c["t"], beat["bpm"], "beat", beat["offset"])
            if abs(s - c["t"]) < min(0.09, step * 0.2):
                c["t"] = round(s, 3)
    if music:
        sheet["music"] = {"file": str(Path(music).resolve()), "gain_db": -8}
    if voice:
        sheet["voice"] = {"file": str(Path(voice).resolve()), "gain_db": 0}
    return sheet


def run(video: str, out: str, preset: str = "cinematic", music: str | None = None, voice: str | None = None,
        density: float = 1.0) -> dict:
    sheet = plan(video, preset, music, density, voice)
    outp = Path(out)
    outp.parent.mkdir(parents=True, exist_ok=True)
    outp.with_suffix(".cues.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
    res = mix.render(sheet, outp)
    return {"cue_sheet": str(outp.with_suffix(".cues.json")), **res, "moments": sheet["analysis"],
            "bpm": sheet.get("bpm")}
