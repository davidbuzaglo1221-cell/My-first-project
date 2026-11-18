# Hebrew narration

Lessons are rendered offline into MP3 with sentence timings, then played as ordinary audio files.

1. `phonikud-onnx` adds vowel marks, stress and vocal-shva marks to the Hebrew text.
2. `he_phonemes.py` turns vocalized Hebrew into IPA (dagesh, shin/sin, vav and yod as vowel letters, patah gnuva, stress).
3. Piper voices trained on Phonikud phonemes speak the IPA (`he_tts.py`). Models: Phonikud/phonikud-tts-checkpoints (michael, shaul), Phonikud/phonikud-experiments-checkpoints (enhanced → "ido"). Voice licences are non-commercial.
4. `render_he.py <voice> <model> <pace>` writes `public/audio/<voice>/<id>.mp3` + `.json`.
5. `qa_all.py <voice>` transcribes every track with ivrit-ai/whisper-large-v3-turbo and reports word/character error against the script.

Measured on the library (Michael): mean word error ≈ 7%, character error ≈ 3%. The earlier Chatterbox narration measured 74% word error and was removed.
