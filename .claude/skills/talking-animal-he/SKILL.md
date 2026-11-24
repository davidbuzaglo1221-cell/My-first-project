---
name: talking-animal-he
description: Free Hebrew talking-animal / talking-character videos (the viral "animal talks to camera" format, but in Hebrew) with no paid API — local image generation, Microsoft neural Hebrew voice, and the official free Wan2.2 speech-to-video Space for real lip sync and head motion, finished to 1080x1920. Use when David asks for a talking animal, talking object, talking character, mascot that speaks, or any "make it talk in Hebrew" video, together with director and fast-video.
---

# Talking animal in Hebrew (free)

Every step is free. Never switch to a paid API (MuAPI etc.) without David's explicit OK — see DECISIONS.md "רק כלים חינמיים".

## 1. Idea and script (the part that makes it viral)
- One character, one situation, one twist. Best formats: the animal as the customer who complains (barbershop, gym, kitchen), the animal reacting to its owner, the animal giving blunt advice.
- For David's barber brand: animals in the barber chair, the dog who wants a fade, the cat that hates the beard trimmer. Mix goals across the series: laughs, views, everyday barbershop moments, clients.
- Script in spoken Hebrew, 8–15 seconds, short sentences, a hook in the first 2 seconds, punchline last. Write it fresh — never paste David's own sentences (LESSONS).
- No famous characters, brands or real people's faces.

## 2. The character image
- Own photo of a real animal (best), or generate free:
  `bash tools/local-ai/image.sh "<prompt>" output/<project>/char.png 576 1024 <seed>` (~9 min on CPU).
- Prompt rules that make lip sync work: face to camera, **mouth closed**, face large and centered in the upper third, even light on the muzzle, vertical frame, photoreal ("photorealistic portrait photograph... shot on 35mm").
- Look at the result before moving on (anatomy, paws, fur, text artifacts). Regenerate with another seed if anything is off.

## 3. Voice
- `edge-tts` voices: `he-IL-AvriNeural` (male), `he-IL-HilaNeural` (female). Character voices: raise `--pitch` (+4Hz…+20Hz) for small animals, lower for big/grumpy ones; `--rate +5%…+15%` for comedy energy.
- The venv's certifi must trust the cloud proxy CA (already appended in `/home/user/.media-venv`; redo after a fresh container: append `/root/.ccr/ca-bundle.crt` to `certifi.where()`).
- Listen-check: duration sane, no truncation (`ffprobe`), Hebrew ASR if available.

## 4. Lip sync + motion (free)
`/home/user/.media-venv/bin/python tools/talking-animal/make.py --image char.png --audio voice.mp3 --out talk.mp4`
- Uses the official `Wan-AI/Wan2.2-S2V` Hugging Face Space (free public queue, 480P). The queue can be long (20+ jobs): run it in the background and keep working.
- **Measured 24.11.2026: unreliable.** Two full runs reached the front of the queue and then failed with an empty error (the Space forwards to a paid Alibaba backend that seems to refuse). Treat it as "may work", never promise a delivery time from it. The queue moves ~1 place per 4 min (22–24 waiting → ~1.5 h per job). Submit early, in the background (Bash `run_in_background`, timeout 2 h), batch several clips per session.
- Checked and rejected as the default: `meituan-longcat/LongCat-Video-Avatar-1.5-Demo` (better model, ZeroGPU) — one 5 s clip requests 480 s of GPU; anonymous quota refuses, a free HF account likely too (PRO is paid). LivePortrait Spaces need a driving video, not audio. Wan2.2-S2V's own GitHub repo needs a big GPU.
- Fast free option (`multimodalart/MoDA-fast-talking-head`, ZeroGPU, ~40 s per 13 s clip): head motion, blinks and expression are alive; on a realistic dog the mouth barely moves (human-face model). Quota: anonymous ≈ 1 clip/day; David's free HF account (token saved as a network secret for this host — pass `token="hf_proxyinjected…"` to `Client` so the proxy can overwrite it) has ~168 s/day, under the 180 s one call needs → effectively blocked. Use it only when a clip of fresh anonymous quota is available.
- Finish any clip: `bash tools/talking-animal/finish.sh talk.mp4 voice.mp3 cap.ass out.mp4 <punch_s>` (captions from `captions.py`, punch-in, −14 LUFS).
- If the Space is down or refuses: `tools/talking-animal/puppet.py` (offline, CPU) — Claude looks at the image and passes the mouth box `--mouth x1,y1,x2,y2`. It is a weak fallback (jaw-flap look); tell David honestly, don't present it as the real thing.

## 5. Finish (fast-video standard)
- Cut to rhythm, add kinetic Hebrew captions (RTL), punch-in on the punchline, a light barbershop ambience bed under the voice, end card only if the series needs it. Use `fast-video` + Remotion/HyperFrames for captions and the edit.
- QA before showing David: watch frames at 0.5 s, check mouth matches speech, captions match audio, 1080x1920, loudness ≈ −14 LUFS.

## Setup in a fresh container
```
python3 -m venv /home/user/.media-venv && /home/user/.media-venv/bin/pip install edge-tts gradio_client opencv-python-headless numpy
P=$(/home/user/.media-venv/bin/python -c "import certifi;print(certifi.where())"); cat /root/.ccr/ca-bundle.crt >> "$P"
```
Network hosts needed (already allowed): `speech.platform.bing.com`, `huggingface.co` + its CDN, `wan-ai-wan2-2-s2v.hf.space`.
