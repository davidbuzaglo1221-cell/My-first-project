# Voice QA — the permanent test system

We cannot hear, so we measure what a listener would notice, then David (or the user) gives the final ear check on one short sample. Never write "sounds great" without the numbers below.

## The suite (`tests/suite.json`, run with `qa.py suite`)
| Test | What it catches | Measure | Pass bar |
|---|---|---|---|
| Hebrew native ×3 | wrong vowels/stress, swallowed words | CER of Hebrew ASR (ivrit-ai whisper turbo) vs. script, spelling-insensitive | ≤ 8 % per line |
| Homographs (ספר/סיפר/מספרה) | context reading | transcript has the right words | exact |
| English native | non-native rhythm, misreads | CER (whisper small.en) | ≤ 5 % |
| Intonation: question / statement | flat questions | pitch movement over the last 0.45 s (`end_move_st`) | question > +0.5 st, statement < 0 |
| Emotion: same line × advertisement / audiobook / storytelling | one-size-fits-all delivery | pitch range (st) and pace (ch/s) must differ between styles | range spread ≥ 2 st, pace spread ≥ 10 % |
| Long sentence (35+ words) | uneven prosody, drop-outs | CER + last word heard | ≤ 8 %, last word heard |
| Numbers, prices, times, percent | wrong gender/reading | CER after number→word normalization | ≤ 10 % |
| Foreign words / brands in Hebrew | Latin runs read as Hebrew letters | CER + brand words present | brands present |
| Sync (every test writes an SRT) | captions drifting from voice | each cue start vs. first voiced frame | 100 % within 0.12 s |
| Continuity (3 paragraphs) | level jumps, voice drift between chunks | loudness spread across chunks; median-pitch spread | ≤ 1.5 dB, ≤ 6 % |

Every check also reports `pitch_range_st` (p10–p90 semitones), `chars_per_s`, `last_word_heard` (truncation) and the transcript itself — read the transcript; it shows *which* word is wrong.

## Comparing versions
1. Baselines live in `samples/<date>/` (MP3 + `report.md` + `report.json`).
2. A change (new engine, new style numbers, new text rule) is only "better" if `qa.py suite` on the same voices beats the baseline on its target metric without losing > 1 point elsewhere.
3. Save the new report as a new dated folder; add one line to `LEARNINGS.md`.

## Known limits of the measurements
- ASR is lenient: it can "correct" a mispronounced word from context. CER 0 does not prove perfect stress. Stress and naturalness still need one human listen.
- Pitch range measures liveliness, not beauty. Too wide (> 13 st) reads as sing-song.
- `end_move_st` is reliable on short single-clause questions; on long questions check by ear.
