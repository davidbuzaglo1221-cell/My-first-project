# Sound library

A local, deduplicated library of real sound effects for video editing, with natural-language search (Hebrew and
English), filters, a preview browser, automatic sound design for a video, and a professional mix engine.

Free sources only, each with a licence that allows commercial use:

| Source | What | Licence | In git? |
|---|---|---|---|
| [SFX Kit](https://github.com/wyzowl/sfx-kit) | all 320, with sync points and use notes | CC0 | manifest only |
| [Mixkit](https://mixkit.co/free-sound-effects/) | every sound reachable from its 279 categories and their tags | Mixkit Sound Effects Free License (commercial OK, no credit, no redistribution) | manifest only |
| [Kenney](https://kenney.nl/assets/category:Audio) | all 10 audio packs (impacts, UI, sci-fi, RPG, casino, digital, jingles, 2 voiceover packs) | CC0 | manifest only |
| [Freesound](https://freesound.org) | per-category searches, CC0 and CC-BY only (NC and Sampling+ rejected), rating/downloads quality gate, 0.2–30 s | CC0 / CC-BY (credit) | manifest only |
| [OpenGameArt](https://opengameart.org) | CC0 sound-effect packs | CC0 | manifest only |
| Pixabay | not harvested: its site blocks automated access from this environment (Cloudflare) | — | — |

The sound-finding scripts come from [sxhzju/sfx](https://github.com/sxhzju/sfx) (MIT), installed as the
`sfx-sources` skill; this library builds on them with crawling, analysis, dedupe and indexing.

Audio files are gitignored (`audio/`, `cache/`): the repo is public and Mixkit forbids redistribution. Everything
needed to rebuild the library exactly is in `data/manifest.jsonl`; `./sfx sync` restores it in a fresh container.

## Commands

```bash
pip install -q numpy scipy pyloudnorm
./sfx harvest                       # discover sounds on all sources (metadata only)
./sfx sync                          # download + analyse + dedupe + index (resumable, restores missing files)
./sfx stats                         # counts by source, category, licence; hours; size
./sfx search "צליל של מעבר קולנועי עמוק"
./sfx search "explosion" --max-dur 3 --loudness loud --style cinematic --quality 3.5 --no-attribution
./sfx info mk:1492
./sfx export reels/my-reel/public/sfx mk:1492 sk:boom-sub-drop --format wav   # + SOUND_LICENSES.tsv
./sfx auto clip.mp4 out/clip.mp4 --preset viral --music beat.mp3 --voice vo.wav
./sfx mix out/clip.cues.json out/final.mp4
./sfx remotion out/clip.cues.json reels/my-reel
python3 -m sfxlib.preview_build     # rebuild the preview browser (preview/dist)
python3 -m pytest -q tests
```

## What is stored per sound

Source and id, title, description, tags, the page it came from, licence name and URL, whether attribution is
required and the ready-made credit line, author, sha256, format, sample rate, channels, duration, integrated LUFS,
max 150 ms loudness, peak, crest factor, spectral centroid (brightness), low-end share (bassiness), onset, attack,
peak time (sync point), noise floor, clipping ratio, quality 1–5, length class (micro <0.5 s, short <2, medium <6,
long <20, bed), loudness class (soft/medium/loud), tone (dark/mid/bright), styles (cinematic, cartoon, realistic,
electronic, retro, dark, bright, soft, hard), categories (up to 4 of 39), a 64-point waveform and an acoustic
fingerprint.

## No duplicates

1. Harvest keys every sound by source id, so a sound found under ten Mixkit tags is one record.
2. Identical files (sha256) are kept once.
3. The same audio re-encoded or re-uploaded elsewhere (e.g. a Mixkit sound on Freesound) is caught by an acoustic
   fingerprint (log envelope + spectral shape, correlation > 0.985 at near-equal length and loudness). The best copy
   is kept (quality, then source), the others point to it with `duplicate_of` and are never shown or downloaded again.

## Search

`sfxlib/search.py` and `preview/index.html` run the same algorithm: the query becomes weighted English terms (a
Hebrew dictionary of ~400 entries with prefix stripping ה/ו/ב/ל/מ/ש/כ and two-word phrases, English plurals and
synonyms), modifiers that steer the ranking (עמוק/deep → dark, bass-heavy; קצר/short; חזק/loud; רך/soft; אמיתי/realistic;
איכותי → quality) and category hints, then BM25 over title, tags, categories, description and uses, plus a quality
prior and a variety rule (at most two takes of the same thing in a row).

## Mix engine (`sfxlib/mix.py`)

A cue sheet places sounds by their sync point (or start/end), on layers with their own bus EQ and gain (sub, hit,
transition, foley, ui, ambience, fx), with per-cue EQ (high/low pass, shelves, bells), fades, varispeed, trim, pan
and a short room reverb; optional beat snapping (beat / half / quarter / bar); music and voice beds with sidechain
ducking (SFX and music under the voice, music dipping under big hits); a limiter and EBU R128 loudness normalisation
to −14 LUFS (Reels/TikTok), true peak −1 dBTP. CC-BY credits are written next to the output.

## Automatic sound design (`sfxlib/autoscore.py`)

Finds cuts (ffmpeg scene score), fast motion peaks, sudden stops, flashes and the climax; reads tempo and beat phase
from the music; picks sounds per role from a preset (cinematic, viral, comedy, clean, horror), sized to the moment,
never the same sound twice; writes an editable cue sheet and renders the mix onto the video.

## Remotion

`remotion/SfxTrack.tsx` plays a cue sheet in any composition (`<SfxTrack cues={cues} />`, per-layer gain, fades,
ducking, `snapToBeat`). Use `sfx remotion` to copy the sounds into a project. For the final export, render one mix
with `sfx mix` and play that file.
