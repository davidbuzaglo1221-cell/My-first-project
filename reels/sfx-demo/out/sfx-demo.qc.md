# Checks before done: sfx-demo.mp4

**PASS**: ready to post on TikTok. 1 thing worth knowing, below.

## Worth knowing

- **Face**: the face disappears for a moment at 8.17-8.60 s: something may cover it (give source= to measure it against the clip). Fix: look at those moments.

## Every check

| Check | Result | What was measured |
|---|---|---|
| face | WARN | the face disappears for a moment at 8.17-8.60 s: something may cover it (give source= to measure it against the clip) |
| shape | PASS | 1080x1920, 9:16 as TikTok expects |
| size | PASS | 1080x1920 |
| frame rate | PASS | 30 fps, constant |
| codec | PASS | H.264, yuv420p |
| length | PASS | 17.60 s |
| loudness | PASS | -14.0 LUFS integrated, 0.0 LU over the -14 LUFS TikTok plays at |
| true peak | PASS | -1.9 dBTP |
| clipping | PASS | no sample reaches full scale |
| silence | PASS | no dead silence |
| pauses | PASS | no pause of 2.5 s or more |
| black frames | PASS | none |
| frozen frames | PASS | none (the last 0.4 s hold one frame, as an end card does) |
| flashes | PASS | no rapid flashing |
| colour | PASS | darkest 5, middle 66, brightest 195 (of 255), colour 0.38; judged on the picture alone: give source= to check an HDR clip was converted |
| safe zone | SKIP | not measured: give source= (the clip it was made from) and anything added outside the safe zone is found |

The contact sheet `sfx-demo.qc.jpg` shows the frames that matter, with the safe zone (dashed) and the face box (yellow) drawn; anything in the video over the face that is not in the source is tinted red.

Checked (no source given: the face and the safe zone were not measured against it) in 9.2 s. The video was not changed.

The video checked: 17156215 bytes, sha256 f2618f8ddc2a.
