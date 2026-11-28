#!/usr/bin/env python3
"""Sync proof for a mix.py render: onset of every start-aligned cue vs its frame, anchors of peak/end cues,
and a waveform sheet with cue lines (waveform.png). Run with the sfx-finder venv:
  .claude/skills/sfx-finder/.venv/bin/python qc_sync.py reels/x/out      (the folder mix.py wrote)
Pass = every onset within one frame after its cue.
"""
import json, subprocess, sys
from pathlib import Path

import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt

SR = 48000
d = Path(sys.argv[1])
x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(d / "stems/sfx.wav"), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                                 capture_output=True).stdout, np.float32)
R = json.loads((d / "cues.resolved.json").read_text())
fps = R[1]["frame"] / R[1]["t"] if len(R) > 1 and R[1]["t"] else 30
errs = []
for r in R:
    if r["align"] != "start":
        continue
    c = int(r["t"] * SR)
    pre = np.abs(x[max(0, c - int(.03 * SR)):c]).max() if c > 0 else 0
    post = np.abs(x[c:c + int(.06 * SR)])
    on = int(np.argmax(post > max(pre * 1.5, post.max() * 0.1))) if post.size else 0
    errs.append(on / SR * 1000)
anchors = [abs(r["landed"] - r["t"]) * 1000 for r in R if r["align"] in ("peak", "end") and r["landed"] is not None]
frame_ms = 1000 / fps
ok = all(e <= frame_ms for e in errs) and all(a <= 1 for a in anchors)
fig, ax = plt.subplots(figsize=(16, 3.2))
ax.plot(np.arange(len(x))[::40] / SR, x[::40], lw=.4, color="#b08850")
for r in R:
    ax.axvline(r["t"], color="r", lw=.5, alpha=.6)
ax.set_title("SFX stem with cue lines"); plt.tight_layout(); plt.savefig(d / "waveform.png", dpi=90)
print(json.dumps({"start_cues": len(errs), "onset_ms_max": round(max(errs, default=0), 1), "onset_ms_median": round(float(np.median(errs)) if errs else 0, 1),
                  "anchor_ms_max": round(max(anchors, default=0), 2), "frame_ms": round(frame_ms, 1), "verdict": "PASS" if ok else "FAIL"}))
sys.exit(0 if ok else 1)
