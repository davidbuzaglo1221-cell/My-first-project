# אימונים ותזונה

A Hebrew (RTL) web app for strength training and nutrition: workout logging with last time's numbers and records, a food diary with AI photo recognition, barcode lookup, and personal targets. Built with Next.js 16, Tailwind 4 and a local-first data layer (IndexedDB).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # data layer and formulas (vitest)
npm run lint
npm run build && npx next start -p 3100 && npm run e2e   # end-to-end smoke run
```

## Photo recognition (Claude API)

Meal photos are sent from the app to `/api/food-photo`, which asks Claude to list the foods with estimated grams, calories and macros. The key stays on the server.

| variable | required | what it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | for photos | Your Anthropic API key. Without it the photo screen says recognition is not set up, and everything else works. |
| `APP_ACCESS_TOKEN` | recommended once deployed | Any long random string. When set, the server only answers requests that send it, so a stranger who finds your URL cannot spend your key. Enter the same value in the app under פרופיל → קוד גישה. |

Locally, put them in `web/.env.local` (see `.env.example`). On Vercel: Project → Settings → Environment Variables.

Each photo costs a few cents of API usage. Photos are resized on the phone (1280 px) before upload, and only a small thumbnail is kept, on the phone.

## Listening (lessons read aloud)

Every lesson has a player: play/pause, previous/next/repeat sentence, speed 0.75-1.5x (pitch kept),
voice choice, progress, the sentence being read highlighted (tap one to jump), continue-listening, and
lock-screen controls. Text is prepared for speech first (`src/lib/speech/`: Hebrew numbers with gender,
ranges, units, dates, times, abbreviations, English terms), then spoken by:

| variable | what it does |
| --- | --- |
| `GOOGLE_TTS_API_KEY` | Google Cloud Text-to-Speech key: Chirp 3 HD voices (default engine) |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Azure Speech instead (or both, and pick with `TTS_PROVIDER`) |

Without a key, the phone's own Hebrew voice reads (offline too). Tests: `npm test`, and
`node e2e-listen.cjs` against `next start -p 3100`. Speech QA tooling: `../.claude/skills/speech-quality-testing`.

## Deploy (Vercel)

1. Import the GitHub repository in Vercel, with **Root Directory** set to `web`.
2. Add `ANTHROPIC_API_KEY` and `APP_ACCESS_TOKEN` as environment variables.
3. Deploy, open the site on your phone, and choose "Add to Home Screen".

## Data

Everything is stored in the browser on this device (IndexedDB): workouts, the food diary, photos and targets. Back it up from פרופיל → ייצוא כל הנתונים. Accounts and sync across devices come with the backend (`/replica-backend`, Supabase), behind the same functions in `src/data/`.

Food values are approximate (USDA FoodData Central and typical labels). Barcode products come from [Open Food Facts](https://world.openfoodfacts.org) (ODbL).
