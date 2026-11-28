#!/usr/bin/env python3
"""Frame-accurate sound design + mix for a finished (silent or voiced) video.

Run with the sfx-finder venv (numpy, scipy):
  .claude/skills/sfx-finder/.venv/bin/python TITAN-BUSINESS-OS/sound-library/tools/mix.py plan.json

plan.json:
{
  "video": "in.mp4", "out": "out/final.mp4", "video_id": "reel-07",       # video_id feeds the anti-repeat memory
  "target_lufs": -14, "true_peak": -1.5,                                   # social defaults
  "music": {"file": "track.mp3", "offset": 15.0, "start": 1.0, "gain_db": -6,
            "fade_in": 0.05, "fade_out": [16.0, 17.5],
            "automation": [{"t0": 3.0, "t1": 6.0, "lowpass": 700, "gain_db": -5, "ramp": 0.15}],
            "source": "\"Tech House vibes\" by Alejandro Magana, Mixkit #130", "license": "Mixkit Stock Music Free License"},
  "voice": {"file": "vo.wav", "start": 0.0, "gain_db": 0, "duck_db": -10},  # optional; music ducks under it
  "cues": [
    {"t": 0.0, "cue": "photo", "gain_db": -2, "align": "start"},
    {"t": 2.0, "cue": "scene_cut", "align": "peak", "mood": ["fast"], "label": "whip to close-up"},
    {"t": 8.0, "category": "riser", "align": "end", "dur": 3.0},             # riser ENDS on the hit at 8.0
    {"t": 5.0, "id": "fr-138156", "dur": 1.2, "fade": 0.2, "pan": -0.3}      # a fixed sound by id
  ]
}
align: start = sound starts at t | peak = loudest moment lands on t (whooshes) | end = sound ends at t (risers, reverses)
Every cue time is snapped to the video's frame grid. Outputs next to `out`: the MP4, SOUND.md (cue table, licences,
loudness measured on the MP4), CREDITS.txt, cues.resolved.json, stems/ (sfx.wav, music.wav).
"""
import json, math, re, subprocess, sys
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
TOOLS = Path(__file__).resolve().parent
LIB = TOOLS.parent


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(" ".join(map(str, cmd))[:200] + "\n" + r.stderr[-800:])
    return r


def decode(path, offset=0.0, dur=None):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(offset), "-i", str(path)]
    if dur:
        cmd += ["-t", str(dur)]
    cmd += ["-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def db(x):
    return 10 ** (x / 20)


def probe(video):
    r = sh(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate:format=duration",
            "-of", "json", str(video)])
    j = json.loads(r.stdout)
    num, den = j["streams"][0]["r_frame_rate"].split("/")
    return float(j["format"]["duration"]), float(num) / float(den)


def pick(cue, video_id):
    if cue.get("id"):
        idx = json.loads((LIB / "index.json").read_text())
        s = next(s for s in idx["sounds"] if s["id"] == cue["id"])
        return {"id": s["id"], "path": str(LIB / s["file"]), "name": s["name"], "license": s["license"],
                "attribution": s["attribution"], "category": s["category"], "duration": s["duration"]}
    cmd = [sys.executable if False else "python3", str(TOOLS / "sfxlib.py"), "pick", "--video", video_id]
    for k in ("cue", "category", "query"):
        if cue.get(k):
            cmd += [f"--{k}", cue[k]]
    if cue.get("mood"):
        cmd += ["--mood", *cue["mood"]]
    if cue.get("want_dur"):
        cmd += ["--dur", str(cue["want_dur"])]
    if cue.get("max_dur"):
        cmd += ["--max-dur", str(cue["max_dur"])]
    if cue.get("min_dur"):
        cmd += ["--min-dur", str(cue["min_dur"])]
    return json.loads(sh(cmd).stdout)


def place(bus, snd, t, align, gain, pan, fade):
    if fade:
        n = min(len(snd), int(fade * SR))
        snd[-n:] *= np.linspace(1, 0, n)[:, None]
    env = np.abs(snd).max(1)
    if align == "peak":
        smooth = np.convolve(env, np.ones(480) / 480, mode="same")
        anchor = int(np.argmax(smooth))
    elif align == "end":
        nz = np.nonzero(env > db(-50))[0]
        anchor = int(nz[-1]) if nz.size else len(snd)
    else:
        anchor = 0
    start = int(round(t * SR)) - anchor
    if start < 0:
        snd, start = snd[-start:], 0
    end = min(len(bus), start + len(snd))
    if end <= start:
        return None
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    snd = snd[: end - start] * gain * np.array([l, r]) * math.sqrt(2)
    bus[start:end] += snd
    return (start + anchor) / SR


