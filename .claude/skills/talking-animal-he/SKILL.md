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
