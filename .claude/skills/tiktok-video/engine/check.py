import sys, subprocess, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[1], device='cpu', compute_type='int8')
for f in sys.argv[2:]:
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',f,'-f','f32le','-ac','1','-ar','16000','-'])
    segs, _ = m.transcribe(np.frombuffer(raw, np.float32), language='he', beam_size=5)
    print(f, '|', ' '.join(s.text.strip() for s in segs), flush=True)
