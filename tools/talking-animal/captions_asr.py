#!/usr/bin/env python3
"""Word-timed kinetic captions (ASS, 1080x1920) for ANY language, timed from the audio itself
with faster-whisper — works for pitch-shifted character voices and real recordings.

Usage: python captions_asr.py --audio voice.wav --script "exact script text" --out cap.ass [--lang en] [--model small.en]
The script text is used for spelling/punctuation; whisper only supplies the timing.
Prints the time of the accented punchline word(s) so finish.sh can punch in there.
"""
import argparse, re, subprocess
import numpy as np
from faster_whisper import WhisperModel

HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Heebo ExtraBold,112,&H00FFFFFF,&H00FFFFFF,&H64000000,&H00000000,0,0,0,0,100,100,0,0,1,6,0,2,70,70,430,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
ACCENT = "&H004FC8F5&"


def ts(t):
    h, t = divmod(t, 3600); m, s = divmod(t, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--script", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--lang", default="en")
    ap.add_argument("--model", default="small.en")
    ap.add_argument("--accent", default="", help="comma-separated words to colour (default: last word of each sentence)")
    a = ap.parse_args()
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.audio, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    m = WhisperModel(a.model, device="cpu", compute_type="int8")
    segs, _ = m.transcribe(np.frombuffer(raw, np.float32), language=a.lang, word_timestamps=True, beam_size=5)
    words = [(w.start, w.end) for s in segs for w in s.words]
    toks = re.findall(r"\S+", a.script)
    if len(words) != len(toks):
        print(f"[warn] whisper heard {len(words)} words, script has {len(toks)}; timing mapped proportionally")
        idx = np.linspace(0, len(words) - 1, len(toks)).round().astype(int)
        words = [words[i] for i in idx]
    accent = {w.lower().strip() for w in a.accent.split(",") if w.strip()}
    cards, cur = [], []
    for (s, e), tok in zip(words, toks):
        cur.append((s, e, tok))
        end_sent = bool(re.search(r"[.?!]$", tok))
        if len(cur) == 3 or end_sent or re.search(r"[,:]$", tok):
            cards.append((cur, end_sent)); cur = []
    if cur:
        cards.append((cur, True))
    lines, punches = [HEAD], []
    for n, (c, end_sent) in enumerate(cards):
        start = c[0][0]
        nxt = cards[n + 1][0][0][0] if n + 1 < len(cards) else c[-1][1] + 0.6
        end = min(max(c[-1][1] + 0.15, start + 0.35), nxt)
        parts = []
        for k, (s, _, w) in enumerate(c):
            clean = re.sub(r"[,.:]$", "", w)
            hit = clean.lower().strip("?!") in accent if accent else (end_sent and k == len(c) - 1)
            if hit and accent:
                punches.append(round(s, 2))
            parts.append(("{\\c" + ACCENT + "}" + clean + "{\\c&H00FFFFFF&}") if hit else clean)
        pop = "{\\fscx82\\fscy82\\t(0,90,\\fscx106\\fscy106)\\t(90,160,\\fscx100\\fscy100)}"
        lines.append(f"Dialogue: 0,{ts(start)},{ts(end)},Cap,,0,0,0,,{pop}{' '.join(parts)}\n")
    open(a.out, "w", encoding="utf-8").write("".join(lines))
    print(f"[captions] {len(cards)} cards -> {a.out}; accent times: {punches}")


if __name__ == "__main__":
    main()
