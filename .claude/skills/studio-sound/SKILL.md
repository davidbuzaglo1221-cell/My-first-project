---
name: studio-sound
description: David's professional edit-and-sound pipeline for every video he asks to create or edit - analyse the footage and the wanted style, write an edit plan, find the right sounds in the permanent studio library (TITAN-BUSINESS-OS/sound-library, searchable by text, category, character and CLAP meaning), fetch missing ones from Freesound/Openverse into the library, place each sound frame-accurately (start/peak/end alignment), mix music under voice with ducking to -14 LUFS, prove sync and loudness, and run AskEditor's qc-check. Use with fast-video and director for any reel, promo, edit, sound design, SFX, whoosh, transition, beat-sync or "make it sound professional" request.
---

# Studio sound: the automatic edit-and-sound pipeline

Read with `fast-video` (pace, captions, hook) and `art-direction` (look). This skill owns **sound** and the
**edit plan → QC** loop. Everything is measured; Claude cannot hear, so never write "it sounds good".

## 0. Session setup (fresh container)
`bash TITAN-BUSINESS-OS/sound-library/tools/setup.sh` (add `--light` to skip torch: no semantic search).
Ends with `READY`. It rebuilds the venvs, the AskEditor models and restores cache-only sounds.

## The toolbox (installed skills)
| Need | Use |
|---|---|
| Find / fetch / pick sounds | `TITAN-BUSINESS-OS/sound-library/tools/sfxlib.py` (this skill) |
| Semantic or "sounds like this clip" search | `sfx-finder` (CLAP) and `sfxlib.py search --semantic` |
| Frame-accurate placement + mix + loudness | `tools/mix.py plan.json` (run with `.claude/skills/sfx-finder/.venv/bin/python`) |
| Sync proof | `tools/qc_sync.py <out dir>` |
| Beat grid checked against the kick drums, cue-type grammar | `sound-effects` (motion-graphics) |
| Talking-head edit: clean cut, captions, punch-in, grade, B-roll, transitions, music bed, QC | `video-editing` (AskEditor; English speech only) |
| Motion-graphic B-roll, promos, explainers, subject cut-outs | `motion-broll`, `explainer-*`, `object-separation` |
| Hebrew kinetic captions, compositions | `remotion-*`, `hyperframes*` |

## 1. Analyse
- `ffprobe` duration/fps/size; contact sheet every 0.5 s; for speech, word timings (AskEditor `fx.run words` for English, `remotion-captions`/whisper for Hebrew).
- Write down the goal (clients / views / laughs / trust), the energy, the look, and every **moment** that deserves sound:
  cuts, moves, appear/disappear, hits, reveals, text pops, on-screen actions (scissors, clipper, camera, steps).

## 2. Edit plan (`plan.json` next to the project)
One cue per moment: `{"t": seconds, "cue" or "category", "query", "mood", "align", "gain_db", "dur", "fade", "pan", "label"}`.
- `cue` types (taxonomy.py `CUE_TYPES`): scene_cut, movement, zoom_in, appear, click, typing, build_up, reveal, drop,
  hit, success, error_or_tech, photo, walk, premium, bed, tension_bed, barber, boom, tick, logo.
- `align`: `start` (on the frame), `peak` (whooshes: loudest point on the cut), `end` (risers/reverses end on the hit).
- Snap big moves to the music grid (beat B = 60/BPM; check kicks under 120 Hz like `sound-effects` step 3).
- Layer, don't stack: a reveal = impact + sub; a cut = one whoosh; a bed under a scene; at most 3 sounds at once.
- **Variety is mandatory**: `pick` penalises sounds already used in this video and in recent videos (`usage.json`).
  Never pin the same three sounds into every video; pin an `id` only when one take is clearly right for the scene.
- Music: `{"file", "offset" (a track beat), "start", "gain_db", "automation": [{t0,t1,lowpass,gain_db}], "fade_out", "source", "license"}`.
  With a voice: `"voice": {"file", "duck_db": -10}` and the music ducks under it automatically.

## 3–4. Find and fetch
```
python3 TITAN-BUSINESS-OS/sound-library/tools/sfxlib.py search "deep cinematic boom" --category bass-hit --max-dur 3
python3 TITAN-BUSINESS-OS/sound-library/tools/sfxlib.py search "metal snap" --semantic
python3 TITAN-BUSINESS-OS/sound-library/tools/sfxlib.py fetch "zipper close" --category foley --n 8   # Freesound API
```
- If a category is thin or nothing fits, **fetch** before settling. Without a Freesound key `fetch` exits 3 with
  `FREESOUND_KEY_MISSING`; then use Openverse through Firecrawl (`openverse-org/audio-assets/search_audio`, licence cc0,
  source freesound), export rows to TSV with the workspace `jq`, and `sfxlib.py import-tsv file.tsv`.
- Every download is processed (silence trim, length cap, -3 dBFS peak or -30 LUFS for beds, OGG 48 kHz), de-duplicated
  (source id, raw hash, audio fingerprint) and indexed with name, category, tags, description, mood, source, licence.
  Already-indexed sounds are never downloaded again. CC0/CC-BY go to `sfx/` (committed); Mixkit-type licences go to
  `.cache/` (gitignored, restored by `ensure`). NC licences are refused.
- After adding sounds: `.claude/skills/sfx-finder/.venv/bin/python TITAN-BUSINESS-OS/sound-library/tools/embed.py build`.

## 5–6. Place, mix, prove
```
.claude/skills/sfx-finder/.venv/bin/python TITAN-BUSINESS-OS/sound-library/tools/mix.py path/plan.json
.claude/skills/sfx-finder/.venv/bin/python TITAN-BUSINESS-OS/sound-library/tools/qc_sync.py path/out
cd .claude/skills/video-editing && .venv/bin/python -m fx.run qc-check "/abs/out.mp4" --opt platform=tiktok
```
mix.py snaps cues to frames, places by alignment, ducks, normalises (two-pass loudnorm, -14 LUFS / -1.5 dBTP) and
measures the **exported MP4** (stereo and mono). It writes SOUND.md (cue → sound → licence table), CREDITS.txt,
cues.resolved.json and stems. qc_sync must say PASS (every onset within one frame). qc-check must say PASS; read
every FAIL and fix it (it caught a stuck white flash and black frames in the demo). Then look at frames around each
risky moment and give David 3–5 timestamps to check with headphones.

## 7. Deliver
The MP4, a cover frame, SOUND.md summary in Hebrew (how many cues, how many different sounds, loudness), CREDITS.txt
when any sound needs credit, and the music licence. Then commit new library sounds + index + usage.json.

## Rules
- Real recorded sounds only (David: no computer beeps). AskEditor's `sounds/` are synthesised: don't use them for David.
- Licences: CC0 / CC-BY (credit) / Mixkit SFX licence (use in video, never redistribute). Never NC, never rips.
- Voice > SFX > music. Music sits about -12 dB under SFX peaks; ducks 8-12 dB under voice.
- Demo: `reels/sfx-demo/` (plan.json, index.html, render.mjs) is the reference implementation.
