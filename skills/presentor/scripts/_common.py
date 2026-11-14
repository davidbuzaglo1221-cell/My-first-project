"""Shared helpers for the presentor scripts (Python 3.8+, Windows / Mac / Linux).

- find_chrome(): locate Chrome / Chromium / Edge automatically.
- run_chrome(): run headless Chrome with a fresh temporary --user-data-dir.
- embed_google_font(): download a Google Font (Hebrew + Latin) and return @font-face CSS with base64 data.
"""
import base64
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent

CHROME_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def die(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def find_chrome():
    env = os.environ.get("CHROME_PATH")
    if env and Path(env).is_file():
        return str(Path(env).resolve())
    cands = []
    if sys.platform.startswith("win"):
        roots = [os.environ.get(k) for k in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA")]
        for r in filter(None, roots):
            cands += [Path(r) / "Google/Chrome/Application/chrome.exe",
                      Path(r) / "Chromium/Application/chrome.exe",
                      Path(r) / "Microsoft/Edge/Application/msedge.exe"]
    elif sys.platform == "darwin":
        for base in (Path("/Applications"), Path.home() / "Applications"):
            cands += [base / "Google Chrome.app/Contents/MacOS/Google Chrome",
                      base / "Chromium.app/Contents/MacOS/Chromium",
                      base / "Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome", "msedge"):
        p = shutil.which(name)
        if p:
            cands.append(Path(p))
    cands += sorted(Path("/opt/pw-browsers").glob("chromium-*/chrome-linux*/chrome"))
    if sys.platform.startswith("linux"):  # on Linux servers the headless shell is the most reliable
        cands = sorted(Path("/opt/pw-browsers").glob("chromium_headless_shell-*/*/chrome-headless-shell")) + cands
    for c in cands:
        if c.is_file():
            return str(c.resolve())
    die("Chrome not found. Install Google Chrome, or set CHROME_PATH to the chrome executable.")


def run_chrome(args, timeout=90):
    """Run headless Chrome with a temporary profile. Returns CompletedProcess (stdout text)."""
    chrome = find_chrome()
    prof = tempfile.mkdtemp(prefix="presentor-chrome-")
    head = [] if "headless-shell" in Path(chrome).name else ["--headless=new"]
    cmd = [chrome] + head + ["--disable-gpu", "--disable-background-networking", "--disable-component-update", "--no-first-run", "--no-default-browser-check",
           "--disable-extensions", "--hide-scrollbars", "--mute-audio",
           "--user-data-dir=" + str(Path(prof).resolve())]
    if sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0:
        cmd.append("--no-sandbox")
    cmd += args
    try:
        return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                              errors="replace", timeout=timeout)
    except subprocess.TimeoutExpired:
        die("Chrome did not finish in %ds (%s). Close other Chrome windows and try again, "
            "or set CHROME_PATH to another Chrome/Chromium/Edge." % (timeout, chrome))
    finally:
        shutil.rmtree(prof, ignore_errors=True)


def file_url(path, fragment=""):
    url = Path(path).resolve().as_uri()
    return url + ("#" + fragment if fragment else "")


def count_slides(html_text):
    return len(re.findall(r'<div class="item"', html_text))


def parse_selection(sel, n):
    if sel.strip().lower() in ("all", "*"):
        return list(range(1, n + 1))
    out = []
    for part in sel.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    bad = [i for i in out if i < 1 or i > n]
    if bad:
        die("slide numbers out of range 1-%d: %s" % (n, bad))
    return sorted(set(out))


def _get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": CHROME_UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    return data if binary else data.decode("utf-8")


def embed_google_font(family, subsets=("hebrew", "latin")):
    """Return (css, found_subsets). css has @font-face rules with base64 woff2 data."""
    fam = family.strip().replace(" ", "+")
    css = None
    for axis in (":wght@300..900", ":wght@400..900", ":wght@400;500;600;700;800;900", ":wght@400;700", ""):
        try:
            css = _get("https://fonts.googleapis.com/css2?family=%s%s&display=swap" % (fam, axis))
            break
        except Exception:
            continue
    if css is None:
        die("could not download Google Font '%s' (check the name at fonts.google.com and the internet)." % family)
    blocks = re.findall(r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*\{.*?\})", css, re.S)
    if not blocks:  # single block without subset comments
        blocks = [("latin", b) for b in re.findall(r"@font-face\s*\{.*?\}", css, re.S)]
    out, found = [], []
    for subset, block in blocks:
        if subset not in subsets:
            continue
        found.append(subset)

        def repl(m):
            data = _get(m.group(1), binary=True)
            return "url(data:font/woff2;base64,%s) format('woff2')" % base64.b64encode(data).decode("ascii")

        block = re.sub(r"url\((https://[^)]+)\)\s*format\('woff2'\)", repl, block)
        block = re.sub(r"\s*font-display:[^;]+;", "\n  font-display: block;", block)
        out.append("/* %s %s */\n%s" % (family, subset, block))
    return "\n".join(out), sorted(set(found))
