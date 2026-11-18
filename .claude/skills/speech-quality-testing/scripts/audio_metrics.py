"""Measure what ears notice but transcripts miss.

Per clip:
  lufs        integrated loudness (EBU R128, ffmpeg ebur128). Target for speech in an app: -16 +-1.
  true_peak   dBTP. Must stay below -1.0 to avoid clipping after MP3 encoding.
  f0_median   median pitch, Hz (autocorrelation pitch tracker over voiced frames)
  f0_range_st pitch range in semitones, 10th to 90th percentile. Below ~3 st sounds monotone;
              natural narration is usually 4 to 10 st.
  f0_std_st   pitch spread in semitones.
  pause_ratio share of 20 ms frames that are silent (below -45 dBFS). Natural narration: 0.10-0.30.
  chars_per_s spoken characters per second (needs "text" in the manifest row). Hebrew narration
              sits around 12-16 at 1x.

usage: python audio_metrics.py manifest_or_asr.json metrics.json
"""
import json
import re
import subprocess
import sys

import numpy as np

SR = 16000


def load(path: str) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def loudness(path: str) -> tuple[float, float]:
    log = subprocess.run(["ffmpeg", "-nostats", "-i", path, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    summary = log[log.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", summary)
    p = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary)
    return (float(i.group(1)) if i else float("nan"), float(p.group(1)) if p and p.group(1) != "-inf" else float("nan"))


def pitch_track(x: np.ndarray) -> np.ndarray:
    frame, hop = int(0.04 * SR), int(0.01 * SR)
    lo, hi = int(SR / 400), int(SR / 70)  # 70-400 Hz covers adult speech
    f0 = []
    for start in range(0, len(x) - frame, hop):
        w = x[start : start + frame] * np.hanning(frame)
        if np.sqrt(np.mean(w**2)) < 0.01:
            continue
        ac = np.correlate(w, w, "full")[frame - 1 :]
        ac /= ac[0] + 1e-9
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.45:  # voiced
            f0.append(SR / lag)
    return np.array(f0)


def metrics(path: str) -> dict:
    x = load(path)
    lufs, peak = loudness(path)
    f0 = pitch_track(x)
    st = 12 * np.log2(f0 / np.median(f0)) if len(f0) else np.array([0.0])
    frames = x[: len(x) // 320 * 320].reshape(-1, 320)
    db = 20 * np.log10(np.sqrt(np.mean(frames**2, axis=1)) + 1e-9)
    return {
        "lufs": round(lufs, 1),
        "true_peak": round(peak, 1),
        "f0_median": round(float(np.median(f0)), 1) if len(f0) else None,
        "f0_range_st": round(float(np.percentile(st, 90) - np.percentile(st, 10)), 1),
        "f0_std_st": round(float(np.std(st)), 2),
        "pause_ratio": round(float(np.mean(db < -45)), 2),
        "seconds": round(len(x) / SR, 2),
    }


rows = json.load(open(sys.argv[1]))
out = []
for r in rows:
    m = {**r, **metrics(r["file"])}
    if r.get("spoken"):
        m["chars_per_s"] = round(len(r["spoken"]) / m["seconds"], 1)
    out.append(m)
    print(r["variant"], r["id"], {k: m[k] for k in ("lufs", "true_peak", "f0_range_st", "pause_ratio")}, flush=True)
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
