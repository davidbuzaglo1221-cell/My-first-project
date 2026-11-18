// Exports every narration script (lessons and one-minute summaries) as JSON for the audio renderer.
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
const out = await build({ entryPoints: ['src/content/index.ts'], bundle: true, format: 'esm', write: false, platform: 'node' })
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const { toSegments } = await import(
  'data:text/javascript;base64,' + Buffer.from((await build({ entryPoints: ['src/engine/sentences.ts'], bundle: true, format: 'esm', write: false })).outputFiles[0].text).toString('base64')
)
const items = []
for (const b of mod.books) {
  for (const l of b.lessons) items.push({ id: l.id, paras: l.script.split(/\n+/).map((p) => toSegments(p)) })
  const quick = [`${b.title}, מאת ${b.author}. ${b.tagline}`, ...b.ideas.map((i) => `${i.title}. ${i.body}`), 'זה הסיכום בדקה. כשיהיה לך זמן, השיעורים המלאים מחכים לך.']
  items.push({ id: `${b.id}-quick`, paras: quick.map((p) => toSegments(p)) })
}
// Flagship books first, so the most important lessons are ready soonest.
const first = ['psychology-of-money', 'atomic-habits', 'how-to-win-friends', 'never-split-the-difference', 'think-and-grow-rich']
const rank = (id) => { const i = first.findIndex((f) => id.startsWith(f)); return (i === -1 ? 99 : i) * 2 + (id.endsWith('-quick') ? 1 : 0) }
items.sort((a, b) => rank(a.id) - rank(b.id))
writeFileSync('/home/user/tts/scripts.json', JSON.stringify(items))
console.log(items.length, 'items')
