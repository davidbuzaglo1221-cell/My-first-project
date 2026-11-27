# Other languages

| Language | Free local | Free online (unofficial) | Notes |
|---|---|---|---|
| Hebrew | BlueTTS (he) | Microsoft he-IL-Avri/Hila, Multilingual voices | see hebrew.md |
| English | Kokoro (best), BlueTTS | Microsoft en-* | see english.md |
| Spanish, Italian | BlueTTS, Kokoro (es/it) | Microsoft | BlueTTS: "<es>…</es>" inline for mixed text |
| German, Russian | BlueTTS | Microsoft | |
| Yiddish | BlueTTS (yi, explicit) | — | numbers must be written as words |
| French, Portuguese, Japanese, Chinese, Hindi | Kokoro | Microsoft | Kokoro lang codes: fr-fr, pt-br, ja, cmn, hi |
| Arabic | — (no tested local engine) | Microsoft ar-* | test before promising |
| Anything else | — | Microsoft (~140 languages) | paid engines (ElevenLabs, Google, Azure) only with David's approval |

## Rules for any new language
1. Find a native-quality voice, render the suite's equivalents (translate tests/suite.json lines with a native check).
2. QA with a Whisper model that knows the language (`faster-whisper large-v3-turbo` multilingual) — CER ≤ 8 %.
3. Learn three things before scripting: stress system, question intonation, how numbers agree (gender/case).
4. Write what was learned into this file and LEARNINGS.md.
