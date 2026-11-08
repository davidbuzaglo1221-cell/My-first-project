"""Build animations/fat-journey.html from the template, the score and (optionally) narration.

usage: python3 build.py [NARRATION_DIR]
NARRATION_DIR holds scene_N.wav (+ scene_N.json word timings) from make_narration.py
or your own recordings. Scenes stretch to fit the narration; music cues follow.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SPEC = [10, 13, 11, 15, 14, 12]


def wav_len(fp):
    with wave.open(fp) as w:
        return w.getnframes() / w.getframerate()


def main():
    narr = sys.argv[1] if len(sys.argv) > 1 else None
    timing, words = SPEC[:], None
    env = dict(os.environ)
    if narr:
        timing, words = [], []
        for i in range(1, 7):
            d = wav_len(os.path.join(narr, f'scene_{i}.wav'))
            timing.append(round(max(SPEC[i - 1], d + 2.0), 2))  # 0.6 s lead-in + breathing room
            jp = os.path.join(narr, f'scene_{i}.json')
            ws = json.load(open(jp)) if os.path.exists(jp) else []
            words.append([[w, round(t + 0.6, 3)] for w, t in ws])
        env['FJ_NARR'] = os.path.abspath(narr)
    env['FJ_TIMING'] = json.dumps(timing)
    with tempfile.TemporaryDirectory() as tmp:
        wav, mp3 = os.path.join(tmp, 's.wav'), os.path.join(tmp, 's.mp3')
        subprocess.run([sys.executable, os.path.join(HERE, 'build_score.py'), wav], check=True, env=env)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '128k', mp3], check=True)
        audio = 'data:audio/mpeg;base64,' + base64.b64encode(open(mp3, 'rb').read()).decode()
    data = {'timing': timing, 'audio': audio, 'narration': bool(narr), 'words': words}
    src = open(os.path.join(ROOT, 'src', 'fat-journey.template.html'), encoding='utf-8').read()
    a = src.index('/*__FJ_DATA__*/') + len('/*__FJ_DATA__*/')
    b = src.index('/*__END__*/')
    out = src[:a] + json.dumps(data, ensure_ascii=False) + src[b:]
    dst = os.path.join(ROOT, 'fat-journey.html')
    open(dst, 'w', encoding='utf-8').write(out)
    print('wrote', dst, f'{len(out) / 1e6:.2f} MB', 'timing', timing)


if __name__ == '__main__':
    main()
