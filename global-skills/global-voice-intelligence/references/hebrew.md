# Israeli Hebrew for speech — a working guide for scripts and engines

The target is how an educated Israeli speaks today (Modern Israeli Hebrew, the "general" accent heard on Kan, Galei Tzahal and good podcasts), not liturgical, not Mizrahi-pharyngeal, not textbook-slow.

## 1. Phonology a narrator must get right
| Point | Spoken today | Why it matters for TTS |
|---|---|---|
| ר | uvular [ʁ] | G2P outputs ʁ; never an English r |
| ח / כ (רפה) | both [χ] | ח and כ merge; ע and א are both glottal or silent |
| ע, א | [ʔ] or nothing, mostly dropped between vowels | "מעט" ≈ me'at, not a pharyngeal |
| ה | weak, often dropped in fast speech ("מה הוא" ≈ ma-u) | a fully pronounced h in every position sounds read |
| ב/ו, כ/ק, ת/ט | ב (רפה) = ו = [v]; ק = כ (דגש) = [k]; ת = ט = [t] | ambiguity is in vowels, not consonants |
| צ, צ׳, ג׳, ז׳ | [ts], [tʃ], [dʒ], [ʒ] | loanwords: צ׳יפס, ג׳ל, ז׳קט |
| Vowels | five: a e i o u, no length contrast | |
| שווא נע | mostly silent in speech; pronounced [e] only where it breaks an impossible cluster or after a prefix in careful speech (לְדַבֵּר ≈ ledaber, but "תְּקופה" ≈ tkufa) | overpronounced shva = robotic |
| Stress | mostly final (מִלְרַע), but penultimate (מִלְעֵיל) in segolates (סֵפֶר, יֶלֶד, בֹּקֶר), many verb forms (אָמַרְתִּי → amárti), names (דָּוִד in daily speech: Dávid), loanwords (טֶלֶפוֹן → télefon), and colloquial nicknames | wrong stress is the #1 thing that makes Hebrew TTS sound foreign |

## 2. Writing the script for the engine (the single biggest quality lever)
1. **Full spelling (כתיב מלא)** always: "סיפר" not "ספר" when you mean "told", "שמישהו", "אימא". Measured: BlueTTS read "הוא ספר לי" as *saper*; "סיפר" fixes it.
2. **Niqqud only on the ambiguous word**, never on the whole text. Our Hebrew G2P (RenikudPlus in BlueTTS) reads context well: "אני ספר" → sapár (barber), "קראתי ספר" → séfer (book), measured. Add niqqud only where context cannot decide (headlines, single words, names).
3. **Numbers** — write digits only when the engine's normalizer agrees in gender (BlueTTS with `hebrew-num2words`: "3 ילדים" → שלושה, "3 בנות" → שלוש). Otherwise write words. Prices: "120 שקלים" (our textprep turns ש"ח and ₪ into שקלים). Times: "בשתיים וחצי" reads more natural than "14:30" in conversation; keep 14:30 for announcements.
4. **Acronyms**: expand what Israelis expand (ד"ר → דוקטור, ע"י → על ידי) and keep what they say as a word (צה"ל → "tsahal", מנכ"ל → "mankal", דו"ח → "doch"). Put such words in the project lexicon with full spelling: {"מנכ\"ל": "מנכל"}.
5. **English inside Hebrew**: keep brand names in Latin letters (iPhone, Google Drive, ChatGPT) — BlueTTS tags Latin runs and reads them with English G2P; Microsoft voices switch automatically. Hebrew-ized words (אינסטגרם, טיקטוק, פייד) stay in Hebrew letters.
6. **Gender and address**: decide once per product (את/אתה/אתם) and keep it; spoken Hebrew uses masculine plural for mixed audiences. A female voice saying "אני בטוח" is a script bug.
7. **Register**: spoken, not written. "אנחנו הולכים ל..." not "הננו"; "כי" not "מכיוון ש"; "ככה" not "כך" in casual content; "זה" before nouns in casual speech ("הספר הזה"). Drop "אשר", "הינו", "על מנת".
8. **Sentence length**: 6–14 words per breath. Our chunker breaks above 18 words at a comma or at clause starters (ו־, אבל, כי, כש־, אם). Write the comma where a speaker breathes; Hebrew writers under-punctuate.

## 3. Prosody and intonation
- **Declarative**: pitch peak on the focus word early in the phrase, gradual declination, final fall of 3–6 semitones.
- **Yes/no question**: no word order change in Hebrew — the question lives only in the final rise (+2 to +6 st on the last stressed syllable). Engines often miss it; measured in `qa.py` (`end_move_st`). If the rise is missing, end with "נכון?" / "כן?" or rewrite as a "האם"-less tag question, or move the question word first ("מה, אתה בטוח?").
- **Wh-question** (מה, איפה, למה): high start, fall at the end — do not force a rise.
- **Lists**: rise-hold on each item, fall on the last ("מכונה, מספריים, ומסרק").
- **Contrast/emphasis**: put the stressed word last or isolate it with a comma — Hebrew engines do not take SSML emphasis reliably.
- **Continuation**: a comma = short hold without fall (200–300 ms); a period = fall + 300–500 ms; paragraph = 0.6–1.1 s depending on the style.

## 4. Pace (written letters per second, spaces excluded — what `qa.py` reports as `chars_per_s`)
Estimate, not yet measured against native recordings: unvocalized Hebrew averages ~4–5 letters per word and lively speech runs ~2.5–3 words/s, so:
- Conversational / podcast: ~10–13 ch/s. Advertisement / social: ~12–15. Audiobook / documentary: ~8–11. Educational: ~9–11.
- Calibrate these against a real native recording when one is available, and record the result in `../LEARNINGS.md`.
- Faster delivery is made with shorter pauses and tighter sentences first, speed second; over +15 % speed, Hebrew consonant clusters smear.

## 5. Emotion in Hebrew delivery
| Emotion | Pitch | Pace | Pauses | Script tricks |
|---|---|---|---|---|
| Warm/friendly | mid, wide movement | medium | short | direct address, "תקשיב", "בוא נגיד" |
| Excited/energetic | higher median, widest range | fast | very short | short punchy sentences, verbs first |
| Calm/authoritative | lower median, narrow | slow | long | complete sentences, no fillers |
| Suspense/drama | low, then sudden rise | slow → fast | long before the reveal | one-word sentences. "ואז." |
| Empathy | low-mid, soft | slow | medium | "אני מבין", "זה בסדר" |
Hebrew TTS engines have no reliable emotion tags (BlueTTS: none; Microsoft he-IL: no styles). Emotion therefore comes from (1) the script, (2) the voice choice, (3) our pitch-range/pace profile in `styles.json`, (4) pauses. ElevenLabs v3 audio tags are the only real emotion control, and they cost money.

## 6. Pronunciation checklist before rendering
- [ ] Full spelling; niqqud on ambiguous words only
- [ ] Every number, date, time, price and percent reads correctly in gender
- [ ] Acronyms in lexicon; brand names in Latin letters
- [ ] Names: stress checked (דוד = Dávid in speech; שירה = Shíra; נועה = Nóa)
- [ ] Commas at breath points; no sentence over ~18 words
- [ ] Questions end with a measurable rise
- [ ] ASR transcript of the render matches the script (CER ≤ 8 %)
