#!/usr/bin/env python3
"""Hebrew voice + word-timed kinetic captions (ASS) from one script, free (edge-tts).

Writes <out>.mp3 and <out>.ass; the ASS burns onto a 1080x1920 video with:
  ffmpeg -i video.mp4 -vf "ass=<out>.ass" ...
Captions: 1–3 words per card, Heebo ExtraBold, white with soft dark outline, pop-in scale,
the last word of each sentence in the accent colour. Placed in the lower third so the mouth stays clear.

Usage: python captions.py --text "..." --out voice [--voice he-IL-AvriNeural] [--rate +8%] [--pitch +4Hz]
"""
import argparse, asyncio, re

import edge_tts

HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Heebo ExtraBold,112,&H00FFFFFF,&H00FFFFFF,&H64000000,&H00000000,0,0,0,0,100,100,0,0,1,6,0,2,70,70,430,177

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
ACCENT = "&H004FC8F5&"  # warm amber (BGR)


def ts(t):
    h, t = divmod(t, 3600); m, s = divmod(t, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


async def synth(text, voice, rate, pitch, mp3):
    words = []
    com = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append((ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7, ch["text"]))
    return words


def cards(text, words):
    # attach punctuation from the script back to the spoken words, then group 1-3 words per card
    toks = re.findall(r"\S+", text)
    out, cur = [], []
    for i, (s, e, w) in enumerate(words):
        tok = toks[i] if i < len(toks) else w
        cur.append((s, e, tok))
        end_sent = bool(re.search(r"[.?!]$", tok))  # accent the last word of a sentence
        pause = bool(re.search(r"[,:]$", tok))       # a comma also ends the card, without accent
        if len(cur) == 3 or end_sent or pause or (len(cur) == 2 and len(tok) > 6):
            out.append((cur, end_sent)); cur = []
    if cur:
        out.append((cur, True))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default="he-IL-AvriNeural")
    ap.add_argument("--rate", default="+8%")
    ap.add_argument("--pitch", default="+0Hz")
    a = ap.parse_args()
    words = asyncio.run(synth(a.text, a.voice, a.rate, a.pitch, a.out + ".mp3"))
    lines = [HEAD]
    cs = cards(a.text, words)
    for n, (c, end_sent) in enumerate(cs):
        start = c[0][0]
        nxt = cs[n + 1][0][0][0] if n + 1 < len(cs) else c[-1][1] + 0.6
        end = min(max(c[-1][1] + 0.15, start + 0.35), nxt)
        parts = []
        for k, (_, _, w) in enumerate(c):
            w = re.sub(r"[,.:]$", "", w)
            parts.append(("{\\c" + ACCENT + "}" + w + "{\\c&H00FFFFFF&}") if (end_sent and k == len(c) - 1) else w)
        pop = "{\\fscx82\\fscy82\\t(0,90,\\fscx106\\fscy106)\\t(90,160,\\fscx100\\fscy100)}"
        lines.append(f"Dialogue: 0,{ts(start)},{ts(end)},Cap,,0,0,0,,{pop}{' '.join(parts)}\n")
    open(a.out + ".ass", "w", encoding="utf-8").write("".join(lines))
    print(f"[captions] {len(cs)} cards, {len(words)} words -> {a.out}.ass / .mp3")


if __name__ == "__main__":
    main()
