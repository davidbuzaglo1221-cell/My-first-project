import type { Reminder } from './store'

const pad = (n: number) => String(n).padStart(2, '0')
const DAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** A calendar file with a repeating event and an alert, so the phone itself reminds you, even when the app is closed. */
export function reminderIcs(r: Reminder) {
  const [h, m] = r.time.split(':').map(Number)
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
  if (start < now) start.setDate(start.getDate() + 1)
  const local = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
  const end = new Date(start.getTime() + 10 * 60000)
  const days = r.days.length === 7 || !r.days.length ? '' : `;BYDAY=${r.days.map((d) => DAY[d]).join(',')}`
  const text = r.text.replace(/[,;\\]/g, ' ')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HaSifria//Reminders//HE',
    'BEGIN:VEVENT',
    `UID:${r.id}@hasifria.app`,
    `DTSTAMP:${local(now)}`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(end)}`,
    `RRULE:FREQ=${days ? 'WEEKLY' : 'DAILY'}${days}`,
    `SUMMARY:${text}`,
    'DESCRIPTION:תזכורת מ-הספריה',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${text}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

/** Is a reminder due at this minute? */
export function dueNow(r: Reminder, d = new Date()) {
  return r.on && (r.days.length === 0 || r.days.includes(d.getDay())) && r.time === `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** A soft two-note chime, made in the page. */
export function chime(volume = 0.18) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[523.25, 784].forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const t = ctx.currentTime + i * 0.28
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(volume, t + 0.04)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 1.7)
    })
    setTimeout(() => ctx.close(), 2400)
  } catch {
    /* no audio */
  }
}
