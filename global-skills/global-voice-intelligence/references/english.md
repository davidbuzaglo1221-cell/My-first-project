# Native English delivery

Goal: sounds like a native speaker talking, not a translation being read. Default accent General American; British (RP-light) for documentary/audiobook when the brand fits.

## Script rules
1. **Contractions always** in conversational, podcast, ad and social copy: "you're", "it's", "we'll", "didn't". Uncontracted speech is the fastest tell of TTS-from-translation.
2. **Write for the ear**: subject–verb early, one idea per sentence, 8–16 words. Front-load the point.
3. **No Hebrew syntax calques**: not "It's very important to know that..." → "Here's the thing."; not "Come let's see" → "Let's take a look."
4. **Numbers**: engines normalize "$45", "2:30 PM", "20%" well (Kokoro/misaki, BlueTTS polyg2p, Microsoft). Years: "2026" → "twenty twenty-six" (check). Phone numbers and codes: write digit groups with commas.
5. **Discourse markers sparingly**: "so", "look", "honestly", "here's the thing" — one per paragraph, not per sentence.
6. **Emphasis by position**: end the sentence on the word that matters, or isolate it: "And the price? Zero."

## Prosody
- Stress-timed rhythm: content words stressed, function words reduced ("to" → tə, "and" → ən). Engines handle this; do not write phonetic spellings.
- Yes/no questions rise; wh-questions fall; tag questions ("right?") rise for checking, fall for confirming.
- Pace: conversational ~150–165 wpm, ads 170–190, audiobook 145–155, documentary 140–150.

## Voices (measured in this skill, see engines.md)
- Kokoro (local, Apache-2.0): af_heart (warm F, best overall), af_bella, bf_emma (British F, audiobook), am_michael (M, natural), am_puck (M, upbeat ad), am_fenrir (M, deep story), bm_george (British M, documentary).
- Microsoft (edge, unofficial endpoint): en-US-AndrewMultilingualNeural, AvaMultilingual, EmmaMultilingual, BrianMultilingual — conversational styles.
- BlueTTS speaks English too (same voices as Hebrew), useful when one voice must speak both languages.

## Pronunciation fixes
Kokoro (misaki G2P) accepts inline phonemes: `[Kokoro](/kˈOkəɹO/)`. Use for names and brands it misreads. Microsoft voices: spell phonetically in the lexicon ("Buzaglo" → "Boo-zah-glow") — test, keep what the ASR reads back correctly.
