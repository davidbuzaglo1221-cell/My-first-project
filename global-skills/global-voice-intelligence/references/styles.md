# Delivery profiles — never one voice profile for everything

Profiles live in `../styles.json` (numbers) and are applied by `scripts/voice.py -s <style>`. This file is the "why" and the script-writing half, which matters more than the numbers.

| Style | Feels like | Script shape | Pace / pauses | Pitch movement (k) | Loudness |
|---|---|---|---|---|---|
| podcast | a smart friend across the table | "you" + "I", short asides, one question per minute | medium, 0.30 / 0.70 s | 1.25 | −16 LUFS |
| audiobook | a reader who lives inside the story | full sentences, scene → feeling → meaning | slower, 0.45 / 1.0 s | 1.15 | −19 LUFS (ACX-safe) |
| documentary | calm authority, facts land | statement + number + consequence; no hype words | slow-medium, 0.40 / 0.9 s | 1.05 (narrow) | −16 |
| advertisement | conviction with a smile | hook in ≤ 1 s, benefit, proof, one call to action | fast, 0.15 / 0.35 s | 1.45 | −14 |
| educational | patient, clear teacher | idea in one sentence → example → "in practice" step | medium, 0.35 / 0.8 s | 1.20 | −16 |
| storytelling | tension and release | short-short-long rhythm, pause before the reveal | slow with sudden speed-ups, 0.45 / 1.1 s | 1.35 | −16 |
| conversational | talking, not reading | contractions, fragments, fillers used once | medium-fast, 0.20 / 0.5 s | 1.30 | −16 |
| social (Reels/TikTok) | energetic top presenter | 3–7 word lines, verb first, no warm-up | fast, 0.12 / 0.30 s | 1.50 | −14 |
| assistant | quick, polite, human | answer first, ≤ 2 sentences, offer the next step | quick, 0.15 / 0.30 s | 1.15 | −18 |

`k` widens each chunk's pitch movement around its median (Praat PSOLA). Untouched engine output measured 7–10 st (p10–p90) in this skill's screening (engines.md). Rule of thumb, not yet validated with listeners: keep the final range under ~13 st or it starts to sound sing-song.

## Choosing
1. Ask: who listens, where (car, gym, phone speaker, cinema), and what they must do after. That picks the style.
2. Voice gender/age by the brand and the audience, not by habit. For David's barber brand: confident male, mid-low, unhurried — `social` for Reels, `conversational` for stories.
3. Two voices (duo) for podcast-style learning content: alternate by paragraph, never by sentence.
4. Mixed products (an app with lessons + notifications): one voice family, two styles (educational for lessons, assistant for prompts).

## Per-product defaults
| Product | Style | Notes |
|---|---|---|
| App lessons / audiobook | educational / audiobook | chapter structure read as written; −19 LUFS; sentence timings for highlighted text |
| Reels / TikTok | social | voice first, then cut the video to it; captions from the SRT |
| Landing page / site | conversational | ≤ 30 s, autoplay off, transcript on page |
| Podcast | podcast (duo) | −16 LUFS, intro/outro music −20 dB under voice |
| Voice guide / meditation | audiobook with speed 0.9 | long pauses, low k |
| Kids / story | storytelling | slower, clearer, higher k |
| Talking AI character | conversational + fixed voice | one voice per character forever; store in the project lexicon/voice file |
| Ad (radio/video) | advertisement | read the legal line in documentary style |
| Voice assistant | assistant | streaming; first audio < 1 s; BlueTTS `stream()` |
