# ספריית הסאונד של הסטודיו

ספרייה קבועה אחת לכל הסרטונים: אינדקס, קטגוריות, חיפוש חכם, הורדה לפי צורך, בלי כפילויות.
התהליך המלא לכל סרטון: הסקיל `studio-sound`.

| מה | איפה |
|---|---|
| הצלילים (רישיון שמותר להפיץ: CC0) | `sfx/<קטגוריה>/` — שמורים ב-Git |
| צלילים שמותר לשים בסרטון אבל לא להפיץ (Mixkit) | `.cache/` — לא נשמרים ב-Git, יורדים מחדש אוטומטית (`ensure`) |
| האינדקס: שם, קטגוריה, תגיות, תיאור, אופי, מקור, רישיון, יוצר, משך, טביעת אצבע | `index.json` |
| זיכרון שימוש (כדי שכל סרטון יקבל טייקים אחרים) | `usage.json` |
| וקטורי CLAP לחיפוש לפי משמעות | `embeddings.npz` |
| כלים | `tools/` (`sfxlib.py`, `mix.py`, `embed.py`, `qc_sync.py`, `setup.sh`, `taxonomy.py`) |

## Commands
```
bash tools/setup.sh                                   # fresh session
python3 tools/sfxlib.py stats                         # counts per category / licence / source
python3 tools/sfxlib.py search "glass clink" --category luxury
python3 tools/sfxlib.py search "dark metallic hit" --semantic      # CLAP meaning search
python3 tools/sfxlib.py fetch "door slam" --category foley --n 8   # Freesound API (needs the free key)
python3 tools/sfxlib.py import-tsv imports/x.tsv                  # Openverse/Freesound rows (no key)
python3 tools/sfxlib.py pick --cue reveal --mood heavy --video reel-08
python3 tools/sfxlib.py ensure | verify
```

## Sources and licences
- Freesound CC0 (via Openverse and the motion-graphics bundle), Kenney CC0, Mixkit SFX Free License (cache only).
- CC-BY is accepted with a credit line (CREDITS.txt per video). Non-commercial licences are refused by the code.
- Freesound direct search of ~700k sounds: `fetch`, with a free API key saved as a network secret for `freesound.org`
  (header `Authorization: Token <key>`), or `FREESOUND_API_KEY`.
