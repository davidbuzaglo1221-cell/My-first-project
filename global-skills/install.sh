#!/usr/bin/env bash
# Install David's global skills into ~/.claude/skills so they work in EVERY project on this machine.
#   bash global-skills/install.sh            copy the skills (seconds)
#   bash global-skills/install.sh --engines  also install the free voice engines (~4.5 GB, once per machine)
# On a machine without this repo:
#   git clone -q --depth 1 --filter=blob:none --sparse https://github.com/davidbuzaglo1221-cell/My-first-project.git /tmp/gs \
#     && git -C /tmp/gs sparse-checkout set global-skills && bash /tmp/gs/global-skills/install.sh
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"; DST="$HOME/.claude/skills"; mkdir -p "$DST"
for d in "$SRC"/*/; do
  [ -f "$d/SKILL.md" ] || continue
  n="$(basename "$d")"; rm -rf "${DST:?}/$n"; cp -r "$d" "$DST/$n"; chmod +x "$DST/$n"/scripts/*.sh "$DST/$n"/scripts/*.py 2>/dev/null || true
  echo "installed $n -> $DST/$n"
done
[ "${1:-}" = "--engines" ] && bash "$DST/global-voice-intelligence/scripts/setup.sh"
exit 0
