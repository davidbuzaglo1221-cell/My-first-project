// Exports the guided practices for the narration renderer.
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
const out = await build({ entryPoints: ['src/content/calm.ts'], bundle: true, format: 'esm', write: false, platform: 'node' })
const { meditations, programPractices } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const items = [...meditations, ...programPractices].map((m) => ({ id: m.id, lines: m.script.split('\n').map((l) => l.trim()).filter(Boolean) }))
writeFileSync('/home/user/tts/calm.json', JSON.stringify(items))
console.log(items.length, 'practices')
