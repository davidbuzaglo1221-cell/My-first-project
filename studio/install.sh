#!/usr/bin/env bash
# Creative Studio installer.
# Installs the creative-director brain and the curated skill set into ~/.claude,
# so they apply to every project and every session. Idempotent: rerun any time.
#
#   bash studio/install.sh            install or refresh everything
#   bash studio/install.sh --verify   only check what is installed
#
# Every source is pinned to the exact commit that was inspected before install.
# To upgrade: bump a SHA below, review the diff of that repo, rerun.

set -uo pipefail

STUDIO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CH="$HOME/.claude"
SK="$CH/skills"
MARK_BEGIN="<!-- creative-studio:begin -->"
MARK_END="<!-- creative-studio:end -->"

# ---- Pinned sources ---------------------------------------------------------
ANTHROPIC_SHA=1780c5e5a552fd4d1c9d6a7b0cab26b0c2bef064     # anthropics/skills
VERCEL_SHA=1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62        # vercel-labs/agent-skills
EMIL_SHA=64eb3deb9a5fbfa041faf783e0bc3fd635872e9c          # emilkowalski/skills
VIDEO_SHA=5187e6da83bd13106a0a024e3d603d71032c66bc         # adamperlis/video-skills
SUPER_SHA=22f0b463e7a5e579904dd6211a520321035526f7         # obra/superpowers
TASTE_SHA=f6b76575f949707b4e3c37cd86cb44b0b98643e8         # Leonxlnx/taste-skill
IMPECCABLE_SHA=d41d9860b0094dcb68030657da63461212835aaa    # pbakaus/impeccable (v4.9.2)
UIPRO_VERSION=2.15.0                                        # npm: ui-ux-pro-max-cli

EMIL_SKILLS="animate animate-expo animation-performance animation-vocabulary apple-design ask-emil
  ask-sonner break-ui choreograph emil-design-eng find-animation-opportunities gestures
  improve-animations learn-taste mobile-native pick-ui-library prototype remove-animations review-animations"
VIDEO_SKILLS="brand-film brand-grid-video creator-video feature-video narrated-product-film
  silent-product-demo social-video-hooks ui-component-clip ui-tutorial-video video-brand-system
  video-thumbnails walkie-voiceover"
SUPER_SKILLS="brainstorming writing-plans executing-plans verification-before-completion
  systematic-debugging requesting-code-review test-driven-development subagent-driven-development
  using-git-worktrees finishing-a-development-branch"
UIPRO_SKILLS="ui-ux-pro-max design design-system brand banner-design slides ui-styling"
LOCAL_SKILLS="$(ls "$STUDIO/skills" 2>/dev/null)"

ALL_SKILLS="canvas-design web-design-guidelines $EMIL_SKILLS $VIDEO_SKILLS $SUPER_SKILLS
  design-taste-frontend impeccable $UIPRO_SKILLS $LOCAL_SKILLS"
IMPECCABLE_AGENTS="impeccable-asset-producer impeccable-documenter impeccable-finish-reviewer
  impeccable-manual-edit-applier impeccable-motion-reviewer"
HOOK_CMD='[ ! -f "$HOME/.claude/skills/impeccable/scripts/impeccable" ] || "$HOME/.claude/skills/impeccable/scripts/impeccable" hook'

log()  { printf '  %s\n' "$*"; }
warn() { printf '  ! %s\n' "$*" >&2; FAILED=$((FAILED+1)); }
FAILED=0

