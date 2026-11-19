// Exports every narration script (lessons and one-minute summaries) as JSON for the audio renderer.
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
const out = await build({ entryPoints: ['src/content/index.ts'], bundle: true, format: 'esm', write: false, platform: 'node' })
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const { toSegments } = await import(
  'data:text/javascript;base64,' + Buffer.from((await build({ entryPoints: ['src/engine/sentences.ts'], bundle: true, format: 'esm', write: false })).outputFiles[0].text).toString('base64')
)
// What the narrator says: numbers and abbreviations spelled out the way a Hebrew speaker reads them.
const SPOKEN = [[/מערכת 1/g, 'מערכת אחת'], [/מערכת 2/g, 'מערכת שתיים'], [/48/g, 'ארבעים ושמונה'], [/21/g, 'עשרים ואחד'], [/\b7 /g, 'שבעה '], [/אג״ח/g, 'אגרות חוב'], [/נדל״ן/g, 'נדלן'], [/מנכ״ל/g, 'מנכל'], [/חו״ל/g, 'חוץ לארץ'], [/למד״א/g, 'למגן דוד אדום'], [/באו״ם/g, 'באום'], [/ל״כן״/g, 'לכן'], [/״/g, '']]
const spoken = (t) => SPOKEN.reduce((s, [re, to]) => s.replace(re, to), t)
const items = []
for (const b of mod.books) {
  for (const l of b.lessons) items.push({ id: l.id, paras: l.script.split(/\n+/).map((p) => toSegments(p).map(spoken)) })
  const quick = [`${b.title}, מאת ${b.author}. ${b.tagline}`, ...b.ideas.map((i) => `${i.title}. ${i.body}`), 'זה הסיכום בדקה. כשיהיה לך זמן, הספר המלא מחכה לך כאן, פרק אחר פרק.']
  items.push({ id: `${b.id}-quick`, paras: quick.map((p) => toSegments(p).map(spoken)) })
}
// Flagship books first, so the most important lessons are ready soonest.
const first = ['psychology-of-money', 'atomic-habits', 'how-to-win-friends', 'never-split-the-difference', 'think-and-grow-rich']
const rank = (id) => { const i = first.findIndex((f) => id.startsWith(f)); return (i === -1 ? 99 : i) * 2 + (id.endsWith('-quick') ? 1 : 0) }
items.sort((a, b) => rank(a.id) - rank(b.id))
writeFileSync('/home/user/tts/scripts.json', JSON.stringify(items))
// One narration file per book: its chapters in order, then the one-minute summary.
const byId = Object.fromEntries(items.map((x) => [x.id, x]))
const booksOut = mod.books.map((b) => ({ book: b.id, tracks: [...b.lessons.map((l) => byId[l.id]), byId[`${b.id}-quick`]] }))
writeFileSync('/home/user/tts/books.json', JSON.stringify(booksOut))
console.log(items.length, 'items')
