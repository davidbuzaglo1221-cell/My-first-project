// Command line for Claude (chat) and for scripts.
//   node cli.mjs check                         -> test every connection and print the savings table
//   node cli.mjs quote "רעיון" [--len 30 --style cinematic --aspect 9:16]
//   node cli.mjs make  "רעיון" [--engines auto|vaideo,local] [--plan plan.json] [--approve vaideo=0.3]
// Paid generation is refused unless --approve <engine>=<max amount> is given — and that is only ever passed after David said yes.
import { overview, quote, startJob, getJob } from './lib/studio.mjs';
import fs from 'node:fs';

const [, , cmd, ...rest] = process.argv;
const args = {}; const pos = [];
for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) args[rest[i].slice(2)] = rest[i + 1]?.startsWith('--') || rest[i + 1] === undefined ? true : rest[++i]; else pos.push(rest[i]); }
const opts = { lengthSec: +(args.len || 30), style: args.style || 'cinematic', aspect: args.aspect || '9:16' };

if (cmd === 'check') {
  const rows = await overview({ fresh: true });
  for (const r of rows) {
    const s = r.status;
    console.log(`${s.connected ? '✓' : '✗'} ${r.name.padEnd(18)} ${s.connected ? `קרדיטים: ${s.credits ?? '—'} | תוכנית: ${s.plan ?? '—'}` : s.note} | מכסה חינמית: ${r.freeGrant ?? 'ללא הגבלה'} | נוצלו: ${r.ledger.spentCredits || 0}`);
  }
} else if (cmd === 'quote') {
  const q = await quote(pos.join(' '), opts);
  console.log(JSON.stringify({ auto: q.auto, engines: q.engines.map(e => ({ id: e.id, decision: e.decision, estimate: e.estimate })), scenes: q.plan.scenes.map(s => s.narration) }, null, 2));
} else if (cmd === 'make') {
  const approval = {};
  if (args.approve) for (const a of String(args.approve).split(',')) { const [k, v] = a.split('='); approval[k] = v === '?' ? { unknownPrice: true } : { maxMoney: +v }; }
  const planOverride = args.plan ? JSON.parse(fs.readFileSync(args.plan, 'utf8')) : null;
  const engines = !args.engines || args.engines === 'auto' ? 'auto' : String(args.engines).split(',');
  const r = await startJob({ idea: pos.join(' '), ...opts, engines, approval, planOverride });
  if (r.needsApproval) { console.log(JSON.stringify({ needsApproval: r.needsApproval }, null, 2)); process.exit(2); }
  const id = r.job.id; let last = '';
  for (;;) {
    const j = getJob(id);
    const line = j.engines.map(e => `${e.id}:${e.state}:${e.progress}%`).join('  ');
    if (line !== last) { console.log(line); last = line; }
    if (j.state !== 'running') { console.log(JSON.stringify({ id, state: j.state, winner: j.winner, results: j.engines.map(e => ({ id: e.id, state: e.state, error: e.error, file: e.result?.file, probe: e.result?.probe, score: e.result?.score, money: e.result?.money })) }, null, 2)); break; }
    await new Promise(r => setTimeout(r, 3000));
  }
} else {
  console.log('usage: node cli.mjs check | quote "idea" | make "idea" [--engines ..] [--approve engine=max]');
}
