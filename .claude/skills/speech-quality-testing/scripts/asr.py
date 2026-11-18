"""Listen back: transcribe every clip in a manifest with Whisper, so pronunciation can be checked
word by word against the text the app meant to say.

  Hebrew model: ivrit-ai/whisper-large-v3-turbo-ct2 (Whisper fine-tuned on Israeli Hebrew)
  https://huggingface.co/ivrit-ai/whisper-large-v3-turbo-ct2

Audio is decoded with ffmpeg to 16 kHz mono first (no PyAV needed).

  English model: a general Whisper (the Hebrew fine-tune translates English speech into Hebrew),
  e.g. Systran/faster-whisper-small.en  https://huggingface.co/Systran/faster-whisper-small.en

usage: python asr.py WHISPER_HE_DIR manifest.json asr.json [WHISPER_EN_DIR]
"""
import json
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

model_dir, manifest_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]


def load(path: str) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


model = WhisperModel(model_dir, device="cpu", compute_type="int8")
en_model = WhisperModel(sys.argv[4], device="cpu", compute_type="int8") if len(sys.argv) > 4 else None
results = []
for m in json.load(open(manifest_path)):
    lang = "en" if m.get("lang") == "en-US" else "he"
    if lang == "en" and en_model is None:
        print("skip (no English model)", m["id"])
        continue
    asr = en_model if lang == "en" else model
    segments, _ = asr.transcribe(load(m["file"]), language=lang, beam_size=5, condition_on_previous_text=False)
    text = " ".join(s.text.strip() for s in segments)
    results.append({**m, "text": text})
    print(m["variant"], m["id"], "|", text, flush=True)

json.dump(results, open(out_path, "w"), ensure_ascii=False, indent=1)
