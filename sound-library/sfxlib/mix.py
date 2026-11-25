"""Professional SFX mixing with ffmpeg: layers, beat snapping, EQ, fades, ducking and loudness.

A cue sheet (JSON) describes the mix:

{
  "duration": 12.0,                       # seconds (optional: taken from video/music)
  "video": "in.mp4",                      # optional: picture to mux the mix onto
  "music": {"file": "beat.mp3", "gain_db": -6, "duck_db": -8},   # optional bed; ducked under SFX hits & voice
  "voice": {"file": "vo.wav", "gain_db": 0},                     # optional; SFX & music sit under it
  "bpm": 120, "snap": "beat",             # optional: snap cue times to beats ("beat", "half", "bar", or null)
  "target_lufs": -14,                     # Reels/TikTok loudness
  "cues": [
    {"t": 0.0, "sound": "sk:whoosh-fast-hard", "gain_db": -2, "layer": "transition",
     "fade_in": 0, "fade_out": 0.05, "eq": {"highpass": 120, "lowpass": 12000, "low_shelf": [100, 3], "high_shelf": [8000, -2],
     "bell": [[2500, -3, 1.0]]}, "rate": 1.0, "align": "sync", "trim": [0, 1.2], "pan": 0, "reverb": 0.0}
  ]
}

Each cue is placed so its sync point lands on t (align="sync", default) or its start does (align="start").
Layers ("sub", "hit", "transition", "foley", "ui", "ambience", "music") get their own bus gain and EQ so
stacking a sub, a hit and a whoosh on one moment stays clean.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from .common import ROOT, load_manifest

# Bus treatment per layer: gain and EQ that keep stacked layers out of each other's way.
BUS = {
    "sub":        {"gain_db": 0, "eq": {"lowpass": 180}},
    "hit":        {"gain_db": 0, "eq": {"highpass": 60}},
    "transition": {"gain_db": -2, "eq": {"highpass": 150}},
    "foley":      {"gain_db": -3, "eq": {"highpass": 100}},
    "ui":         {"gain_db": -5, "eq": {"highpass": 300}},
    "ambience":   {"gain_db": -14, "eq": {"highpass": 80, "lowpass": 14000}},
    "fx":         {"gain_db": -1, "eq": {}},
}


def snap_time(t: float, bpm: float | None, mode: str | None, offset: float = 0.0) -> float:
    if not bpm or not mode:
        return t
    step = 60.0 / bpm * {"beat": 1, "half": 0.5, "quarter": 0.25, "bar": 4}.get(mode, 1)
    return round((t - offset) / step) * step + offset


def _eq_chain(eq: dict) -> list[str]:
    f = []
    if eq.get("highpass"):
        f.append(f"highpass=f={eq['highpass']}:poles=2")
    if eq.get("lowpass"):
        f.append(f"lowpass=f={eq['lowpass']}:poles=2")
    if eq.get("low_shelf"):
        fr, g = eq["low_shelf"]
        f.append(f"bass=g={g}:f={fr}:width_type=s:width=0.7")
    if eq.get("high_shelf"):
        fr, g = eq["high_shelf"]
        f.append(f"treble=g={g}:f={fr}:width_type=s:width=0.7")
    for fr, g, q in eq.get("bell", []):
        f.append(f"equalizer=f={fr}:t=q:w={q}:g={g}")
    return f


def resolve(sound: str, recs: dict | None = None) -> tuple[Path, dict]:
    p = Path(sound)
    if p.exists():
        return p, {}
    recs = recs if recs is not None else load_manifest()
    r = recs.get(sound)
    if not r or not r.get("file"):
        raise FileNotFoundError(f"sound {sound!r} not in library (run: sfx sync)")
    return ROOT / r["file"], r


def render(sheet: dict, out: str | Path, recs: dict | None = None) -> dict:
    """Render the cue sheet to `out` (.wav/.m4a, or .mp4 when sheet has a video). Returns placement report."""
    recs = recs if recs is not None else load_manifest()
    inputs: list[str] = []
    chains: list[str] = []
    labels: list[str] = []
    report = []
    bpm, snap, off = sheet.get("bpm"), sheet.get("snap"), sheet.get("beat_offset", 0.0)
    dur = float(sheet.get("duration") or 0)

    for i, c in enumerate(sheet.get("cues", [])):
        path, rec = resolve(c["sound"], recs)
        rate = float(c.get("rate", 1.0))
        t = snap_time(float(c["t"]), bpm, c.get("snap", snap), off)
        sync_at = 0.0 if c.get("align") == "start" else float(rec.get("sync_at") or 0.0)
        trim0, trim1 = (c.get("trim") or [0, None])
        start = max(0.0, t - (sync_at - trim0) / rate)
        inputs += ["-i", str(path)]
        f = [f"aresample=48000", "aformat=channel_layouts=stereo"]
        if trim1 is not None or trim0:
            f.append(f"atrim=start={trim0}" + (f":end={trim1}" if trim1 is not None else ""))
            f.append("asetpts=PTS-STARTPTS")
        if rate != 1.0:  # varispeed like tape: pitch moves with speed (what SFX Kit's adapt.rate assumes)
            f += [f"asetrate={int(48000 * rate)}", "aresample=48000"]
        bus = BUS.get(c.get("layer", "fx"), BUS["fx"])
        f += _eq_chain({**bus["eq"], **(c.get("eq") or {})})
        if c.get("fade_in"):
            f.append(f"afade=t=in:st=0:d={c['fade_in']}")
        if c.get("fade_out"):
            # fade the tail: needs length after trim/rate
            L = (trim1 if trim1 is not None else float(rec.get("duration") or probe_dur(path))) - trim0
            L /= rate
            f.append(f"afade=t=out:st={max(0.0, L - c['fade_out']):.3f}:d={c['fade_out']}")
        if c.get("reverb"):
            w = float(c["reverb"])
            f.append(f"aecho=0.8:{0.6 * w + 0.2:.2f}:60|120|190:{0.35 * w:.2f}|{0.25 * w:.2f}|{0.15 * w:.2f}")
        if c.get("pan"):
            p = max(-1.0, min(1.0, float(c["pan"])))
            f.append(f"pan=stereo|c0={1 - max(0, p):.2f}*c0|c1={1 + min(0, p):.2f}*c1")
        g = float(c.get("gain_db", 0)) + bus["gain_db"]
        f.append(f"volume={g}dB")
        ms = int(round(start * 1000))
        f.append(f"adelay={ms}|{ms}")
        chains.append(f"[{len(inputs) // 2 - 1}:a]{','.join(f)}[s{i}]")
        labels.append(f"[s{i}]")
        report.append({"sound": c["sound"], "title": rec.get("title"), "at": round(t, 3), "starts": round(start, 3),
                       "layer": c.get("layer", "fx"), "gain_db": g, "license": rec.get("license"), "credit": rec.get("credit")})
        dur = max(dur, start + float(rec.get("duration") or 0) / rate)

    if not labels:
        raise ValueError("cue sheet has no cues")
    n = len(labels)
    chains.append(f"{''.join(labels)}amix=inputs={n}:normalize=0:dropout_transition=0,alimiter=limit=0.89[sfx]")
    final = "[sfx]"
    music, voice = sheet.get("music"), sheet.get("voice")
    if voice:
        inputs += ["-i", str(voice["file"])]
        vi = len(inputs) // 2 - 1
        chains.append(f"[{vi}:a]aresample=48000,aformat=channel_layouts=stereo,volume={voice.get('gain_db', 0)}dB,asplit=3[vo][vok][vok2]")
        # SFX ducks under the voice (sidechain), gently
        chains.append(f"{final}[vok]sidechaincompress=threshold=0.03:ratio=4:attack=15:release=250:makeup=1[sfxd]")
        final = "[sfxd]"
    if music:
        inputs += ["-i", str(music["file"])]
        mi = len(inputs) // 2 - 1
        chains.append(f"[{mi}:a]aresample=48000,aformat=channel_layouts=stereo,volume={music.get('gain_db', -6)}dB[mus]")
        key = "[vok2]" if voice else None
        if key:  # music ducks under voice
            chains.append(f"[mus]{key}sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[musd]")
        else:
            chains.append("[mus]anull[musd]")
        chains.append(f"{final}asplit=2[sfxa][sfxk]")
        # and dips briefly under big SFX hits so the hit reads
        chains.append(f"[musd][sfxk]sidechaincompress=threshold=0.1:ratio=3:attack=5:release=180[musdd]")
        chains.append("[musdd][sfxa]amix=inputs=2:normalize=0[bed]")
        final = "[bed]"
    if voice:
        chains.append(f"{final}[vo]amix=inputs=2:normalize=0[pre]")
        final = "[pre]"
    target = sheet.get("target_lufs", -14)
    chains.append(f"{final}loudnorm=I={target}:TP=-1.0:LRA=11,aresample=48000[out]")

    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-v", "error", *inputs]
    video = sheet.get("video")
    if video:
        cmd += ["-i", str(video)]
    cmd += ["-filter_complex", ";".join(chains), "-map", "[out]"]
    if video:
        cmd += ["-map", f"{len(inputs) // 2}:v:0", "-c:v", "copy", "-shortest"]
        cmd += ["-c:a", "aac", "-b:a", "256k"]
    elif out.suffix in (".m4a", ".aac", ".mp4"):
        cmd += ["-c:a", "aac", "-b:a", "256k"]
    if dur and not video:
        cmd += ["-t", f"{dur + 0.5:.3f}"]
    cmd.append(str(out))
    subprocess.run(cmd, check=True)
    credits = sorted({r["credit"] for r in report if r.get("credit")})
    if credits:
        out.with_suffix(".CREDITS.txt").write_text("Sound credits (CC-BY):\n" + "\n".join(credits) + "\n")
    return {"out": str(out), "cues": report, "credits": credits}


def probe_dur(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def render_file(sheet_path: str, out: str) -> dict:
    sheet = json.loads(Path(sheet_path).read_text())
    base = Path(sheet_path).parent
    for k in ("video",):
        if sheet.get(k) and not Path(sheet[k]).is_absolute():
            sheet[k] = str(base / sheet[k])
    for k in ("music", "voice"):
        if sheet.get(k) and not Path(sheet[k]["file"]).is_absolute():
            sheet[k]["file"] = str(base / sheet[k]["file"])
    return render(sheet, out)
