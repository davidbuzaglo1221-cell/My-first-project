#!/usr/bin/env bash
# Brings a fresh cloud session to a working sound studio. Idempotent: run it at the start of any video job.
#   bash TITAN-BUSINESS-OS/sound-library/tools/setup.sh          # everything (CLAP/torch ~6 GB, a few minutes)
#   bash TITAN-BUSINESS-OS/sound-library/tools/setup.sh --light  # no torch: keyword search, fetch, pick, mix still work
set -u
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
SK="$REPO/.claude/skills"
LIB="$REPO/TITAN-BUSINESS-OS/sound-library"
say(){ printf '[sound-setup] %s\n' "$*"; }

command -v ffmpeg >/dev/null || { say "installing ffmpeg"; apt-get install -y -q ffmpeg >/dev/null; }
[ -e /usr/lib/x86_64-linux-gnu/libEGL.so.1 ] || { say "installing libEGL (AskEditor face/QC)"; apt-get install -y -q libegl1 libgles2 >/dev/null 2>&1 || (apt-get update -q >/dev/null && apt-get install -y -q libegl1 libgles2 >/dev/null); }

# sfx-finder venv: numpy/scipy/librosa for mix.py, + torch/transformers for CLAP semantic search
PY=python3.12; command -v $PY >/dev/null || PY=python3
if [ ! -x "$SK/sfx-finder/.venv/bin/python" ]; then say "creating sfx-finder venv"; $PY -m venv "$SK/sfx-finder/.venv"; fi
V="$SK/sfx-finder/.venv/bin"
$V/python -c "import librosa, scipy, matplotlib, requests" 2>/dev/null || { say "installing audio packages"; $V/pip install -q -r "$SK/sfx-finder/requirements.txt" scipy matplotlib pytest; }
if [ "${1:-}" != "--light" ]; then
  $V/python -c "import torch" 2>/dev/null || { say "installing torch (PyPI; the CPU-only index is blocked by this network)"; $V/pip install -q torch; }
fi
mkdir -p ~/.sfx-finder
[ -f ~/.sfx-finder/config.json ] || printf '{"library_dir": "%s"}\n' "$LIB/sfx" > ~/.sfx-finder/config.json

# AskEditor video-editing pack: its own venv + models (prints READY)
(cd "$SK/video-editing" && bash setup.sh | tail -1)

# restore cache-only sounds (Mixkit: usable in videos, not redistributable, so never committed)
python3 "$LIB/tools/sfxlib.py" ensure
python3 "$LIB/tools/sfxlib.py" stats > /tmp/sfx-stats.txt && head -2 /tmp/sfx-stats.txt
say "READY"
