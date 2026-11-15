#!/usr/bin/env bash
# SessionStart hook: makes sure Playwright CLI is available in cloud sessions.
# The playwright-cli skill itself lives in .claude/skills/playwright-cli.
# Pinned to the version that was reviewed; does nothing if already installed.
set -uo pipefail

# Local machines manage their own tools; only act in Claude Code cloud sessions.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

PW_VERSION="0.1.24"
if command -v playwright-cli >/dev/null 2>&1; then
  exit 0
fi
if npm install -g --silent --no-fund --no-audit "@playwright/cli@${PW_VERSION}" >/dev/null 2>&1; then
  echo "playwright-cli ${PW_VERSION} installed"
else
  echo "warning: could not install @playwright/cli@${PW_VERSION}" >&2
fi
exit 0
