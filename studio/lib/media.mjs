// Media helpers: download a remote file, prove it is a real playable MP4, measure it.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

export async function download(url, dest, { headers = {}, fetchImpl = fetch } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetchImpl(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`download ${res.status} from ${new URL(url).host}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return dest;
}

/** ffprobe the file. Throws unless it has a real video stream and a positive duration. */
export async function probe(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const j = JSON.parse(stdout);
  const v = (j.streams || []).find(s => s.codec_type === 'video');
  const a = (j.streams || []).find(s => s.codec_type === 'audio');
  const duration = parseFloat(j.format?.duration || v?.duration || 0);
  if (!v || !(duration > 0)) throw new Error('not a playable video');
  const [n, d] = String(v.avg_frame_rate || v.r_frame_rate || '0/1').split('/').map(Number);
  return {
    width: v.width, height: v.height, duration: +duration.toFixed(2), fps: d ? +(n / d).toFixed(2) : 0,
    codec: v.codec_name, hasAudio: !!a, sizeBytes: +j.format.size, format: j.format.format_name,
  };
}

/** A rough, honest technical quality score 0-100 (resolution, fps, bitrate, audio). Not a taste judgement. */
export function techScore(p) {
  const short = Math.min(p.width, p.height);
  const res = short >= 1080 ? 40 : short >= 720 ? 28 : short >= 480 ? 15 : 5;
  const fps = p.fps >= 29 ? 20 : p.fps >= 23 ? 15 : 8;
  const kbps = p.duration ? (p.sizeBytes * 8 / 1000) / p.duration : 0;
  const br = kbps >= 4000 ? 25 : kbps >= 2000 ? 18 : kbps >= 1000 ? 12 : 6;
  const au = p.hasAudio ? 15 : 0;
  return res + fps + br + au;
}

export async function thumbnail(file, dest, at = 1) {
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', file, '-frames:v', '1', '-vf', 'scale=540:-2', dest]);
  return dest;
}

export { run };
