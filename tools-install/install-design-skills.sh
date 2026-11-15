#!/usr/bin/env bash
# Installs four design tools globally for Claude Code on macOS (~/.claude/skills).
# Safe by design: never overwrites an existing skill, never uses sudo,
# installs only from commits/versions reviewed in advance.
#
#   bash install-design-skills.sh            # install
#   bash install-design-skills.sh --check    # report only, change nothing
#
# "Awesome Design" is intentionally NOT installed (source not confirmed yet).

set -uo pipefail

CHECK_ONLY=0; [[ "${1:-}" == "--check" ]] && CHECK_ONLY=1
SKILLS="$HOME/.claude/skills"
SRC="$HOME/.claude/skill-sources"          # pinned checkouts live here
PW_VERSION="0.1.24"

# name | repo | reviewed commit | folder inside repo
TOOLS=(
  "design-taste-frontend|https://github.com/Leonxlnx/taste-skill|f6b76575f949707b4e3c37cd86cb44b0b98643e8|skills/taste-skill"
  "web-design|https://github.com/xiaopu-ai/web-design|22a4f482cc4caa2394391c0c31ff0aefd1908774|."
  "image-to-code|https://github.com/Leonxlnx/imagegen-skills|beb16b0d0f4dae9a6f5cb04ea41e97b93a54ab8e|skills/image-to-code"
)

ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✘\033[0m %s\n' "$*"; }
REPORT=()

echo "== 1. Compatibility"
[[ "$(uname -s)" == "Darwin" || -n "${ALLOW_NON_MAC:-}" ]] && ok "OS: $(uname -s) $(uname -m)" || { bad "Not macOS"; exit 1; }
command -v git  >/dev/null && ok "git: $(git --version)" || { bad "git missing (xcode-select --install)"; exit 1; }
if command -v node >/dev/null; then
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
  (( NODE_MAJOR >= 18 )) && ok "node: $(node -v)" || { bad "Node >= 18 required (brew install node)"; exit 1; }
else bad "node missing (brew install node)"; exit 1; fi
command -v claude >/dev/null && ok "Claude Code: $(claude --version 2>/dev/null)" || warn "claude CLI not found on PATH (skills still install to ~/.claude/skills)"

echo "== 2. Existing installations"
mkdir -p "$SKILLS"
existing=$(ls -1 "$SKILLS" 2>/dev/null | tr '\n' ' ')
ok "~/.claude/skills contains: ${existing:-<empty>}"
command -v playwright-cli >/dev/null && ok "playwright-cli already installed: $(playwright-cli --version)" || ok "playwright-cli not installed"

skill_name() { awk '/^---/{n++; next} n==1 && /^name:/{sub(/^name:[ ]*/,""); print; exit}' "$1"; }

echo "== 3. Skills from GitHub"
for t in "${TOOLS[@]}"; do
  IFS='|' read -r name repo sha sub <<<"$t"
  dest="$SKILLS/$name"
  if [[ -e "$dest" ]]; then
    warn "$name: already exists at $dest — left untouched"
    REPORT+=("$name|skipped (already existed)"); continue
  fi
  (( CHECK_ONLY )) && { ok "$name: would install from $repo@$sha"; continue; }
  co="$SRC/$(basename "$repo")"
  if [[ ! -d "$co/.git" ]]; then
    git clone -q "$repo" "$co" || { bad "$name: clone failed"; REPORT+=("$name|FAILED (clone)"); continue; }
  fi
  git -C "$co" fetch -q origin 2>/dev/null
  git -C "$co" -c advice.detachedHead=false checkout -q "$sha" || { bad "$name: reviewed commit $sha not found"; REPORT+=("$name|FAILED (commit)"); continue; }
  f="$co/$sub/SKILL.md"
  [[ -f "$f" ]] || { bad "$name: SKILL.md missing"; REPORT+=("$name|FAILED (no SKILL.md)"); continue; }
  [[ "$(skill_name "$f")" == "$name" ]] || { bad "$name: frontmatter name is '$(skill_name "$f")'"; REPORT+=("$name|FAILED (name)"); continue; }
  if cp -R "$co/$sub/." "$dest/" 2>/dev/null || { mkdir -p "$dest" && cp -R "$co/$sub/." "$dest/"; }; then
    rm -rf "$dest/.git"
    ok "$name → $dest ($(wc -l <"$dest/SKILL.md" | tr -d ' ') lines)"; REPORT+=("$name|installed @ ${sha:0:7}")
  else bad "$name: copy failed"; rm -rf "$dest"; REPORT+=("$name|FAILED (copy)"); fi
done

echo "== 4. Playwright CLI $PW_VERSION + skill"
if (( CHECK_ONLY )); then ok "would install @playwright/cli@$PW_VERSION and its skill if missing"
else
  if ! command -v playwright-cli >/dev/null; then
    if npm install -g "@playwright/cli@$PW_VERSION"; then ok "playwright-cli installed"; REPORT+=("playwright-cli (npm)|installed $PW_VERSION")
    else bad "npm global install failed (permissions?). Do NOT use sudo; see report notes."; REPORT+=("playwright-cli (npm)|FAILED"); fi
  else REPORT+=("playwright-cli (npm)|skipped (already installed $(playwright-cli --version))"); fi
  if [[ -e "$SKILLS/playwright-cli" ]]; then
    warn "playwright-cli skill already exists — left untouched"; REPORT+=("playwright-cli (skill)|skipped (already existed)")
  elif command -v playwright-cli >/dev/null; then
    (cd "$HOME" && playwright-cli install --skills -g) && REPORT+=("playwright-cli (skill)|installed") || REPORT+=("playwright-cli (skill)|FAILED")
  fi
fi

echo "== 5. Verification"
for n in design-taste-frontend web-design image-to-code playwright-cli; do
  f="$SKILLS/$n/SKILL.md"
  if [[ -f "$f" && "$(skill_name "$f")" == "$n" ]]; then ok "$n: present, name matches"
  elif [[ -e "$SKILLS/$n" ]]; then warn "$n: a folder with this name already existed (your own) — check it manually"
  else bad "$n: not found"; fi
done
command -v playwright-cli >/dev/null && ok "playwright-cli on PATH: $(command -v playwright-cli)"

echo "== Report"
for r in "${REPORT[@]}"; do IFS='|' read -r a b <<<"$r"; printf '  %-24s %s\n' "$a" "$b"; done
echo "  awesome-design-md        NOT installed (awaiting your confirmation)"
echo
echo "Restart Claude Code, then type /skills to see them."
