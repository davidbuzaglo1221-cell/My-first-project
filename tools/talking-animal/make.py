#!/usr/bin/env python3
"""Free Hebrew talking-character video: image + Hebrew text -> vertical MP4 with lip sync.

Pipeline (all free, no API key):
  1. image   : your own picture, or one generated locally by tools/local-ai/image.sh
  2. voice   : Microsoft neural Hebrew voice via edge-tts (he-IL-AvriNeural / he-IL-HilaNeural)
  3. motion  : official Wan2.2-S2V Hugging Face Space (speech-to-video, free public demo)
  4. finish  : ffmpeg -> 1080x1920, original voice track muxed back in full quality

Usage:
  /home/user/.media-venv/bin/python tools/talking-animal/make.py \
      --image dog.png --text "שלום..." --out out.mp4 [--voice he-IL-HilaNeural] [--rate +8%] [--pitch +4Hz] [--res 480P]
  or --audio voice.mp3 instead of --text to use an existing recording.
Setup once: python3 -m venv /home/user/.media-venv && /home/user/.media-venv/bin/pip install edge-tts gradio_client
"""
import argparse, asyncio, os, shutil, subprocess, sys, tempfile, time

SPACE = "Wan-AI/Wan2.2-S2V"


def tts(text, voice, rate, pitch, out):
    import edge_tts
    asyncio.run(edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(out))


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def s2v(image, audio, res, tries=3):
    from gradio_client import Client, handle_file
    last = None
    for i in range(tries):
        try:
            c = Client(SPACE, verbose=False)
            r = c.predict(ref_img=handle_file(image), audio=handle_file(audio), resolution=res, api_name="/predict")
            return r["video"] if isinstance(r, dict) else r
        except Exception as e:  # queue full / quota / transient
            last = e
            print(f"[s2v] attempt {i + 1} failed: {str(e)[:200]}", file=sys.stderr)
            time.sleep(20 * (i + 1))
    raise SystemExit(f"Wan2.2-S2V Space failed after {tries} tries: {last}")


def finish(video, audio, out):
    vf = ("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
          "setsar=1,fps=30")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", video, "-i", audio, "-map", "0:v:0", "-map", "1:a:0",
                    "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--text")
    g.add_argument("--audio")
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default="he-IL-AvriNeural")
    ap.add_argument("--rate", default="+8%")
    ap.add_argument("--pitch", default="+0Hz")
    ap.add_argument("--res", default="480P", choices=["480P", "720P"])
    a = ap.parse_args()

    work = tempfile.mkdtemp(prefix="talk-")
    audio = a.audio
    if a.text:
        audio = os.path.join(work, "voice.mp3")
        tts(a.text, a.voice, a.rate, a.pitch, audio)
    print(f"[voice] {duration(audio):.1f}s")
    t = time.time()
    raw = s2v(os.path.abspath(a.image), os.path.abspath(audio), a.res)
    shutil.copy(raw, os.path.join(work, "raw.mp4"))
    print(f"[s2v] done in {time.time() - t:.0f}s, raw {duration(raw):.1f}s")
    finish(raw, audio, a.out)
    print(f"[out] {a.out} {duration(a.out):.1f}s")


if __name__ == "__main__":
    main()
