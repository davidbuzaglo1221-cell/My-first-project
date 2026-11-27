// The daily sender: runs every hour (GitHub Actions). Keeps its own VAPID key and the subscriber list in a private
// state folder (restored from the Actions cache), picks up new subscriptions from the relay topic, and at each
// subscriber's chosen hours sends the message of the day: a situation, a question, a nudge.
// Usage: node scripts/push/send.mjs [--test]   (state dir: PUSH_STATE, default .push-state)
import { build } from 'esbuild'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import webpush from 'web-push'

const STATE = process.env.PUSH_STATE || '.push-state'
const RELAY = process.env.PUSH_RELAY || 'https://ntfy.sh/hamasa-b6yabftyvx7gkkn2chriyk'
const TEST = process.argv.includes('--test')
const NOW = process.env.PUSH_NOW ? new Date(process.env.PUSH_NOW) : new Date()
mkdirSync(STATE, { recursive: true })
const read = (f, d) => (existsSync(`${STATE}/${f}`) ? JSON.parse(readFileSync(`${STATE}/${f}`, 'utf8')) : d)
const write = (f, v) => writeFileSync(`${STATE}/${f}`, JSON.stringify(v, null, 1))

// 1. The key: created once, kept private in the state folder; only the public half is published with the app.
let keys = read('vapid.json', null)
if (!keys) {
  keys = webpush.generateVAPIDKeys(); write('vapid.json', keys)
  console.log('created a new VAPID key')
}
mkdirSync('public/push', { recursive: true })
const pub = JSON.stringify({ publicKey: keys.publicKey }) + '\n'
if (!existsSync('public/push/vapid.json') || readFileSync('public/push/vapid.json', 'utf8') !== pub) {
  writeFileSync('public/push/vapid.json', pub); console.log('PUBLIC_KEY_CHANGED')
}
webpush.setVapidDetails('https://davidbuzaglo1221-cell.github.io/My-first-project/', keys.publicKey, keys.privateKey)

// 2. New subscribers from the relay (it keeps messages for hours; we run every hour).
const subs = read('subs.json', {})
if (!process.env.PUSH_SKIP_RELAY) {
  try {
    const txt = await fetch(`${RELAY}/json?poll=1&since=all`).then((r) => r.text())
    for (const line of txt.split('\n').filter(Boolean)) {
      try {
        const m = JSON.parse(line); if (m.event !== 'message') continue
        const v = JSON.parse(m.message); const ep = v?.sub?.endpoint
        if (!ep || !v.sub.keys?.p256dh || !v.sub.keys?.auth) continue
        const prev = subs[ep]
        if (!prev || (prev.t ?? 0) < m.time) subs[ep] = { sub: v.sub, hours: (v.hours ?? [9, 21]).slice(0, 3), tz: v.tz || 'Asia/Jerusalem', sent: prev?.sent ?? {}, t: m.time }
      } catch {}
    }
  } catch (e) { console.log('relay unavailable:', e.message) }
}

// 3. Today's messages, from the same content the app shows.
const out = await build({ entryPoints: ['src/content/nudges.ts'], bundle: true, format: 'esm', write: false, platform: 'node', loader: { '.json': 'json' } })
const { morningNudge, eveningNudge } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

const local = (tz) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(NOW).map((x) => [x.type, x.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), date: new Date(Number(p.year), Number(p.month) - 1, Number(p.day)) }
}
let sent = 0, gone = 0
for (const [ep, s] of Object.entries(subs)) {
  const L = local(s.tz)
  for (const [slot, hour] of s.hours.entries()) {
    // Send at the chosen hour, or within three hours after it if a run was late; once per slot per day.
    const due = TEST ? slot === 0 : L.hour >= hour && L.hour < hour + 3 && s.sent[slot] !== L.day
    if (!due) continue
    const n = slot === 0 ? morningNudge(L.date) : eveningNudge(L.date)
    const payload = JSON.stringify({ title: TEST ? 'בדיקה: ' + n.title : n.title, body: n.body, url: n.url, tag: `daily-${slot}` })
    try {
      await webpush.sendNotification(s.sub, payload, { TTL: 6 * 3600, urgency: 'normal' })
      if (!TEST) s.sent[slot] = L.day
      sent++
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { delete subs[ep]; gone++; break }
      console.log('send failed', e.statusCode || e.message)
    }
  }
}
write('subs.json', subs)
console.log(`subscribers ${Object.keys(subs).length}, sent ${sent}, removed ${gone}`)
