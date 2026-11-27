# Learnings — methods that were measured to work (or fail)

Newest first. One line each: date · what · measurement · where it now lives. No keys, no personal data, no client content.

| Date | Learning | Evidence | Lives in |
|---|---|---|---|
| 27.11.2026 | Baseline suite on final settings saved in `samples/2026-11-27/suite/` — compare every future change against it | report.md there | qa.md |
| 27.11.2026 | Emotion via pitch/pace profiles separates pace well but pitch range only weakly for some voices (blue:sara 9.5–10.9 st across 3 styles): emotion must come from the script and pauses first | final suite | hebrew.md §5, styles.md |
| 27.11.2026 | **Takes**: BlueTTS samples a new delivery per call; render 3 takes per chunk and keep the best (style's target pitch range, yes/no question rises, statement falls) | yes/no questions rising: 24/27 with 1 take → 26/27 with 3 takes (3 voices × 3 questions × 3 runs) | voice.py `take_score`, `GVI_TAKES` |
| 27.11.2026 | **Continuity**: anchor each chunk's median pitch to the voice's running median (±8 %) | pitch drift across 6 chunks: blue:sara 11.2 % → 2.5 %, blue:david 5.8 % → 5.2 %; loudness spread ≤ 0.7 dB | voice.py `VOICE_MED`, `liven(target_med)` |
| 27.11.2026 | Pitch widening k≈1.5 pushed ads/Reels to 14–15 st (sing-song zone) → k 1.3 for advertisement/social/storytelling; the take selector aims at `target_range` | demo renders before/after | styles.json |
| 27.11.2026 | Microsoft voices (he-IL Avri/Hila, Multilingual Emma/Brian) mangle Latin brand names inside Hebrew ("Google Drive" → "ג'יו וג'לי דרייב"); BlueTTS reads them right | screening, he-foreign test | engines.md, hebrew.md §2.5 |
| 27.11.2026 | BlueTTS says "14:30" the way people do ("שתיים וחצי") and handles number gender; ASR-based QA needs spoken-form `refs` or it punishes correct speech | screening transcripts | tests/suite.json `refs`, qa.py |
| 27.11.2026 | Kokoro read "$45" as "a dollar forty-five" and "2:30" as "two, thirty" → textprep writes prices and clock times as words in English | ASR transcript, CER 10 % → 0 % | textprep.py |
| 27.11.2026 | Most Kokoro male voices and bf_emma flatten yes/no questions (end −4 to −14 st); af_heart rises | English screening | styles.json English defaults |
| 27.11.2026 | The Edge endpoint dropped one request mid-run (worked again on retry): backup only, never the only engine | screening log | engines.md |
| 27.11.2026 | Loading one BlueTTS model per voice was OOM-killed at 7 voices (16 GB): one model, swap style files per call | dmesg OOM | voice.py `blue()` |
| 27.11.2026 | BlueTTS's Hebrew G2P (RenikudPlus) disambiguates homographs from context: "אני ספר" → sapár, "קראתי ספר" → séfer | G2P output in setup session | hebrew.md §2 |
| 27.11.2026 | Defective spelling misleads it: "הוא ספר לי" → sapér; "סיפר" reads correctly → always write full spelling | G2P output | hebrew.md §2 |
| 27.11.2026 | `ש"ח` is read as "shach" by the G2P → textprep expands ש"ח/₪ to שקלים | G2P output | textprep.py |
| 27.11.2026 | BlueTTS calibrates every stock voice to the same natural pace (`speed_scale` per language), so voices differ in timbre/pitch, not speed: control pace with `speed` + pauses | screening: 8.0 ch/s on every voice at speed 1.0 | styles.json |
| 27.11.2026 | edge-tts pins `certifi`; behind an inspecting proxy it fails TLS → voice.py adds the proxy CA and proxy URL to its SSL context | TLS error reproduced, fixed, re-run OK | voice.py |
| 27.11.2026 | Inherited from the "ascend" app: Microsoft Multilingual voices (Emma/Brian) made fewer errors on joined Hebrew words than he-IL Avri/Hila there; PSOLA pitch widening (k≈1.4) was preferred by a Hebrew listener-vote model | ascend/scripts/narration (earlier session) | styles.json `k` |
