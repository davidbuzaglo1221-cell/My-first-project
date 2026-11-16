---
name: creative-review
description: The studio's final quality gate. Run before delivering any important visual, video or software result (a page, app screen, component, poster, deck, logo, video or export), or when asked to review, QA or critique creative work. Renders and inspects the real output, scores it like a demanding creative director, fixes what falls short, and reports honestly what was and was not verified.
---

# Creative review

You are now the creative director reviewing someone else's work. Your job is to find what is
weak, not to defend it. Approval is earned.

## 1. Look at the real thing

Never review from source code or memory alone. Produce the actual output and look at it.

**Web pages and app UI**
- Start the app (or open the HTML file) and capture it with Playwright's preinstalled Chromium
  (`require('playwright')`, `chromium.launch()`, no install step).
- Capture at 390x844, 768x1024 and 1440x900, full page, at deviceScaleFactor 1 for your own checks.
  Open every screenshot with the Read tool and actually examine it.
- Exercise the real flows: click every primary action, submit forms, open menus and dialogs.
- Force each state that exists: loading, empty, error, success, long content, no content.
- Check the console for errors and the network for failed requests.
- Tab through with the keyboard: visible focus, logical order, no traps.
- If the `impeccable` skill is installed, run its detector on the changed files or URL; if
  `web-design-guidelines` is installed, apply it to the changed UI files.

**Video**
- Render the actual file. Check duration, resolution, frame rate and audio with `ffprobe`.
- Grab frames at the first second, every cut, and the final frame
  (`ffmpeg -ss <t> -i in.mp4 -frames:v 1 f_<t>.png`); build a contact sheet
  (`ffmpeg -i in.mp4 -vf "fps=1,scale=320:-1,tile=6x4" sheet.png`) and inspect it.
- Verify the hook in the first 1-2 seconds, legible type at phone size, safe areas for each
  platform's UI overlays, no black or duplicated frames, clean audio levels.

**Static graphics, decks, documents**
- Render to PNG or PDF and open the result. View it at full size and at thumbnail size.
- Check alignment to the grid, margins, typographic hierarchy, contrast and export dimensions.

## 2. Score it

Rate each from 1 to 5 and write one line of evidence for each score:

| # | Question |
|---|---|
| 1 | Is the concept strong and expressible in one sentence? |
| 2 | Is it genuinely premium, or merely tidy? |
| 3 | Is the hierarchy obvious at a glance? |
| 4 | Is anything unnecessary? |
| 5 | Is it consistent (type, spacing, color, motion, voice)? |
| 6 | Is it intuitive without explanation? |
| 7 | Does everything work (links, states, breakpoints, frames, exports)? |
| 8 | Is it right for its audience and context? |
| 9 | What single change would improve it most? |

Also check for generic-AI tells: default gradients, centered hero plus three icon cards, emoji as
icons, filler copy, purposeless motion, nested cards, weak or default typography.

## 3. Fix, then look again

Anything scoring 3 or below, any broken interaction and any generic tell gets fixed now. Batch the
fixes, re-render, and look again. Repeat until every score is 4 or above or the remaining gap
needs input only the user can give (real assets, copy, a business decision).

## 4. Report honestly

Deliver with a short note: what was verified and how (for example "screenshots at 390, 768 and 1440;
all forms submitted; console clean"), what was not verified and why, and any open decision for the
user. Never claim a test, render or check that did not happen.
