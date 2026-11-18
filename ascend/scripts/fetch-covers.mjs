// Downloads each book's real cover from Open Library (covers.openlibrary.org), matched by title and author.
import { writeFileSync, existsSync } from 'node:fs'
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
const get = (url) => execFileSync('curl', ['-sfL', '--max-time', '40', url], { maxBuffer: 1 << 26 })
const out = await build({ entryPoints: ['src/content/index.ts'], bundle: true, format: 'esm', write: false, platform: 'node' })
const { books } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
const override = { 'intelligent-investor': 'The Intelligent Investor', influence: 'Influence', 'courage-to-be-disliked': 'The Courage to Be Disliked', meditations: 'Meditations', 'seven-habits': 'The 7 Habits of Highly Effective People', 'e-myth-revisited': 'The E-Myth Revisited', mindset: 'Mindset' }
const report = []
for (const b of books) {
  const file = `public/covers/${b.id}.jpg`
  if (existsSync(file)) continue
  const title = override[b.id] ?? b.originalTitle.split(':')[0]
  const author = b.authorEn.split(/&| et al/)[0].trim().split(' ').pop()
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=10&fields=title,cover_i,edition_count`
  const docs = JSON.parse(get(url).toString()).docs.filter((d) => d.cover_i)
  const want = norm(title)
  docs.sort((a, b) => (norm(b.title) === want) - (norm(a.title) === want) || (b.edition_count ?? 0) - (a.edition_count ?? 0))
  const pick = docs[0]
  if (!pick) {
    report.push(`${b.id}: NOT FOUND`)
    continue
  }
  writeFileSync(file, get(`https://covers.openlibrary.org/b/id/${pick.cover_i}-L.jpg`))
  report.push(`${b.id}: "${pick.title}" cover ${pick.cover_i}`)
}
console.log(report.join('\n'))
