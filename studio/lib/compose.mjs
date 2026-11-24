// Assembly and finishing with ffmpeg: aspect conversion, kinetic Hebrew captions (libass + fribidi),
// narration (edge-tts), music ducked under the voice, loudness for social, MP4 with faststart.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, probe } from './media.mjs';
import { ASPECTS, STYLES } from './planner.mjs';
import { VOICES, NARRATOR_VOICE, imagePath } from './characters.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const FONTS_DIR = path.join(ROOT, 'assets', 'fonts');
export const MUSIC_DIR = path.join(ROOT, 'assets', 'music');
const FF = ['-v', 'error', '-y'];
const ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-maxrate', '9M', '-bufsize', '18M', '-pix_fmt', 'yuv420p', '-r', '30'];
const ENC_FAST = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30'];
const AENC = ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000'];

// Per-style palettes for the local engine: dark base, one warm or cool accent.
const PALETTES = {
  graphite: [['0x0a0a0c', '0x2a2a33', '0x070708'], ['0x0b0a0e', '0x34303f', '0x070709'], ['0x09090b', '0x22262e', '0x060607']],
  violet: [['0x0c0814', '0x3b1f6b', '0x07050c'], ['0x0a0812', '0x2b1a5a', '0x060409'], ['0x0e0916', '0x52267a', '0x08050c']],
  magenta: [['0x12081a', '0x6b1f6b', '0x09050c'], ['0x0c0814', '0x4a1f7b', '0x07050c'], ['0x140a12', '0x7a2a5a', '0x0a0509']],
};

