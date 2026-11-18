// Collects the renderer's per-file timings into one manifest the app imports.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
const dir = 'public/audio'
const manifest = {}
if (existsSync(dir))
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const id = f.slice(0, -5)
    if (!existsSync(`${dir}/${id}.mp3`)) continue
    const m = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))
    manifest[id] = { d: m.duration, s: m.segments.map((x) => x.t) }
  }
writeFileSync('src/content/audioManifest.json', JSON.stringify(manifest))
console.log(Object.keys(manifest).length, 'narrated tracks')
