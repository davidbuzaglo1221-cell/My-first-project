import { build } from 'esbuild'
const out = await build({ entryPoints: ['src/content/index.ts'], bundle: true, format: 'esm', write: false, platform: 'node' })
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
let tot=0
for (const b of mod.books) { const w = b.lessons.reduce((s,l)=>s+l.script.split(/\s+/).length,0); tot+=w; console.log(b.category, b.id, b.lessons.length, w, b.title) }
console.log('total words', tot)
