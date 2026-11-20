---
name: youtube-transcript
description: Fetch transcripts from YouTube videos for summarization and analysis.
---

# YouTube Transcript

Fetch transcripts from YouTube videos.

## Setup

```bash
cd .claude/skills/youtube-transcript
npm install
```

## Usage

```bash
.claude/skills/youtube-transcript/transcript.js <video-id-or-url>
```

Accepts video ID or full URL:
- `EBw7gsDPAYQ`
- `https://www.youtube.com/watch?v=EBw7gsDPAYQ`
- `https://youtu.be/EBw7gsDPAYQ`

## Output

Timestamped transcript entries:

```
[0:00] All right. So, I got this UniFi Theta
[0:15] I took the camera out, painted it
[1:23] And here's the final result
```

## Notes

- Requires the video to have captions/transcripts available
- Works with auto-generated and manual transcripts

## In this cloud environment (important)

YouTube often bot-blocks this server's IP (the script then fails with
"fetch failed" or "no longer available"; the watch page redirects to
google.com/sorry). Run the script with the proxy env first:

```bash
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node .claude/skills/youtube-transcript/transcript.js <url>
```

If it fails, use the Firecrawl Alexandria provider instead (verified working):

`mcp__Firecrawl__alexandria_library_read` with
`{"provider":"youtube-com","capability":"videos/video_transcript","options":{"url":"<url>"}}`
— optional `language` (e.g. "he", "en") and `translate_to` (e.g. "he").
The result has `full_text` plus timed `segments` (`start_ms`, `text`).
`videos/video_details` lists the available caption languages.

Note: this reads only what is said (captions), not what is shown on screen.
Videos with no captions return `has_transcript: false`.
