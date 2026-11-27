# Learnings — methods that were measured to work (or fail)

Newest first. One line each: date · what · measurement · where it now lives. No keys, no personal data, no client content.

| Date | Learning | Evidence | Lives in |
|---|---|---|---|
| 27.11.2026 | BlueTTS's Hebrew G2P (RenikudPlus) disambiguates homographs from context: "אני ספר" → sapár, "קראתי ספר" → séfer | G2P output in setup session | hebrew.md §2 |
| 27.11.2026 | Defective spelling misleads it: "הוא ספר לי" → sapér; "סיפר" reads correctly → always write full spelling | G2P output | hebrew.md §2 |
| 27.11.2026 | `ש"ח` is read as "shach" by the G2P → textprep expands ש"ח/₪ to שקלים | G2P output | textprep.py |
| 27.11.2026 | BlueTTS calibrates every stock voice to the same natural pace (`speed_scale` per language), so voices differ in timbre/pitch, not speed: control pace with `speed` + pauses | screening: 8.0 ch/s on every voice at speed 1.0 | styles.json |
| 27.11.2026 | edge-tts pins `certifi`; behind an inspecting proxy it fails TLS → voice.py adds the proxy CA and proxy URL to its SSL context | TLS error reproduced, fixed, re-run OK | voice.py |
| 27.11.2026 | Inherited from the "ascend" app: Microsoft Multilingual voices (Emma/Brian) made fewer errors on joined Hebrew words than he-IL Avri/Hila there; PSOLA pitch widening (k≈1.4) was preferred by a Hebrew listener-vote model | ascend/scripts/narration (earlier session) | styles.json `k` |
