// TITAN video studio — local server: the Hebrew UI + a small JSON API. No dependencies.
// Start: NODE_USE_ENV_PROXY=1 node server.mjs   (PORT defaults to 4747, binds to 127.0.0.1)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overview, quote, startJob, getJob, listJobs, resumeJob, deleteJob, markInterrupted, OUT } from './lib/studio.mjs';
import { listCharacters, createCharacter, updateCharacter, deleteCharacter, setCharacterImage, KINDS, VOICES, IMG_DIR } from './lib/characters.mjs';
import { CATALOG, RECOMMEND } from './lib/catalog.mjs';
import { readHistory } from './lib/ledger.mjs';
import { STYLES, ASPECTS, normStyle } from './lib/planner.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const UI = path.join(ROOT, 'ui');
const PORT = +process.env.PORT || 4747;
const HOST = process.env.HOST || '127.0.0.1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp' };

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

async function readBody(req, limit = 200_000) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new Error('בקשה גדולה מדי'); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new Error('JSON לא תקין'); }
}

function validate(b) {
  const idea = String(b.idea || '').trim();
  if (idea.length < 3 || idea.length > 2000) throw new Error('כתוב רעיון של 3 עד 2000 תווים');
  const lengthSec = Math.round(+b.lengthSec || 30);
  if (!(lengthSec >= 6 && lengthSec <= 180)) throw new Error('אורך בין 6 ל-180 שניות');
  const style = b.style === 'auto' ? 'auto' : normStyle(b.style) || 'auto';
  const cast = Array.isArray(b.cast) ? b.cast.map(String).filter(x => /^[a-f0-9]{8}$/.test(x)).slice(0, 4) : [];
  const aspect = ASPECTS[b.aspect] ? b.aspect : '9:16';
  const engines = b.engines === 'auto' || !Array.isArray(b.engines) ? 'auto' : b.engines.map(String).slice(0, 5);
  return { idea, lengthSec, style, aspect, engines, cast, lipsync: b.lipsync === true, approval: b.approval && typeof b.approval === 'object' ? b.approval : {} };
}

/** Static file with HTTP Range support, so the browser can scrub videos. Paths are confined to their root. */
function serveFile(req, res, root, rel, { download = false } = {}) {
  const file = path.resolve(root, '.' + path.sep + rel);
  if (!file.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: 'לא נמצא' });
  const size = fs.statSync(file).size;
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': type.startsWith('video') ? 'private, max-age=3600' : 'no-cache' };
  if (download) headers['Content-Disposition'] = `attachment; filename="${path.basename(file)}"`;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {
    const start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': size });
  fs.createReadStream(file).pipe(res);
}

export const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) return serveFile(req, res, UI, 'index.html');
    if (req.method === 'GET' && u.pathname.startsWith('/ui/')) return serveFile(req, res, UI, decodeURIComponent(u.pathname.slice(4)));
    if (req.method === 'GET' && u.pathname.startsWith('/files/')) return serveFile(req, res, OUT, decodeURIComponent(u.pathname.slice(7)), { download: u.searchParams.has('download') });
    if (req.method === 'GET' && u.pathname === '/api/engines') return send(res, 200, await overview({ fresh: u.searchParams.has('fresh') }));
    if (req.method === 'GET' && u.pathname.startsWith('/chars/')) return serveFile(req, res, IMG_DIR(), decodeURIComponent(u.pathname.slice(7)));
    if (req.method === 'GET' && u.pathname === '/api/options') return send(res, 200, { styles: Object.fromEntries(Object.entries(STYLES).map(([k, v]) => [k, v.he])), aspects: Object.keys(ASPECTS), kinds: KINDS, voices: Object.fromEntries(Object.entries(VOICES).map(([k, v]) => [k, v.he])) });
    if (req.method === 'GET' && u.pathname === '/api/catalog') return send(res, 200, { catalog: CATALOG, recommend: RECOMMEND });
    // Characters
    if (req.method === 'GET' && u.pathname === '/api/characters') return send(res, 200, listCharacters());
    if (req.method === 'POST' && u.pathname === '/api/characters') return send(res, 201, createCharacter(await readBody(req)));
    const cm = /^\/api\/characters\/([a-f0-9]{8})(\/image)?$/.exec(u.pathname);
    if (cm && req.method === 'PUT' && !cm[2]) return send(res, 200, updateCharacter(cm[1], await readBody(req)));
    if (cm && req.method === 'DELETE' && !cm[2]) { deleteCharacter(cm[1]); return send(res, 200, { ok: true }); }
    if (cm && req.method === 'POST' && cm[2]) return send(res, 200, setCharacterImage(cm[1], (await readBody(req, 12_000_000)).image));
    // Jobs: resume / delete
    const jm = /^\/api\/jobs\/([\w-]+)(\/resume)?$/.exec(u.pathname);
    if (jm && req.method === 'POST' && jm[2]) return send(res, 200, resumeJob(jm[1]));
    if (jm && req.method === 'DELETE' && !jm[2]) { deleteJob(jm[1]); return send(res, 200, { ok: true }); }
    if (req.method === 'GET' && u.pathname === '/api/history') return send(res, 200, readHistory().slice(-200));
    if (req.method === 'GET' && u.pathname === '/api/jobs') return send(res, 200, listJobs().slice(0, 30));
    if (req.method === 'GET' && u.pathname.startsWith('/api/jobs/')) {
      const j = getJob(u.pathname.split('/')[3]);
      return j ? send(res, 200, j) : send(res, 404, { error: 'לא נמצא' });
    }
    if (req.method === 'POST' && u.pathname === '/api/quote') {
      const b = validate(await readBody(req));
      const q = await quote(b.idea, b);
      return send(res, 200, q);
    }
    if (req.method === 'POST' && u.pathname === '/api/jobs') {
      const b = validate(await readBody(req));
      const r = await startJob(b);
      // 402: nothing was sent anywhere; the UI must ask David to approve the exact amount first.
      return r.needsApproval ? send(res, 402, r) : send(res, 201, r.job);
    }
    send(res, 404, { error: 'לא נמצא' });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = markInterrupted();
  server.listen(PORT, HOST, () => console.log(`הסטודיו פתוח: http://${HOST}:${PORT}${n ? ` (${n} יצירות נקטעו ואפשר להמשיך אותן)` : ''}`));
}
