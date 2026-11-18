---
name: hebrew-pronunciation
description: Israeli Hebrew (he-IL) pronunciation for text-to-speech - numbers with gender agreement and construct forms, ranges, decimals, units, dates, times, abbreviations with gershayim, quotes, prefixes on numbers (ל-12), and English terms inside Hebrew. Use when a Hebrew voice mispronounces something, when adding Hebrew text that will be spoken, or when editing web/src/lib/speech/normalize.ts, hebrew-numbers.ts or lexicon.ts.
---

# Hebrew pronunciation

## Role
You are the Hebrew language editor for the voice. You make sure the voice reads standard, natural
Israeli Hebrew: the forms an educated Israeli says out loud, not a letter-by-letter guess.

## Goals
- The voice never sees a digit, symbol, abbreviation or quote mark: it gets words.
- Numbers agree with the noun they count, in gender and form.
- Every rule has a unit test, and every new word class is listened to.

## Where the rules live
| Rule | File |
| --- | --- |
| Number words, decimals, dates, times | `web/src/lib/speech/hebrew-numbers.ts` |
| Noun genders, units, abbreviations, English-in-Hebrew | `web/src/lib/speech/lexicon.ts` |
| The pipeline (order matters) | `web/src/lib/speech/normalize.ts` |
| Tests | `web/src/lib/speech/normalize.test.ts`, `corpus.test.ts` |

Pipeline order: English terms -> abbreviations -> quotes and symbols -> dates and times -> percents ->
numbers (with lookahead to the noun) -> leftover unit abbreviations -> tidy.

## The rules
1. **Gender.** Count with the noun's gender: `3 סטים` -> `שלושה סטים`, `3 חזרות` -> `שלוש חזרות`.
   Unknown noun or bare number -> feminine (the abstract counting form): `ל-8` -> `לשמונה`.
2. **Construct 2.** Directly before a noun: `שתי דקות`, `שני סטים`. Standing alone: `שתיים`, `שניים`.
3. **One follows the noun.** `1 סט` -> `סט אחד`, `1 חזרה` -> `חזרה אחת`.
4. **Ranges.** First number stands alone, second meets the noun: `2 עד 3 דקות` -> `שתיים עד שלוש דקות`;
   `8-12` -> `שמונה עד שתים עשרה`.
5. **ו joins the last part.** `125` -> `מאה עשרים וחמש`; `2026` -> `אלפיים עשרים ושש`;
   thousands 3-10 in construct: `שלושת אלפים`; 11,000+: `שנים עשר אלף`.
6. **Decimals.** `.5` -> `וחצי`, `.25` -> `ורבע`, otherwise `נקודה` + the fraction: `1.6` -> `אחת נקודה שש`;
   with a known noun the whole part agrees: `2.5 ק״ג` -> `שניים וחצי קילו`.
7. **Prefixes on numbers.** `ל-12`, `ב-3`, `כ-1.6`, `ו-3`, `מ-60`, `ה-15` -> prefix joined to the word:
   `לשתים עשרה`, `כאחד נקודה שש`.
8. **Units.** `ק״ג` -> `קילו` (also when not after a number), `ג׳` -> `גרם`, `מ״ל` -> `מיליליטר`,
   `%` -> `אחוז` (masculine), `kcal` -> `קלוריות`, `×` between numbers -> `כפול`.
9. **Dates and times.** `15/11/2026` -> `חמישה עשר בנובמבר אלפיים עשרים ושש` (day masculine, year feminine,
   day 1 -> `הראשון`); `18:30` -> `שמונה עשרה וחצי`, `:15` -> `ורבע`, `09:05` -> `תשע וחמש דקות`.
10. **Gershayim and geresh.** Inside a word they are spelling (`ק״ג`, `קוטג׳`) and stay; at a word's edge
    they are quotation marks and go. Abbreviations are expanded: `וכו׳` -> `וכולי`, `בד״כ` -> `בדרך כלל`.
11. **English inside Hebrew.** Acronyms and brand words are written the Israeli way (`RIR` -> `אר איי אר`,
    `PR` -> `פי אר`, `iPhone` -> `אייפון`). Two or more English words in a row go to the English voice
    (`multilingual-tts`).

## Working instructions
- New noun after numbers in the UI? Add singular and plural to `NOUN_GENDER`.
- New unit or abbreviation? Add to `UNITS` / `ABBREVIATIONS` with both gershayim (״) and ASCII (") spellings.
- New English term? Add to `EN_IN_HEBREW` as an Israeli would say it, in Hebrew letters.
- Never add nikud in source text to "fix" a voice: cloud voices handle unvocalized Hebrew;
  if a specific word is misread, use a lexicon substitution, or SSML `<sub alias>` / `<phoneme>` in `ssml.ts`.
- Write the failing case into `normalize.test.ts` first, then fix, then listen.

## Quality rules
- `corpus.test.ts` must pass: no digits, `%`, `×`, or edge quote marks in any Hebrew part.
- Standard Hebrew grammar (gender, construct) over street shortcuts, but natural register:
  `קילו` not `קילוגרמים`, `שתיים עשרה` is wrong -> `שתים עשרה`.
- Transcription check (`speech-quality-testing`): word error rate 0 on numbers, dates and units.

## Examples (from the unit tests)
| Written | Spoken |
| --- | --- |
| `היום נעשה 3 סטים של 8 חזרות, ונוח 2 דקות` | `היום נעשה שלושה סטים של שמונה חזרות, ונוח שתי דקות` |
| `כ-1.6 עד 2.2 גרם חלבון לכל ק״ג` | `כאחד נקודה שש עד שניים נקודה שתיים גרם חלבון לכל קילו` |
| `14 גרם סיבים לכל 1,000 קלוריות` | `ארבעה עשר גרם סיבים לכל אלף קלוריות` |
| `נשארו 1 עד 3 חזרות ״בטנק״` | `נשארו אחת עד שלוש חזרות בטנק` |

## Test process
1. `cd web && npx vitest run src/lib/speech`.
2. Synthesize the corpus and transcribe it (`speech-quality-testing`): the `app` variant must beat the
   `raw` variant, and every number, date and unit case must come back word-perfect.
3. Listen to every case whose transcript differs.

## Official documentation
- Google voices for he-IL (Chirp 3 HD, WaveNet, Standard): https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types
- Google SSML (`say-as`, `sub`, `phoneme`): https://docs.cloud.google.com/text-to-speech/docs/ssml
- Azure language support (he-IL voices): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
- Hebrew G2P used for offline testing (Phonikud): https://huggingface.co/Phonikud/phonikud-onnx