const esc = s => String(s).replace(/\\/g, '\\\\').replace(/[{}]/g, '').replace(/\n/g, '\\N');
const ts = t => { const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = (t % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${s}`; };

/** Kinetic captions as ASS. Hook is big and centred; beats sit in the lower third, safe from app UI. */
export function captionsAss(scenes, aspect, { font = 'Heebo Black', serif = 'Frank Ruhl Libre Bold' } = {}) {
  const [W, H] = ASPECTS[aspect];
  const base = Math.round(Math.min(W, H) * (aspect === '9:16' ? 0.085 : 0.07));
  const marginV = Math.round(H * (aspect === '9:16' ? 0.24 : 0.12));
  const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Beat,${font},${base},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,0,${Math.round(base * 0.06)},2,${Math.round(W * 0.08)},${Math.round(W * 0.08)},${marginV},177\nStyle: Hook,${serif},${Math.round(base * 1.35)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,0,${Math.round(base * 0.08)},5,${Math.round(W * 0.08)},${Math.round(W * 0.08)},0,177\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  let t = 0; const ev = [];
  for (const s of scenes) {
    const st = t + 0.04, en = t + s.durationSec - 0.06; t += s.durationSec;
    if (!s.caption) continue;
    const style = s.role === 'hook' ? 'Hook' : 'Beat';
    // Pop in (scale 82 -> 100 in 140 ms), quick fade out: reads like a hand edit, not a slideshow.
    const fx = `{\\fad(60,90)\\fscx82\\fscy82\\t(0,140,\\fscx100\\fscy100)}`;
    // In a dialogue, a small violet name above the line says who speaks.
    const name = s.speaker && s.speaker !== 'narrator' && s.role !== 'hook' ? `{\\fs${Math.round(base * 0.62)}\\c&HFDB5C4&}${esc(s.speakerName)}\\N{\\r}` : '';
    // Over a character, the hook moves to the top third so it never covers the face.
    const pos = s.role === 'hook' && s.onImage ? `{\\an8\\pos(${Math.round(W / 2)},${Math.round(H * 0.13)})}` : '';
    ev.push(`Dialogue: 0,${ts(st)},${ts(en)},${style},,0,0,0,,${pos}${fx}${name}${esc(s.caption)}`);
  }
  return head + ev.join('\n') + '\n';
}

/** Narration per scene. Returns { files[], durations[] } or null when TTS is unreachable. */
export async function narrate(scenes, dir, { voice = 'en-US-BrianMultilingualNeural', rate = '+12%' } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  // Every character speaks with its own voice; the narrator keeps the house voice.
  const items = scenes.map((s, i) => { const v = VOICES[s.voice] || VOICES[NARRATOR_VOICE]; return { text: s.narration, voice: v.voice, rate: v.rate, pitch: v.pitch, out: path.join(dir, `vo_${String(i).padStart(2, '0')}.mp3`) }; }).filter(x => x.text);
  const jobFile = path.join(dir, 'tts.json');
  fs.writeFileSync(jobFile, JSON.stringify({ voice, rate, items }));
  try {
    const { stdout } = await run('python3', [path.join(ROOT, 'lib', 'tts.py'), jobFile], { timeout: 180000, env: { ...process.env, SSL_CERT_FILE: process.env.SSL_CERT_FILE || (fs.existsSync('/root/.ccr/ca-bundle.crt') ? '/root/.ccr/ca-bundle.crt' : undefined) } });
    const r = JSON.parse(stdout.trim().split('\n').pop());
    if (!r.ok) return null;
    return { files: items.map(i => i.out), durations: r.durations };
  } catch { return null; }
}

/** Keep the requested length: drop middle beats (never the hook or the call to action) while narration runs long. */
export function trimToTarget(scenes, vo, targetSec, tolerance = 1.12) {
  if (!vo) return { scenes, vo };
  let sc = scenes.map((s, i) => ({ s, f: vo.files[i], d: vo.durations[i] }));
  const total = () => sc.reduce((a, x) => a + Math.max(x.s.durationSec * 0.6, x.d + 0.25, 1), 0);
  while (sc.length > 3 && total() > targetSec * tolerance) sc.splice(sc.length - 2, 1);
  return { scenes: sc.map(x => x.s), vo: { files: sc.map(x => x.f), durations: sc.map(x => x.d) } };
}

/** Fit scene durations to narration: each scene lasts at least its line + a breath. */
export function fitDurations(scenes, voDur, targetSec) {
  const out = scenes.map((s, i) => ({ ...s, durationSec: Math.max(s.durationSec * 0.6, (voDur?.[i] || 0) + 0.25, 1.0) }));
  const total = out.reduce((a, s) => a + s.durationSec, 0);
  if (!voDur && targetSec) { const k = targetSec / total; out.forEach(s => { s.durationSec = +(s.durationSec * k).toFixed(2); }); }
  return out.map(s => ({ ...s, durationSec: +s.durationSec.toFixed(2) }));
}

/** The audio bed: narration placed at scene starts + looped music ducked under it, -14 LUFS. */
async function mixAudio({ scenes, vo, music, totalSec, out }) {
  const inputs = []; const parts = []; let idx = 0;
  if (vo) {
    let t = 0;
    scenes.forEach((s, i) => { if (vo.files[i]) { inputs.push('-i', vo.files[i]); parts.push(`[${idx}:a]adelay=${Math.round((t + 0.08) * 1000)}|${Math.round((t + 0.08) * 1000)},aformat=channel_layouts=stereo[v${idx}]`); idx++; } t += s.durationSec; });
  }
  const voCount = idx;
  let musicIdx = -1;
  if (music && fs.existsSync(music)) { inputs.push('-stream_loop', '-1', '-i', music); musicIdx = idx++; }
  const f = [...parts];
  const fadeStart = Math.max(0, totalSec - 1.2).toFixed(2);
  if (voCount) f.push(`${Array.from({ length: voCount }, (_, i) => `[v${i}]`).join('')}amix=inputs=${voCount}:normalize=0,apad[vo]`);
  if (musicIdx >= 0) f.push(`[${musicIdx}:a]atrim=0:${totalSec},aformat=channel_layouts=stereo,volume=${voCount ? 0.5 : 0.9},afade=t=out:st=${fadeStart}:d=1.2[mu]`);
  if (voCount && musicIdx >= 0) {
    f.push('[vo]asplit[vo1][vo2]', '[mu][vo1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[duck]', '[duck][vo2]amix=inputs=2:normalize=0[mix]');
  } else if (voCount) f.push('[vo]anull[mix]'); else if (musicIdx >= 0) f.push('[mu]anull[mix]'); else return null;
  f.push(`[mix]atrim=0:${totalSec},loudnorm=I=-14:TP=-1.5:LRA=9[aout]`);
  await run('ffmpeg', [...FF, ...inputs, '-filter_complex', f.join(';'), '-map', '[aout]', ...AENC, out], { timeout: 300000 });
  return out;
}

const vfFit = (W, H) => `split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=40:2,eq=brightness=-0.12[bg];[b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`;

/** Convert any clip to the target canvas. Same aspect -> scale+crop; different -> blurred fill behind the full frame. */
export async function toAspect(input, output, aspect) {
  const [W, H] = ASPECTS[aspect];
  const p = await probe(input);
  const same = Math.abs(p.width / p.height - W / H) < 0.03;
  const vf = same ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1` : vfFit(W, H);
  const audio = p.hasAudio ? ['-map', '0:a:0', ...AENC] : ['-an'];
  await run('ffmpeg', [...FF, '-i', input, '-filter_complex', `[0:v]${vf}[v]`, '-map', '[v]', ...audio, ...ENC, '-movflags', '+faststart', output], { timeout: 600000 });
  return output;
}

/** The free local engine: programmed motion (not generative AI) — moving light, grain, kinetic Hebrew type. */
export async function renderLocal(planObj, { aspect, work, out, withVoice = true, onProgress = () => {} }) {
  const [W, H] = ASPECTS[aspect];
  fs.mkdirSync(work, { recursive: true });
  onProgress(10, 'קריינות');
  const t = trimToTarget(planObj.scenes, withVoice ? await narrate(planObj.scenes, path.join(work, 'vo')) : null, planObj.brief.lengthSec);
  const vo = t.vo;
  const pal = PALETTES[STYLES[planObj.brief.style]?.palette] || PALETTES.violet;
  const castImg = Object.fromEntries((planObj.cast || []).map(c => [c.id, imagePath(c)]).filter(([, p]) => p && fs.existsSync(p)));
  const scenes = fitDurations(t.scenes, vo?.durations, planObj.brief.lengthSec).map(s => ({ ...s, onImage: !!castImg[s.speaker] }));
  onProgress(30, 'רקעים');
  const segs = [];
  await Promise.all(scenes.map(async (s, i) => {
    const [c0, c1, c2] = pal[i % pal.length];
    const seg = path.join(work, `seg_${String(i).padStart(2, '0')}.mp4`);
    const zoom = i % 2 ? 'scale=iw*1.08:-1,crop=' + W + ':' + H : 'scale=iw*1.04:-1,crop=' + W + ':' + H;
    const img = castImg[s.speaker];
    const frames = Math.max(1, Math.round(s.durationSec * 30));
    if (img) {
      // The speaker's reference image, with a slow push and a small talking bounce. Programmed motion, not lip sync.
      await run('ffmpeg', [...FF, '-loop', '1', '-i', img, '-vf', `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='1.03+0.0009*on+0.012*abs(sin(on*0.55))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=30,eq=brightness=-0.04,vignette=PI/5,format=yuv420p`,
        ...ENC_FAST, '-frames:v', String(frames), seg], { timeout: 300000 });
    } else {
      await run('ffmpeg', [...FF, '-f', 'lavfi', '-i', `gradients=s=${W}x${H}:c0=${c0}:c1=${c1}:c2=${c2}:nb_colors=3:speed=${0.012 + (i % 3) * 0.008}:duration=${s.durationSec}:rate=30:type=linear:seed=${i + 7}`,
        '-vf', `${zoom},noise=alls=4:allf=t,vignette=PI/4.5,format=yuv420p`, ...ENC_FAST, '-t', String(s.durationSec), seg], { timeout: 300000 });
    }
    segs[i] = seg;
  }));
  const list = path.join(work, 'segs.txt');
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  const silent = path.join(work, 'video.mp4');
  await run('ffmpeg', [...FF, '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
  onProgress(70, 'כתוביות ומוזיקה');
  return finishWith({ video: silent, scenes, vo, planObj, aspect, work, out, burnCaptions: true });
}

/** Stitch raw generated clips (Seedance, Korpi) into one edit with captions, narration and music. */
export async function assembleClips(clipFiles, planObj, { aspect, work, out, withVoice = true, keepClipAudio = false, onProgress = () => {} }) {
  fs.mkdirSync(work, { recursive: true });
  const norm = [];
  for (const [i, c] of clipFiles.entries()) { const o = path.join(work, `n_${i}.mp4`); await toAspect(c, o, aspect); norm.push(o); }
  // Each scene keeps its clip; clips are trimmed or held to the scene length.
  const t = trimToTarget(planObj.scenes, withVoice ? await narrate(planObj.scenes, path.join(work, 'vo')) : null, planObj.brief.lengthSec);
  const vo = t.vo;
  const scenes = fitDurations(t.scenes, vo?.durations, planObj.brief.lengthSec);
  const segs = [];
  for (const [i, s] of scenes.entries()) {
    const src = norm[i % norm.length]; const seg = path.join(work, `cs_${i}.mp4`);
    // Lip-synced clips keep their own speech; others are silent and get our voices.
    const aud = keepClipAudio && (await probe(src)).hasAudio ? ['-map', '0:v', '-map', '0:a', ...AENC] : ['-an'];
    await run('ffmpeg', [...FF, '-stream_loop', '-1', '-i', src, '-t', String(s.durationSec), ...aud, ...ENC_FAST, seg]);
    segs.push(seg);
  }
  const list = path.join(work, 'segs.txt');
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  const silent = path.join(work, 'video.mp4');
  await run('ffmpeg', [...FF, '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
  onProgress(80, 'כתוביות ומוזיקה');
  return finishWith({ video: silent, scenes, vo, planObj, aspect, work, out, burnCaptions: true, clipAudio: keepClipAudio });
}

/** Final pass for a finished engine video: right aspect, keep its own voice/music, loudness, faststart. */
export async function finishEngineVideo(input, { aspect, out, work }) {
  fs.mkdirSync(work, { recursive: true });
  const tmp = path.join(work, 'aspect.mp4');
  await toAspect(input, tmp, aspect);
  const p = await probe(tmp);
  if (p.hasAudio) await run('ffmpeg', [...FF, '-i', tmp, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9', ...AENC, '-movflags', '+faststart', out]);
  else fs.copyFileSync(tmp, out);
  return out;
}

async function finishWith({ video, scenes, vo, planObj, aspect, work, out, burnCaptions, clipAudio = false }) {
  const total = +scenes.reduce((a, s) => a + s.durationSec, 0).toFixed(2);
  const music = path.join(MUSIC_DIR, `${planObj.music || 'cinematic'}.m4a`);
  let audio = await mixAudio({ scenes, vo, music, totalSec: total, out: path.join(work, 'mix.m4a') });
  if (clipAudio && audio) {
    // Speech from the clips on top, music ducked under it.
    const both = path.join(work, 'mix2.m4a');
    await run('ffmpeg', [...FF, '-i', video, '-i', audio, '-filter_complex', '[0:a]asplit[s1][s2];[1:a][s1]sidechaincompress=threshold=0.03:ratio=8[d];[d][s2]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5[a]', '-map', '[a]', ...AENC, both]);
    audio = both;
  }
  const assFile = path.join(work, 'captions.ass');
  fs.writeFileSync(assFile, captionsAss(scenes, aspect));
  const vf = burnCaptions ? `ass=${assFile}:fontsdir=${FONTS_DIR}` : 'null';
  const args = [...FF, '-i', video, ...(audio ? ['-i', audio] : []), '-vf', vf, '-map', '0:v', ...(audio ? ['-map', '1:a', ...AENC] : []), ...ENC, '-t', String(total), '-movflags', '+faststart', out];
  await run('ffmpeg', args, { timeout: 600000 });
  return { out, scenes, narrated: !!vo };
}