# ---- Verification -----------------------------------------------------------
verify() {
  local ok=0 bad=0
  for s in $ALL_SKILLS; do
    if [ -f "$SK/$s/SKILL.md" ] && grep -q "^name: *\"\?$s\"\?\s*$" "$SK/$s/SKILL.md"; then ok=$((ok+1))
    else echo "  MISSING skill: $s"; bad=$((bad+1)); fi
  done
  for a in $IMPECCABLE_AGENTS; do [ -f "$CH/agents/$a.md" ] || { echo "  MISSING agent: $a"; bad=$((bad+1)); }; done
  grep -qF "$MARK_BEGIN" "$CH/CLAUDE.md" 2>/dev/null || { echo "  MISSING creative brain in $CH/CLAUDE.md"; bad=$((bad+1)); }
  grep -q 'skills/impeccable/scripts/impeccable' "$CH/settings.json" 2>/dev/null || { echo "  MISSING impeccable design hook"; bad=$((bad+1)); }
  ls "$HOME"/.impeccable/bin/*/impeccable >/dev/null 2>&1 || echo "  note: impeccable engine not cached yet (downloads on first use)"
  find "$CH/plugins" -path '*skills/frontend-design/SKILL.md' 2>/dev/null | grep -q . \
    || [ -f "$SK/frontend-design/SKILL.md" ] || echo "  note: frontend-design not found (plugin not synced yet?)"
  echo "  skills ok: $ok   problems: $bad"
  return $bad
}
if [ "${1:-}" = "--verify" ]; then verify; exit $?; fi

# ---- Helpers ----------------------------------------------------------------
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
mkdir -p "$SK" "$CH/agents"

fetch() { # dir owner/repo sha
  local d="$WORK/$1"
  git init -q "$d" && git -C "$d" fetch -q --depth 1 "https://github.com/$2.git" "$3" \
    && git -C "$d" -c advice.detachedHead=false checkout -q FETCH_HEAD
}
put() { # src-dir dest-name
  if [ -f "$1/SKILL.md" ]; then rm -rf "$SK/$2"; cp -R "$1" "$SK/$2"; else warn "no SKILL.md in $1"; fi
}

echo "Creative Studio: installing into $CH"

# Anthropic: canvas-design. (frontend-design is already provided by the
# frontend-design plugin, byte-identical, so it is not installed twice.)
if fetch anthropic anthropics/skills "$ANTHROPIC_SHA"; then put "$WORK/anthropic/skills/canvas-design" canvas-design; log "anthropics/skills ok"
else warn "anthropics/skills fetch failed"; fi

if fetch vercel vercel-labs/agent-skills "$VERCEL_SHA"; then put "$WORK/vercel/skills/web-design-guidelines" web-design-guidelines; log "vercel-labs/agent-skills ok"
else warn "vercel-labs/agent-skills fetch failed"; fi

if fetch emil emilkowalski/skills "$EMIL_SHA"; then for s in $EMIL_SKILLS; do put "$WORK/emil/skills/$s" "$s"; done; log "emilkowalski/skills ok"
else warn "emilkowalski/skills fetch failed"; fi

if fetch video adamperlis/video-skills "$VIDEO_SHA"; then for s in $VIDEO_SKILLS; do put "$WORK/video/skills/$s" "$s"; done; log "adamperlis/video-skills ok"
else warn "adamperlis/video-skills fetch failed"; fi

if fetch super obra/superpowers "$SUPER_SHA"; then for s in $SUPER_SKILLS; do put "$WORK/super/skills/$s" "$s"; done; log "obra/superpowers ok"
else warn "obra/superpowers fetch failed"; fi

if fetch taste Leonxlnx/taste-skill "$TASTE_SHA"; then put "$WORK/taste/skills/taste-skill" design-taste-frontend; log "Leonxlnx/taste-skill ok"
else warn "Leonxlnx/taste-skill fetch failed"; fi

# Impeccable: the repo's committed Claude Code build (its documented manual
# install), its agents, the checksum-verified engine, and the global design hook.
if fetch impeccable pbakaus/impeccable "$IMPECCABLE_SHA"; then
  put "$WORK/impeccable/.claude/skills/impeccable" impeccable
  for a in $IMPECCABLE_AGENTS; do cp "$WORK/impeccable/.claude/agents/$a.md" "$CH/agents/"; done
  ( cd "$WORK" && "$SK/impeccable/scripts/impeccable" --version >/dev/null 2>&1 ) || warn "impeccable engine download failed (it retries on first use)"
  node - "$CH/settings.json" "$HOOK_CMD" <<'NODE' || warn "could not write the impeccable hook into settings.json"
const fs = require('fs'); const [p, cmd] = process.argv.slice(2);
let s = {};
if (fs.existsSync(p)) { try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { console.error(p + ' is not valid JSON; left untouched'); process.exit(1); } }
s.hooks = s.hooks || {};
const add = (ev, matcher, timeout, statusMessage) => {
  const keep = (s.hooks[ev] || []).filter(g => !JSON.stringify(g).includes('skills/impeccable/scripts/impeccable'));
  const g = { hooks: [{ type: 'command', command: cmd, timeout, statusMessage }] };
  if (matcher) g.matcher = matcher;
  s.hooks[ev] = [...keep, g];
};
add('SessionStart', null, 5, 'Preparing build session');
add('PostToolUse', 'Edit|Write', 5, 'Checking UI changes');
add('Stop', null, 30, 'Design deep pass');
fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
NODE
  log "pbakaus/impeccable ok"
else warn "pbakaus/impeccable fetch failed"; fi

# UI UX Pro Max: its official CLI, pinned.
if ( cd "$WORK" && npx --yes -p "ui-ux-pro-max-cli@$UIPRO_VERSION" uipro init --ai claude --global >/dev/null 2>&1 ); then log "ui-ux-pro-max ok"
else warn "ui-ux-pro-max CLI install failed"; fi

# Studio's own skills.
for s in $LOCAL_SKILLS; do put "$STUDIO/skills/$s" "$s"; done

# Creative brain: replace only the studio block inside ~/.claude/CLAUDE.md,
# keeping anything else the file holds.
touch "$CH/CLAUDE.md"
node - "$CH/CLAUDE.md" "$STUDIO/CLAUDE.md" "$MARK_BEGIN" "$MARK_END" <<'NODE' || warn "could not update CLAUDE.md"
const fs = require('fs'); const [dst, src, b, e] = process.argv.slice(2);
const cur = fs.readFileSync(dst, 'utf8'); const block = b + '\n' + fs.readFileSync(src, 'utf8').trim() + '\n' + e;
const i = cur.indexOf(b), j = cur.indexOf(e);
const out = (i >= 0 && j > i) ? cur.slice(0, i) + block + cur.slice(j + e.length) : (cur.trim() ? cur.trimEnd() + '\n\n' : '') + block + '\n';
fs.writeFileSync(dst, out);
NODE

echo "Verifying"
verify; v=$?
[ $FAILED -eq 0 ] && [ $v -eq 0 ] && echo "Creative Studio: done." || echo "Creative Studio: finished with $FAILED install warning(s), $v verify problem(s)."
exit 0
