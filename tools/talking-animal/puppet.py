#!/usr/bin/env python3
"""Offline fallback (CPU only, no network): animate a still character so it talks to an audio track.

The lower jaw (a region under the mouth line) is opened in sync with the voice loudness,
the mouth interior is painted dark behind it, and the whole frame gets a subtle handheld
camera drift + slow push-in, so it never looks like a frozen photo.
Claude picks the mouth box by LOOKING at the image (no face detector needed, works on any animal).

Usage:
  python puppet.py --image dog.png --audio voice.mp3 --out out.mp4 \
      --mouth X1,Y1,X2,Y2      # mouth line box in image pixels: left, top(lip line), right, bottom(chin)
      [--open 0.5]             # max jaw drop as a fraction of box height
"""
import argparse, subprocess, tempfile, os
import numpy as np
import cv2

FPS = 30


def audio_env(path, fps):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    hop = 16000 // fps
    n = len(x) // hop
    rms = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2)) for i in range(n)])
    rms = rms / (np.percentile(rms, 95) + 1e-6)
    env = np.clip((rms - 0.12) / 0.75, 0, 1)
    # attack fast, release a bit slower, like a real jaw
    out, v = np.zeros_like(env), 0.0
    for i, e in enumerate(env):
        v = v + (e - v) * (0.65 if e > v else 0.35)
        out[i] = v
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--mouth", required=True)
    ap.add_argument("--open", type=float, default=0.5)
    a = ap.parse_args()

    img = cv2.imread(a.image)
    H, W = img.shape[:2]
    x1, y1, x2, y2 = map(int, a.mouth.split(","))
    bh = y2 - y1
    env = audio_env(a.audio, FPS)

    # soft mask of the jaw region (ellipse-ish, feathered) so edges never show
    jaw = np.zeros((H, W), np.float32)
    cv2.ellipse(jaw, ((x1 + x2) // 2, y1), ((x2 - x1) // 2, bh), 0, 0, 180, 1.0, -1)
    jaw = cv2.GaussianBlur(jaw, (0, 0), max(2, bh * 0.08))
    mouth_col = np.array([28, 22, 30], np.float32)  # dark, slightly warm interior

    tmp = tempfile.mkdtemp(prefix="puppet-")
    raw = os.path.join(tmp, "raw.mp4")
    vw = cv2.VideoWriter(raw, cv2.VideoWriter_fourcc(*"mp4v"), FPS, (W, H))
    rng = np.random.default_rng(3)
    drift = np.cumsum(rng.normal(0, 0.25, (len(env), 2)), axis=0)
    drift = cv2.GaussianBlur(drift.astype(np.float32), (1, 0), 6).reshape(-1, 2) if len(env) > 1 else drift
    base = img.astype(np.float32)
    for i, o in enumerate(env):
        d = o * a.open * bh
        # shift the jaw down by d pixels
        M = np.float32([[1, 0, 0], [0, 1, d]])
        moved = cv2.warpAffine(base, M, (W, H), borderMode=cv2.BORDER_REFLECT)
        mjaw = cv2.warpAffine(jaw, M, (W, H))
        # the gap between lip line and moved jaw shows the mouth interior
        gap = np.zeros((H, W), np.float32)
        if d > 1:
            cv2.ellipse(gap, ((x1 + x2) // 2, y1 + int(d * 0.35)), (int((x2 - x1) * 0.42), int(d * 0.6)), 0, 0, 360, 1.0, -1)
            gap = cv2.GaussianBlur(gap, (0, 0), 2)
        frame = base * (1 - gap[..., None]) + mouth_col * gap[..., None]
        frame = frame * (1 - mjaw[..., None]) + moved * mjaw[..., None]
        # slow push-in + handheld drift + slight nod with speech
        s = 1.0 + 0.04 * i / max(1, len(env))
        nod = o * 2.0
        C = cv2.getRotationMatrix2D((W / 2, H * 0.35), 0, s)
        C[:, 2] += [drift[i][0], drift[i][1] + nod]
        frame = cv2.warpAffine(frame, C, (W, H), borderMode=cv2.BORDER_REFLECT)
        vw.write(np.clip(frame, 0, 255).astype(np.uint8))
    vw.release()
    vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-i", a.audio, "-map", "0:v", "-map", "1:a",
                    "-vf", vf, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", "-movflags", "+faststart", a.out], check=True)
    print("[out]", a.out)


if __name__ == "__main__":
    main()