def music_bus(m, total, cues_t):
    n = int(total * SR)
    bus = np.zeros((n, 2), np.float32)
    start = m.get("start", 0.0)
    audio = decode(m["file"], m.get("offset", 0.0), total - start + 0.1)
    s0 = int(start * SR)
    seg = audio[: n - s0]
    seg = seg * db(m.get("gain_db", 0))
    fi = int(m.get("fade_in", 0.02) * SR)
    seg[:fi] *= np.linspace(0, 1, fi)[:, None]
    bus[s0:s0 + len(seg)] = seg
    gain = np.ones(n, np.float32)
    for a in m.get("automation", []):
        i0, i1, rp = int(a["t0"] * SR), int(a["t1"] * SR), int(a.get("ramp", 0.1) * SR)
        if a.get("lowpass"):
            sos = butter(4, a["lowpass"], "low", fs=SR, output="sos")
            filt = sosfilt(sos, bus, axis=0).astype(np.float32)
            w = np.zeros(n, np.float32)
            w[i0:i1] = 1
            w[max(0, i0 - rp):i0] = np.linspace(0, 1, i0 - max(0, i0 - rp))
            w[i1:min(n, i1 + rp)] = np.linspace(1, 0, min(n, i1 + rp) - i1)
            bus = bus * (1 - w[:, None]) + filt * w[:, None]
        if a.get("gain_db") is not None:
            g = db(a["gain_db"])
            gain[i0:i1] = np.minimum(gain[i0:i1], g)
            if rp:
                gain[max(0, i0 - rp):i0] = np.minimum(gain[max(0, i0 - rp):i0], np.linspace(1, g, i0 - max(0, i0 - rp)))
                gain[i1:min(n, i1 + rp)] = np.minimum(gain[i1:min(n, i1 + rp)], np.linspace(g, 1, min(n, i1 + rp) - i1))
    if m.get("fade_out"):
        a, b = (int(x * SR) for x in m["fade_out"])
        gain[a:b] *= np.linspace(1, 0, b - a)
        gain[b:] = 0
    return bus * gain[:, None]


def duck(music, voice, depth_db):
    env = np.abs(voice).max(1)
    win = int(0.03 * SR)
    env = np.convolve(env, np.ones(win) / win, mode="same")
    active = (env > db(-40)).astype(np.float32)
    # attack 40 ms, release 350 ms
    g = np.ones_like(active)
    a, r = math.exp(-1 / (0.04 * SR)), math.exp(-1 / (0.35 * SR))
    target = 1 - active * (1 - db(depth_db))
    cur = 1.0
    for i in range(0, len(g), 64):  # block-wise follower (fast enough, smooth)
        t = target[i:i + 64].min()
        coef = a if t < cur else r
        cur = t + (cur - t) * coef ** 64
        g[i:i + 64] = cur
    return music * g[:, None]


def measure(path, mono=False):
    cmd = ["ffmpeg", "-nostats", "-i", str(path)] + (["-ac", "1"] if mono else []) + ["-af", "ebur128=peak=true", "-f", "null", "-"]
    err = subprocess.run(cmd, capture_output=True, text=True).stderr
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", err)
    tp = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", err)
    return float(i[-1]) if i else None, float(tp[-1]) if tp else None


