// Lists which books have a real cover image in public/covers, for the app to prefer over generated art.
import { readdirSync, writeFileSync, existsSync } from 'node:fs'
const ids = existsSync('public/covers') ? readdirSync('public/covers').filter((f) => /\.(jpe?g|png)$/.test(f)).map((f) => f.replace(/\.[^.]+$/, '')) : []
writeFileSync('src/content/coversManifest.json', JSON.stringify(Object.fromEntries(ids.map((id) => [id, true]))))
console.log(ids.length, 'real covers')
