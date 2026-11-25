---
name: sound-library
description: David's local sound-effects library (≈10k real, deduplicated, commercially licensed SFX from SFX Kit, Mixkit, Kenney, Freesound CC0/CC-BY and OpenGameArt CC0) with Hebrew/English natural-language search, filters, previews, automatic sound design for a video (cuts, motion, flashes, beats), and a pro mix engine (layers, beat snap, EQ, fades, ducking, -14 LUFS). Use for ANY video, reel, animation or app that needs sound effects, before reaching for synthesized beeps or a new download.
---

# Sound library

Everything lives in `sound-library/` (CLI: `sound-library/sfx`). Read `sound-library/README.md` for the full reference.

## First, in a fresh container
The audio files are not in git (Mixkit's licence forbids redistribution and the repo is public). The manifest is.
```bash
pip install -q numpy scipy pyloudnorm          # once per container
sound-library/sfx sync                          # restores every file from the manifest (~20-40 min, resumable)
sound-library/sfx stats
```
For a quick job you can sync one source: `sfx sync --source sfxkit --source kenney` (CC0, fast).

## Choose sounds
```bash
sfx search "מעבר קולנועי עמוק" -n 10
sfx search "explosion" --max-dur 3 --loudness loud --quality 3.5
sfx search "נפילת חפץ" --no-attribution          # avoid CC-BY credit lines
sfx info sk:whoosh-fast-hard                        # full record: licence, sync point, loudness
```
Rules: pick from the top results by listening (David's taste: real recorded sounds, never beepy synth); never use the
same sound twice in one video unless it is a deliberate motif; prefer `CC0`/`Mixkit` (no credit) for social posts.
Preview page for David: the "חדר הסאונד" artifact (`sound-library/preview/`, rebuild with `python3 -m sfxlib.preview_build` from `sound-library/`).

## Score a video automatically
```bash
sfx auto clip.mp4 out/clip-sfx.mp4 --preset viral|cinematic|comedy|clean|horror [--music beat.mp3] [--voice vo.wav]
```
Writes `out/clip-sfx.cues.json` (editable) and the mixed video. Then always: watch/listen, edit the cue sheet
(swap sounds, gains, add layers), and re-render with `sfx mix out/clip-sfx.cues.json out/final.mp4`.

## Remotion / HyperFrames
- Remotion: `sfx remotion cues.json reels/<project>` copies the sounds to `public/sfx/` and writes `src/sfx-cues.json`;
  render them with `<SfxTrack cues={cues} />` from `sound-library/remotion/SfxTrack.tsx`. For the final export, prefer
  one mixed file from `sfx mix` (EQ, ducking and loudness happen there).
- HyperFrames: export the files with `sfx export <project>/assets/sfx <ids...>` and place them by the cue times.

## Licences
Every record carries `license`, `license_url`, `author`, `page_url`, `credit`. `sfx mix` writes `*.CREDITS.txt`
when a CC-BY sound is used: put those credits in the post caption or video description. Pixabay is not harvested from
this container (Cloudflare blocks automated access); do not try to get around that.
