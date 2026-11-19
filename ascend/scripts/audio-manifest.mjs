// Collects rendered narration per voice (public/audio/<voice>/<id>.mp3 + .json) into one manifest for the app.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
const dir = 'public/audio'
const manifest = {}
if (existsSync(dir))
  for (const voice of readdirSync(dir).filter((d) => statSync(`${dir}/${d}`).isDirectory())) {
    const tracks = {}
    for (const f of readdirSync(`${dir}/${voice}`).filter((f) => f.endsWith('.json'))) {
      const id = f.slice(0, -5)
      if (!existsSync(`${dir}/${voice}/${id}.mp3`)) continue
      const m = JSON.parse(readFileSync(`${dir}/${voice}/${f}`, 'utf8'))
      // One file per book: every chapter points into it with its offset.
      if (m.tracks) for (const [tid, t] of Object.entries(m.tracks)) tracks[tid] = { f: id, o: t.o, d: t.d, s: t.s }
      else tracks[id] = { d: m.duration, s: m.segments.map((x) => x.t) }
    }
    if (Object.keys(tracks).length) manifest[voice] = tracks
  }
writeFileSync('src/content/audioManifest.json', JSON.stringify(manifest))
console.log(Object.entries(manifest).map(([v, t]) => `${v}: ${Object.keys(t).length}`).join(', ') || 'no narration')
