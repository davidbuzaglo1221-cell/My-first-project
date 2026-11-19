import { build } from 'esbuild'
const out = await build({ entryPoints: ['src/content/index.ts'], bundle: true, format: 'esm', write: false, platform: 'node' })
const { books } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const cat = process.argv[2]
for (const b of books.filter((x) => x.category === cat)) {
  console.log(`## ${b.id}`)
  for (const l of b.lessons) console.log(`${l.id} | ${l.title} | ${l.takeaway}`)
}
