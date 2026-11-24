---
name: ai-video-studio
description: David's multi-engine AI viral video studio ("ויראל סטודיו", in studio/): talking fruit and animals, 3D/Pixar-like/realistic characters, dialogues between saved characters, lip sync. Use when David wants a video made by AI video engines (Vaideo, AITuber, Korpi, Dreamina Seedance) from one idea, wants to compare engines, check credits or connections, or asks for the free/paid status of a video service. Plans the script, routes to the right engine (free first), generates in parallel, edits and exports MP4 9:16/16:9/1:1.
---

# AI video studio (studio/)

Read `studio/README.md` and `studio/ENGINES.md` first. Then:

1. **Check connections**: `cd studio && npm run check`. Never claim an engine works without this.
2. **Characters**: saved in `studio/data/characters.json` with a reference image. Reuse them (`--cast <id>` via the UI or the `cast` field). Never present a generated image as a real person.
3. **Plan**: write the plan yourself when the idea deserves it (better than the offline template planner):
   a JSON file `{ "scenes": [{ "role": "hook|setup|turn|escalate|twist|payoff|cta", "speaker": "<character id or narrator>", "speakerName": "...", "voice": "<voice key>", "narration": "...", "caption": "...", "visual": "English prompt incl. every character description", "durationSec": 2.5 }], "enginePrompt": "..." }`.
   Follow `fast-video`, `david-brand`, `art-direction`. David's words are the brief, never the copy.
4. **Quote**: `node cli.mjs quote "<idea>" --len 30 --aspect 9:16 --style auto [--cast id1,id2] [--lipsync]` shows free/paid per engine.
5. **Make**: `NODE_USE_ENV_PROXY=1 node cli.mjs make "<idea>" --engines auto [--plan plan.json]`.
   - Exit code 2 + `needsApproval` = a paid engine. **Stop and ask David in Hebrew** with the exact amount (AskUserQuestion). Only after a yes: `--approve <engine>=<amount>`.
   - Never pass `--approve` on your own judgement. Never spend money to "test".
6. **Verify** the output with ffprobe (`lib/media.mjs probe`) and look at 2–3 frames before showing David. Send the MP4 with SendUserFile.
7. **Label honestly**: the local engine is programmed animation, not generative AI.
8. Commit `studio/data/ledger.json` and `history.json` so the next session knows the credits already spent.

Keys: never in chat or in the repo. In the cloud session, ask with `request_credential` (host: app2.vaideo.org, app.aituber.app + mcp.aituber.app, backend.korpi.ai, ark.ap-southeast.bytepluses.com).

## Chat-only engines
Canva (`mcp__Canva__create-video`, `generate-image`) can also generate, from chat only: it uses David's Canva AI limit and needs his explicit OK per video. Its limit was used up on 24.11.2026.

## Resume
A job cut off by a restart is marked interrupted; `POST /api/jobs/<id>/resume` (UI: המשך מאיפה שנעצר) re-polls remote work by its saved id — it never creates or pays twice.
