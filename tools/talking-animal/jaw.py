#!/usr/bin/env python3
"""Free, offline talking-mouth animator for cartoon / 3D characters (CPU, no network).

Instead of cutting a box (old puppet.py), the lower jaw is pulled down with a smooth
displacement field, so fur/skin stretches naturally; the gap that opens under the upper
lip becomes the mouth cavity (dark warm interior + tongue tint). Opening follows the voice
envelope with fast attack / slower release; the head nods and sways with the speech, plus a
slow push-in, so the frame is never static.

Claude places the mouth by looking at the image:
  --mouth CX,Y0,HALFW   centre x of the mouth, y of the upper-lip line, half width (px)
  --drop  PX            max jaw drop in px at full loudness (≈ 0.4–0.6 × half width)
  --chin  PX            how far below the lip the jaw motion fades out (≈ 1.3 × half width)
Usage: python jaw.py --image dog.png --audio voice.wav --out talk.mp4 --mouth 352,479,36 --drop 18 --chin 48
"""
import argparse, subprocess, tempfile, os
import numpy as np
import cv2

FPS = 30


def envelope(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    hop = 16000 // FPS
    n = len(x) // hop
    # speech band energy (ignore rumble), per frame
    b, a = np.array([1, -0.97]), 1  # pre-emphasis
    x = np.append(x[0], x[1:] - 0.97 * x[:-1])
    rms = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2)) for i in range(n)])
    rms /= (np.percentile(rms, 92) + 1e-6)
    env = np.clip((rms - 0.10) / 0.8, 0, 1) ** 0.8
    out, v = np.zeros_like(env), 0.0
    for i, e in enumerate(env):
        v += (e - v) * (0.7 if e > v else 0.4)
        out[i] = v
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--mouth", required=True)
    ap.add_argument("--drop", type=float, default=16)
    ap.add_argument("--chin", type=float, default=48)
    a = ap.parse_args()

    img = cv2.imread(a.image).astype(np.float32)
    H, W = img.shape[:2]
    cx, y0, hw = map(float, a.mouth.split(","))
    env = envelope(a.audio)

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # horizontal profile: widest pull at the centre, zero at the mouth corners
    prof_x = np.exp(-(np.abs(xx - cx) / (hw * 0.85)) ** 3.2)  # flat-topped: opens as an oval, not a slit
    prof_x[np.abs(xx - cx) > hw * 1.8] = 0  # no motion outside the muzzle
    # vertical profile below the lip line: full at the lip, fading to 0 at the chin edge
    t = np.clip((yy - y0) / a.chin, 0, 1)
    prof_y = np.where(yy >= y0, 1 - t * t * (3 - 2 * t), 0)  # smoothstep falloff
    field = prof_x * prof_y

    # mouth cavity colours (BGR): deep warm shadow, tongue near the bottom
    dark = np.array([22, 18, 34], np.float32)
    tongue = np.array([95, 85, 190], np.float32)

    tmp = tempfile.mkdtemp(prefix="jaw-")
    raw = os.path.join(tmp, "raw.mp4")
    vw = cv2.VideoWriter(raw, cv2.VideoWriter_fourcc(*"mp4v"), FPS, (W, H))
    rng = np.random.default_rng(7)
    sway = cv2.GaussianBlur(rng.normal(0, 1, (len(env) + 60, 1)).astype(np.float32), (1, 61), 12)[:, 0]
    sway = sway / (np.abs(sway).max() + 1e-6)
    pivot = (cx, y0 + a.chin * 3.0)  # neck
    for i, o in enumerate(env):
        d = o * a.drop
        dy = field * d
        src_y = yy - dy
        frame = cv2.remap(img, xx, src_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        # cavity: pixels below the lip line whose source lies above it
        cav = ((yy >= y0) & (src_y < y0) & (dy > 1.0)).astype(np.float32)
        if d > 0.5:
            cav = cv2.GaussianBlur(cav, (0, 0), 1.6)
            depth = np.clip((yy - y0) / max(d, 1), 0, 1)[..., None]
            tw = np.clip((depth - 0.45) / 0.55, 0, 1) ** 1.5  # tongue fills the lower half
            col = dark * (1 - tw) + tongue * tw * 0.85 + dark * tw * 0.15
            frame = frame * (1 - cav[..., None]) + col * cav[..., None]
        # head life: nod with speech, slow sway, gentle push-in
        ang = 1.2 * sway[i] + 0.8 * o
        s = 1.0 + 0.035 * i / max(1, len(env) - 1)
        M = cv2.getRotationMatrix2D(pivot, ang, s)
        M[1, 2] += -1.5 * o
        frame = cv2.warpAffine(frame, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        vw.write(np.clip(frame, 0, 255).astype(np.uint8))
    vw.release()
    vf = "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-i", a.audio, "-map", "0:v", "-map", "1:a",
                    "-vf", vf, "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", "-movflags", "+faststart", a.out], check=True)
    print("[out]", a.out, len(env), "frames")


if __name__ == "__main__":
    main()
