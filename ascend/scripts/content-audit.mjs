// Audits every chapter: structure, length, practical step, and weak spots.
import { build } from 'esbuild'
const out = await build({ entryPoints: ['src/content/index.ts'], bundle: true, format: 'esm', write: false, platform: 'node', loader: { '.json': 'json' } })
const { books } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
let generic = 0, short = [], noHabit = 0, total = 0
for (const b of books) for (const l of b.lessons) {
  total++
  const words = l.script.split(/\s+/).length
  if (l.exercise.task.startsWith('כתוב במשפט אחד מה הרעיון החשוב')) generic++
  if (!l.exercise.habit) noHabit++
  if (words < 70) short.push(`${l.id}(${words})`)
}
console.log({ books: books.length, chapters: total, genericTask: generic, noHabit, short: short.length })
console.log(short.slice(0, 30).join(' '))
