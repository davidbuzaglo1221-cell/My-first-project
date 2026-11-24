# Korpi AI — MCP integration (verified 24.11.2026)

Server: `https://backend.korpi.ai/mcp` (KorpiAI MCP 0.2.0, 37 tools). Auth: OAuth device flow
on David's regular Korpi account. Scopes granted: generate/read only — **no `social:post`, no
`automation:manage`** (cannot post or schedule on his behalf).

## How it is wired
- `.mcp.json` (project) → `korpi`, auth header from `headers.sh`, which reads `~/.korpi/oauth.json`
  (mode 600, outside the repo, valid 1 year, lost when the container is replaced).
- Local scope (`claude mcp add -s local korpi … --header`) is what actually connects in a cloud
  container, because a project `headersHelper` needs the interactive workspace-trust dialog.
- Environment `My-first-project korpi` allows korpi.ai, backend.korpi.ai, storage.korpi.ai.
  The old environment `My-first-project media` holds a **broken** network secret for
  backend.korpi.ai that overwrites any Authorization header — don't run Korpi from it until that
  secret is deleted.
- Durable fix for every future session: add `https://backend.korpi.ai/mcp` as a custom connector
  in claude.ai → Settings → Connectors (OAuth, one approval).

## Re-auth (new container)
Register client (`POST /oauth/register`), `POST /oauth/device/code`, David opens
`verification_uri_complete`, poll `POST /oauth/token` **with curl** (Cloudflare blocks Python's
urllib UA: error 1010). Save the token response to `~/.korpi/oauth.json`, never print it.

## Video request → file
1. `account_status` (balance) → tell David the cost before any paid call.
2. `create_niche_video` {prompt: a brief, niche: "story-studio" unless an exact template fits}
   — needs a paid plan + credits.
3. Poll `get_niche_video_status` (waitSeconds 55) until `complete` (5–20 min).
4. Download `downloadUrl` (storage.korpi.ai, public mp4, 1080×1920) and check it with ffprobe.

## Costs (live, 24.11.2026)
Free: `write_script`, `plan_storyboard` (~30/h, 100/day), all list/read tools.
Paid: everything that generates. Free account: image models — even "free" flux — return
"Premium subscription or additional credits required". Video clips 41–277 credits per 5 s;
grok-imagine-included = 0 on a paid plan, 12–18 credits on a free account (welcome-trial
credits can't pay). David's account: free, 7 credits → no generation possible today.
