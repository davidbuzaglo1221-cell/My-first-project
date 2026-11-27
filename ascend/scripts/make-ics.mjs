// Builds public/remind/HHMM.ics: one calendar event a day for the next 120 days at that time, each with a
// different message (the idea of the day, the challenge of the day, today's practice) and an alert + link back.
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
const out = await build({ entryPoints: ['src/lib/daily.ts'], bundle: true, format: 'esm', write: false, platform: 'node', loader: { '.json': 'json' } })
const { ideaOfDay, challengeOfDay } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const URL = 'https://davidbuzaglo1221-cell.github.io/My-first-project/'
const TIMES = ['0730', '0830', '1230', '1830', '2030', '2130', '2230']
const DAYS = 120
const enc = new TextEncoder()
// RFC 5545: escape, and fold lines at 75 octets without splitting a character.
const esc = (t) => t.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
const fold = (line) => {
  const parts = []; let cur = ''
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (parts.length ? 74 : 75)) { parts.push(cur); cur = ch } else cur += ch
  }
  parts.push(cur)
  return parts.join('\r\n ')
}
const pad = (n) => String(n).padStart(2, '0')
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const now = new Date()
const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
const HEADS = (idea) => [`הרעיון של היום: ${idea.h}`, 'שמעת היום פרק? כמה דקות בספריה', 'התרגול של היום מחכה לך', `${idea.bookTitle}: רעיון אחד להיום`, 'התקדמת היום מספיק? צעד קטן אחד']
mkdirSync('public/remind', { recursive: true })
for (const t of TIMES) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HaSifria//Daily//HE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:הספריה', 'X-WR-TIMEZONE:Asia/Jerusalem']
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    const idea = ideaOfDay(d), ch = challengeOfDay(d)
    const heads = HEADS(idea)
    const summary = `הספריה · ${heads[i % heads.length]}`
    const desc = `הרעיון של היום מתוך "${idea.bookTitle}": ${idea.h}.\nהאתגר של היום: ${ch.text}\n\nשלושה צעדים קטנים: תרגול, פרק אחד, ורעיון אחד.\n${URL}`
    lines.push('BEGIN:VEVENT', `UID:hasifria-${stamp(d)}-${t}@hasifria`, `DTSTAMP:${dtstamp}`, `DTSTART:${stamp(d)}T${t}00`, 'DURATION:PT10M',
      fold(`SUMMARY:${esc(summary)}`), fold(`DESCRIPTION:${esc(desc)}`), `URL:${URL}`, 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${esc(summary)}`), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  writeFileSync(`public/remind/${t}.ics`, lines.join('\r\n') + '\r\n')
}
console.log(`${TIMES.length} reminder calendars, ${DAYS} days each`)
