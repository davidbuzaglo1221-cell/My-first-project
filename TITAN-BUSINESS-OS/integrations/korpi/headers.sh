#!/bin/sh
# Prints the Authorization header for the Korpi MCP server from a token kept
# outside the repo (~/.korpi/oauth.json, mode 600). Prints {} if absent, so the
# environment's network proxy (or Claude Code's own OAuth) supplies auth instead.
F="${KORPI_OAUTH_FILE:-$HOME/.korpi/oauth.json}"
if [ -r "$F" ]; then
  python3 -I -c 'import json,sys;t=json.load(open(sys.argv[1]))["access_token"];print(json.dumps({"Authorization":"Bearer "+t}))' "$F" 2>/dev/null || echo '{}'
else
  echo '{}'
fi
