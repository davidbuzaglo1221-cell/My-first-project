import { useState } from 'react'
import { questionOfDay } from '../content/nudges'
import { addDays, dayKey, hebrewWeekday } from '../lib/dates'
import { store, useStore } from '../lib/store'
import { BackButton } from '../ui/Kit'
import { toast } from '../ui/uiState'

const MOODS = [
  { v: 1, label: 'קשה', hue: 4 },
  { v: 2, label: 'לא משהו', hue: 28 },
  { v: 3, label: 'בסדר', hue: 48 },
  { v: 4, label: 'טוב', hue: 120 },
  { v: 5, label: 'מעולה', hue: 156 },
]
const NONE: Record<string, { mood: number; q: string; a: string; at: number }> = {}

/** "How are you feeling?": a mood, the question of the day, an answer for yourself, and the last two weeks. */
export function Checkin() {
  const all = useStore((s) => s.checkins) ?? NONE
  const k = dayKey()
  const today = all[k]
  const q = questionOfDay()
  const [mood, setMood] = useState(today?.mood ?? 0)
  const [a, setA] = useState(today?.a ?? '')
  const save = () => {
    store.set((s) => ({ checkins: { ...s.checkins, [k]: { mood, q, a: a.trim(), at: Date.now() } } }), { immediate: true })
    toast('נשמר. תודה שעצרת לרגע')
  }
  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i - 13))
  const filled = days.filter((d) => all[dayKey(d)]).length
  const avg = filled ? days.reduce((x, d) => x + (all[dayKey(d)]?.mood ?? 0), 0) / filled : 0
  return (
    <div className="screen checkin">
      <header className="page-head page-head--back">
        <BackButton fallback="/" />
        <h1 className="page-title">איך אתה מרגיש?</h1>
      </header>
      <p className="page-sub">דקה אחת ביום לעצור ולשים לב. רק בשבילך, נשמר במכשיר שלך.</p>

      <section className="ck__moods" role="radiogroup" aria-label="מצב רוח">
        {MOODS.map((m) => (
          <button key={m.v} role="radio" aria-checked={mood === m.v} className={`ck__mood ${mood === m.v ? 'is-on' : ''}`} style={{ ['--h' as string]: m.hue }} onClick={() => setMood(m.v)}>
            <i aria-hidden="true" />
            <span>{m.label}</span>
          </button>
        ))}
      </section>

      <section className="ck__q">
        <span>השאלה של היום</span>
        <h2>{q}</h2>
        <textarea value={a} onChange={(e) => setA(e.target.value)} placeholder="כמה מילים, בלי לחשוב יותר מדי" rows={4} />
        <button className="btn btn--primary btn--wide" disabled={!mood} onClick={save}>
          {today ? 'עדכון' : 'שמירה'}
        </button>
      </section>

      <section className="block">
        <h3 className="ck__h">שבועיים אחרונים</h3>
        <p className="ck__sub">{filled ? `${filled} ימים עם עצירה · ממוצע ${avg.toFixed(1)} מתוך חמש` : 'כל יום שתעצור כאן יופיע בגרף'}</p>
        <div className="ck__chart" aria-hidden="true">
          {days.map((d) => {
            const c = all[dayKey(d)]
            return (
              <span key={dayKey(d)} className="ck__col">
                <i style={{ height: `${c ? 18 + c.mood * 16 : 6}px`, ['--h' as string]: c ? MOODS[c.mood - 1].hue : 0, ...(c ? {} : { background: 'rgba(255,255,255,0.14)' }) }} />
                <small>{hebrewWeekday(d)}</small>
              </span>
            )
          })}
        </div>
        {Object.entries(all)
          .sort((x, y) => (x[0] < y[0] ? 1 : -1))
          .slice(0, 6)
          .filter(([, c]) => c.a)
          .map(([day, c]) => (
            <div key={day} className="ck__entry">
              <small>
                {day.split('-').reverse().slice(0, 2).join('.')} · {MOODS[c.mood - 1]?.label}
              </small>
              <strong>{c.q}</strong>
              <p>{c.a}</p>
            </div>
          ))}
      </section>
    </div>
  )
}
