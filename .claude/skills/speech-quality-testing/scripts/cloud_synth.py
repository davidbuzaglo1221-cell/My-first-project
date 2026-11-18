"""Synthesize the corpus through the app's own /api/tts route, once per voice, so cloud engines
are compared on exactly the request the app sends (same normalization, same SSML).

Start the app with the engine's key first, for example:
  cd web && GOOGLE_TTS_API_KEY=... npx next dev -p 3200
  cd web && TTS_PROVIDER=azure AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=westeurope npx next dev -p 3201
(locally APP_ACCESS_TOKEN may stay unset; if it is set, pass it with --token)

usage: python cloud_synth.py BASE_URL corpus.json OUT_DIR [--voices all|first] [--token T] [--limit N]
writes OUT_DIR/<voice>/<id>.mp3 and OUT_DIR/manifest.json (engine = provider:voice)
Then: asr.py -> vitest scoring -> audio_metrics.py, exactly as for the local voices.
"""
import argparse
import json
import re
import urllib.request
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("base")
ap.add_argument("corpus")
ap.add_argument("out")
ap.add_argument("--voices", default="first")
ap.add_argument("--token", default="")
ap.add_argument("--limit", type=int, default=0)
a = ap.parse_args()

headers = {"content-type": "application/json", "x-app-token": a.token}


def call(method: str, path: str, body: dict | None = None) -> bytes:
    req = urllib.request.Request(a.base.rstrip("/") + path, method=method, headers=headers, data=json.dumps(body).encode() if body else None)
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read()


info = json.loads(call("GET", "/api/tts"))
if not info.get("provider"):
    raise SystemExit("The app answered provider: null. Start it with a TTS key (see the docstring).")
voices = info["voices"] if a.voices == "all" else [info["voices"][0], next(v for v in info["voices"] if v["gender"] != info["voices"][0]["gender"])]
rows = json.load(open(a.corpus))
if a.limit:
    rows = rows[: a.limit]

out = Path(a.out)
manifest = []
for v in voices:
    folder = out / re.sub(r"[^A-Za-z0-9_-]", "_", v["id"])
    folder.mkdir(parents=True, exist_ok=True)
    for r in rows:
        audio = call("POST", "/api/tts", {"parts": r["parts"], "role": "body", "voice": v["id"]})
        path = folder / (re.sub(r"[^A-Za-z0-9_.-]", "_", r["id"]) + ".mp3")
        path.write_bytes(audio)
        lang = "en-US" if all(p["lang"] == "en-US" for p in r["parts"]) else "he-IL"
        manifest.append({"id": r["id"], "variant": "app", "engine": v["id"], "file": str(path), "lang": lang, "spoken": r["spoken"]})
        print(v["id"], r["id"], len(audio), "bytes", flush=True)
(out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
