// Keeps the files of the last few published versions on the site.
// A phone that still holds an older copy of the page can then finish loading it, and switch to the new
// version on the next open, instead of showing a black screen while the files it asks for are gone.
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

const SITE = process.env.SITE_URL || 'https://davidbuzaglo1221-cell.github.io/My-first-project/'
const KEEP = 3
const dist = new URL('../dist/', import.meta.url).pathname
const current = readdirSync(dist + 'assets').filter((f) => /\.(js|css)$/.test(f))

let history = []
try {
  const r = await fetch(SITE + 'assets-history.json', { cache: 'no-store' })
  if (r.ok) history = await r.json()
} catch {}
try {
  const html = await (await fetch(SITE, { cache: 'no-store' })).text()
  const live = [...html.matchAll(/assets\/([\w.-]+\.(?:js|css))/g)].map((m) => m[1])
  if (live.length && !history.some((v) => v.join() === live.join())) history.push(live)
} catch (e) {
  console.log('live site not reachable, nothing to keep:', e.message)
}
history = history.filter((v) => v.join() !== current.join()).slice(-KEEP)
mkdirSync(dist + 'assets', { recursive: true })
let kept = 0
for (const f of new Set(history.flat())) {
  if (existsSync(dist + 'assets/' + f)) continue
  try {
    const r = await fetch(SITE + 'assets/' + f)
    if (!r.ok) continue
    await writeFile(dist + 'assets/' + f, Buffer.from(await r.arrayBuffer()))
    kept++
  } catch {}
}
writeFileSync(dist + 'assets-history.json', JSON.stringify([...history, current]))
console.log(`kept ${kept} files from ${history.length} earlier versions`)
