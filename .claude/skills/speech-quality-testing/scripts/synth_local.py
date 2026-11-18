"""Synthesize the speech corpus with open, offline voices, so speech can be heard and measured
without any cloud key.

  Hebrew:  Phonikud (diacritics + stress, ONNX) -> phonemes -> Piper voice "shaul"
           https://huggingface.co/Phonikud/phonikud-onnx
           https://huggingface.co/Phonikud/phonikud-tts-checkpoints
  English: Piper en_US-lessac-medium   https://huggingface.co/rhasspy/piper-voices

Two variants per sentence:
  raw  the sentence exactly as written, read by the voice of its main language (what you get
       with no text preparation)
  app  the parts the app sends (normalized, split by language), joined with a short breath

usage: python synth_local.py MODELS_DIR corpus.json OUT_DIR [--only-raw-diff]
writes OUT_DIR/<variant>/<id>.wav and OUT_DIR/manifest.json
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from phonikud import phonemize
from phonikud_onnx import Phonikud
from piper_onnx import Piper

models, corpus_path, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
only_diff = "--only-raw-diff" in sys.argv

nakdan = Phonikud(str(models / "phonikud-1.0.int8.onnx"))
he_voice = Piper(str(models / "shaul.onnx"), str(models / "model.config.json"))
en_voice = Piper(str(models / "en_US-lessac-medium.onnx"), str(models / "en_US-lessac-medium.onnx.json"))
SR = 22050


def say(text: str, lang: str) -> np.ndarray:
    if lang == "en-US":
        samples, sr = en_voice.create(text)
    else:
        samples, sr = he_voice.create(phonemize(nakdan.add_diacritics(text)), is_phonemes=True)
    assert sr == SR, sr
    return samples.astype(np.float32)


def breath(ms: int) -> np.ndarray:
    return np.zeros(int(SR * ms / 1000), np.float32)


def main_lang(text: str) -> str:
    he = len([w for w in text.split() if re.search("[א-ת]", w)])
    en = len([w for w in text.split() if re.search("[A-Za-z]", w) and not re.search("[א-ת]", w)])
    return "en-US" if en > he else "he-IL"


rows = json.loads(corpus_path.read_text())
manifest = []
for variant in ("raw", "app"):
    (out / variant).mkdir(parents=True, exist_ok=True)
for r in rows:
    safe = re.sub(r"[^A-Za-z0-9_.-]", "_", r["id"])
    spoken_differs = r["raw"].strip() != r["spoken"].strip()
    for variant in ("raw", "app"):
        if variant == "raw" and only_diff and not spoken_differs:
            continue
        if variant == "raw":
            audio = say(r["raw"], main_lang(r["raw"]))
        else:
            chunks = []
            for p in r["parts"]:
                chunks += [say(p["text"], p["lang"]), breath(120)]
            audio = np.concatenate(chunks[:-1])
        path = out / variant / f"{safe}.wav"
        sf.write(path, audio, SR)
        manifest.append({"id": r["id"], "variant": variant, "engine": "local-piper", "file": str(path), "lang": main_lang(r["raw"]), "seconds": round(len(audio) / SR, 2)})
        print(variant, r["id"], manifest[-1]["seconds"], flush=True)

(out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
