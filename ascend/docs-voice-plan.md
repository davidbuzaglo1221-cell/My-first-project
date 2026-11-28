# Voice system: measured candidates and the content-aware plan (28.11.2026)

## Measured (same 87-word Hebrew text, ivrit-ai whisper-large-v3-turbo, Praat pitch)
| Voice | Source | WER | Pitch | Range | Pace | Notes |
|---|---|---|---|---|---|---|
| Itamar - Israeli Hebrew Narrator | ElevenLabs `l7Q9rbdCC6j3J5dNlOOg`, eleven_v4 | 2.7% | 102 Hz | 12.4 st | 124 w/min | only foreign-name spellings differ |
| Danit - Natural Israeli Hebrew | ElevenLabs `s0T0DT6EAPeX57MQpn3I`, eleven_v4 | 2.7% | 182 Hz | 11.1 st | 116 w/min | |
| Nimrod - Warm & Confident | ElevenLabs `ZiofZHcEBTn5sRySe5h8`, eleven_v4 | 6.2%* | 105 Hz | 11.2 st | 129 w/min | *first words cut in the screen recording |
| Maya (current) | Edge EmmaMultilingual | 5.3% | 183 Hz | 10.6 st | 107 w/min | drops "באפט" |
| Yoav (current) | Edge BrianMultilingual | 4.4% | 128 Hz | 7.9 st | 105 w/min | most monotone |

Voice IDs are real (GET /v1/shared-voices?language=he). All three: category professional, verified Hebrew on eleven_v4, notice_period 730 days.

## What blocks production
- Free plan: `402 paid_plan_required` ("Free users cannot use library voices via the API"). Free-plan output also has no commercial license.
- The previews in `public/voices/*.m4a` are cut from David's own ElevenLabs screen recordings: samples only, not a model. They are labelled "בשדרוג" and cannot be chosen.
- Speech-to-speech (voice changer) models do not list Hebrew: not used.

## Content-aware routing (once a paid plan is approved)
| Content | Voice | Model settings |
|---|---|---|
| Books (default) | Itamar; user can switch to Nimrod or Danit | eleven_v4, stability 0.5, style 0.3 |
| Business, money, negotiation | Itamar | stability 0.55 |
| Personal growth, stories, 30-day program | Nimrod | stability 0.45, style 0.4 |
| Meditations, breathing | Danit, slower | stability 0.7, speed 0.9 |
Render per chapter on the server side (GitHub Actions with the key as a secret or the session proxy), never in the browser; same ASR QA as `qa_books.py`; keep Maya/Yoav as fallback until every chapter passes.

## Cost (one voice, whole library)
~891 minutes ≈ 900k characters: Pro ($99/mo) for two months, or Scale ($299) for one. Tests and samples: Starter ($6).
