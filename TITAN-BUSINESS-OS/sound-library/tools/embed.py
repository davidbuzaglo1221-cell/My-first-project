"""CLAP embeddings for the studio library (semantic text->sound search), reusing sfx-finder's model code.

Run with the sfx-finder venv:  .claude/skills/sfx-finder/.venv/bin/python embed.py build
  build          embed every sound in index.json that has no vector yet (incremental), save embeddings.npz
  query "text"   print {id: cosine} for all embedded sounds (used by sfxlib.py search --semantic)
"""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPO = ROOT.parent.parent
sys.path.insert(0, str(REPO / ".claude/skills/sfx-finder/scripts"))
import clap_utils  # noqa: E402

EMB = ROOT / "embeddings.npz"


def load():
    if EMB.exists():
        d = np.load(EMB, allow_pickle=False)
        return list(d["ids"]), d["vecs"]
    return [], np.zeros((0, 512), np.float32)


def build():
    idx = json.loads((ROOT / "index.json").read_text())
    ids, vecs = load()
    have = set(ids)
    todo = [s for s in idx["sounds"] if s["id"] not in have and (ROOT / s["file"]).exists()]
    new_ids, new_vecs = [], []
    for i in range(0, len(todo), 8):
        batch = todo[i:i + 8]
        wav = [clap_utils.load_audio(ROOT / s["file"]) for s in batch]
        new_vecs.append(clap_utils.embed_audio_batch(wav))
        new_ids += [s["id"] for s in batch]
        print(f"embedded {len(new_ids)}/{len(todo)}", file=sys.stderr)
    if new_ids:
        vecs = np.concatenate([vecs] + new_vecs) if len(ids) else np.concatenate(new_vecs)
        ids = ids + new_ids
    np.savez_compressed(EMB, ids=np.array(ids), vecs=vecs.astype(np.float16))
    print(json.dumps({"embedded_total": len(ids), "new": len(new_ids)}))


def query(text):
    ids, vecs = load()
    q = clap_utils.embed_text(text)
    sims = vecs.astype(np.float32) @ q
    print(json.dumps({i: round(float(s), 4) for i, s in zip(ids, sims)}))


if __name__ == "__main__":
    {"build": lambda: build(), "query": lambda: query(sys.argv[2])}[sys.argv[1]]()
