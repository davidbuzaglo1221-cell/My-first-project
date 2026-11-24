#!/usr/bin/env bash
# Install (first time) and start Open Generative AI + the official muapi CLI/MCP.
# The app lives OUTSIDE this repo (default /home/user/Open-Generative-AI) so it never touches this project.
# The MuAPI key is never stored here: in the cloud the network proxy injects it for api.muapi.ai;
# on a personal computer export MUAPI_API_KEY before running.
set -euo pipefail
APP_DIR="${OGAI_DIR:-/home/user/Open-Generative-AI}"
PORT="${PORT:-3000}"
LOG_DIR="${APP_DIR}.logs"; mkdir -p "$LOG_DIR"

# 1. muapi CLI (npm binary is missing for linux-x64 in v0.2.7, so use pip in an isolated venv)
if ! command -v muapi >/dev/null 2>&1; then
  python3 -m venv "$HOME/.muapi-venv"
  "$HOME/.muapi-venv/bin/pip" install -q muapi-cli
  ln -sf "$HOME/.muapi-venv/bin/muapi" /usr/local/bin/muapi 2>/dev/null || export PATH="$HOME/.muapi-venv/bin:$PATH"
fi

# 2. App: clone with submodules, setup, production build (only when missing)
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --recurse-submodules https://github.com/Anil-matcha/Open-Generative-AI.git "$APP_DIR"
fi
cd "$APP_DIR"
if [ ! -d node_modules ] || [ ! -d packages/studio/dist ]; then npm run setup > "$LOG_DIR/setup.log" 2>&1; fi
if [ ! -f .next/BUILD_ID ]; then npm run build > "$LOG_DIR/build.log" 2>&1; fi

# 3. Start (NODE_USE_ENV_PROXY lets the Next.js server reach api.muapi.ai through the cloud proxy)
if curl -s -o /dev/null "http://localhost:$PORT/"; then
  echo "Already running: http://localhost:$PORT/studio"; exit 0
fi
NODE_USE_ENV_PROXY=1 PORT="$PORT" nohup npm run start > "$LOG_DIR/server.log" 2>&1 &
for _ in $(seq 1 30); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 1; done
curl -s -o /dev/null -w "Open Generative AI: http://localhost:$PORT/studio (HTTP %{http_code})\n" "http://localhost:$PORT/studio"
