# Project rules

## Video QA rule (set by the owner, mandatory for EVERY video)

Never deliver a video without a full human-style QA pass on the **final rendered file**.
Check it as a real viewer would: listen to it and watch it, and ask "is this actually good?"

1. **Narrator must speak native, clear, mature Hebrew.** No robotic or accented TTS.
   - Use a native neural voice (`he-IL-AvriNeural` via `edge-tts`, or ElevenLabs if a key is provided).
   - Never use Meta MMS-TTS for Hebrew: it measured 33% word error rate and sounds foreign.
   - Put nikud on ambiguous words in the spoken text (e.g. סַפָּר, not ספר, which reads as "sefer").
2. **Listen check (automatic):** run `tiktok-barbers/qa.py` (Hebrew Whisper, ivrit-ai large-v3-turbo)
   on the narration AND on the audio extracted from the final MP4, with music mixed in.
   Every segment must pass. Then read every remaining difference by hand: a homophone (לו/לא) is fine,
   a mispronounced or swallowed word is not. Reword or add nikud and regenerate until it is clean.
3. **Watch check:** extract a frame at the middle of every spoken sentence and review them all:
   spelling, RTL order, captions matching the narration, nothing clipped or overlapping,
   and nothing under TikTok's UI (top bar, right-hand buttons, bottom description).
4. **Tech check:** 1080x1920, 30fps, about -14 LUFS, true peak below -1 dBFS.
5. Report the QA results to the owner honestly, including what was found and fixed.