def main(plan_path):
    plan_path = Path(plan_path)
    P = json.loads(plan_path.read_text())
    base = plan_path.parent
    rel = lambda p: p if Path(p).is_absolute() else str(base / p)
    video, out = rel(P["video"]), Path(rel(P["out"]))
    out.parent.mkdir(parents=True, exist_ok=True)
    stems = out.parent / "stems"; stems.mkdir(exist_ok=True)
    total, fps = probe(video)
    n = int(total * SR)
    frame = lambda t: round(t * fps) / fps
    sfx = np.zeros((n, 2), np.float32)
    resolved = []
    usage_file = LIB / "usage.json"  # a re-render of the same video starts its anti-repeat memory fresh
    if usage_file.exists():
        u = json.loads(usage_file.read_text())
        u["uses"] = [x for x in u["uses"] if x.get("video") != P.get("video_id", out.stem)]
        usage_file.write_text(json.dumps(u, indent=1))
    for i, c in enumerate(P["cues"]):
        t = frame(c["t"])
        s = pick(c, P.get("video_id", out.stem))
        snd = decode(s["path"], c.get("trim_start", 0), c.get("dur"))
        landed = place(sfx, snd, t, c.get("align", "start"), db(c.get("gain_db", 0)), c.get("pan", 0), c.get("fade"))
        resolved.append({"i": i, "t": t, "frame": round(t * fps), "landed": landed, "align": c.get("align", "start"),
                         "label": c.get("label", c.get("cue") or c.get("category")), **{k: s[k] for k in ("id", "name", "category", "license", "attribution", "path")}})
    music = music_bus({**P["music"], "file": rel(P["music"]["file"])}, total, [r["t"] for r in resolved]) if P.get("music") else np.zeros_like(sfx)
    voice = np.zeros_like(sfx)
    if P.get("voice"):
        v = decode(rel(P["voice"]["file"])) * db(P["voice"].get("gain_db", 0))
        s0 = int(P["voice"].get("start", 0) * SR)
        voice[s0:s0 + len(v)] = v[: n - s0]
        music = duck(music, voice, P["voice"].get("duck_db", -10))
    # keep the original video's own audio (if any) as part of the voice layer
    mix = voice + sfx * db(P.get("sfx_bus_db", 0)) + music
    for name, arr in (("sfx", sfx), ("music", music), ("mix_pre", mix)):
        arr.astype(np.float32).tofile(stems / f"{name}.f32")
        sh(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", str(stems / f"{name}.f32"), str(stems / f"{name}.wav")])
        (stems / f"{name}.f32").unlink()
    # two-pass loudness normalisation to the target, then a true-peak limiter
    I, TP = P.get("target_lufs", -14), P.get("true_peak", -1.5)
    first = subprocess.run(["ffmpeg", "-v", "info", "-i", str(stems / "mix_pre.wav"), "-af",
                            f"loudnorm=I={I}:TP={TP}:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    js = json.loads(first[first.rfind("{"):first.rfind("}") + 1])
    ln = (f"loudnorm=I={I}:TP={TP}:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}"
          f":measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    sh(["ffmpeg", "-y", "-v", "error", "-i", str(stems / "mix_pre.wav"), "-af", f"{ln},alimiter=limit={db(TP - 0.5):.4f}:level=false",
        "-ar", str(SR), str(stems / "mix.wav")])
    sh(["ffmpeg", "-y", "-v", "error", "-i", video, "-i", str(stems / "mix.wav"), "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(out)])
    li, tp = measure(out); lm, tpm = measure(out, mono=True)
    (out.parent / "cues.resolved.json").write_text(json.dumps(resolved, ensure_ascii=False, indent=1))
    credits = sorted({r["attribution"] for r in resolved})
    music_line = f"Music: {P['music'].get('source', 'unknown source')} ({P['music'].get('license', 'LICENCE NOT CONFIRMED')})" if P.get("music") else ""
    (out.parent / "CREDITS.txt").write_text("Sound effects:\n" + "\n".join(credits) + ("\n\n" + music_line if music_line else "") + "\n")
    ids = [r["id"] for r in resolved]
    rows = "\n".join(f"| {r['i']} | {r['t']:.3f} | {r['frame']} | {r['label']} | {r['align']} | `{r['id']}` {r['name'][:40]} | {r['license']} |" for r in resolved)
    (out.parent / "SOUND.md").write_text(
        f"# Sound report: {out.name}\n\nVideo {total:.2f} s at {fps:g} fps. {len(resolved)} cues, {len(set(ids))} different sounds "
        f"({len(ids) - len(set(ids))} repeats).\n\nLoudness measured on the exported MP4: **{li} LUFS integrated, true peak {tp} dBFS** "
        f"(mono fold-down: {lm} LUFS, {tpm} dBFS). Target {I} LUFS / {TP} dBTP.\n\n{music_line}\n\n"
        f"| # | time s | frame | moment | align | sound | licence |\n|---|---|---|---|---|---|---|\n{rows}\n")
    print(json.dumps({"out": str(out), "cues": len(resolved), "unique_sounds": len(set(ids)), "lufs": li, "true_peak": tp,
                      "mono_lufs": lm, "mono_tp": tpm}, indent=1))


if __name__ == "__main__":
    main(sys.argv[1])
