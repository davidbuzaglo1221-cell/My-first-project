import { useState } from 'react'
import { books, lessonIndex } from '../content'
import tones from '../content/photoTones.json'
import { TOPIC_GROUPS, type Topic } from '../content/topics'
import { categoryMastery } from '../lib/insights'
import { libraryStats } from '../lib/learn'
import { ladderState, pauseStats, planFollowThrough, sleepStats } from '../lib/mastery'
import { navigate } from '../lib/router'
import { useStore, type AppState } from '../lib/store'
import { IconSearch } from '../ui/Icons'

const DAY = 86400000
const ago = (t?: number) => {
  if (!t) return undefined
  const d = Math.floor((Date.now() - t) / DAY)
  return d <= 0 ? 'היום' : d === 1 ? 'אתמול' : `לפני ${d} ימים`
}

/** What is true for this topic, from the user's own data. Nothing when there is nothing yet. */
function status(t: Topic, s: AppState): { line?: string; pct?: number; last?: string } {
  if (t.category) {
    const m = categoryMastery(s, t.category)
    const last = Math.max(0, ...Object.entries(s.progress).filter(([id]) => lessonIndex[id]?.book.category === t.category).map(([, p]) => p.last ?? 0))
    return m.done ? { pct: m.ratio, line: `${m.done} מתוך ${m.total} פרקים`, last: ago(last) } : {}
  }
  switch (t.id) {
    case 'library': {
      const st = libraryStats(s)
      return st.done ? { pct: st.percent / 100, line: `${st.percent}% מהספרייה` } : { line: `${books.length} ספרים` }
    }
    case 'urge':
      return { line: 'נעול בקוד שלך' }
    case 'discipline': {
      const l = ladderState(s)
      return l.log.length ? { line: `שלב ${l.level}`, last: ago(l.log[l.log.length - 1].at) } : {}
    }
    case 'screen': {
      const p = pauseStats(s)
      return p.total ? { line: `${p.total} עצירות השבוע` } : {}
    }
    case 'hub': {
      const f = planFollowThrough(s)
      return f.planned ? { pct: f.done / f.planned, line: `${f.done} מתוך ${f.planned} השבוע` } : {}
    }
    case 'sleep': {
      const st = sleepStats(s)
      return st ? { line: `${st.nights} לילות · ${st.avgHours.toFixed(1)} שעות` } : {}
    }
    case 'freedom': {
      const n = Object.keys(s.program ?? {}).length
      return n ? { pct: n / 30, line: `יום ${n} מתוך 30` } : {}
    }
    case 'checkin': {
      const n = Object.keys(s.checkins ?? {}).length
      return n ? { line: `${n} ימים של עצירה` } : {}
    }
    case 'speech': {
      const h = s.speech ?? []
      return h.length ? { line: `${h.length} הקלטות`, last: ago(h[h.length - 1].at) } : {}
    }
    case 'situation': {
      const n = Object.keys(s.situations ?? {}).length
      return n ? { pct: n / 30, line: `${n} מתוך 30 מצבים` } : {}
    }
    case 'notes': {
      const n = (s.notes ?? []).length
      return n ? { line: `${n} פריטים` } : {}
    }
  }
  return {}
}

export function TopicCard({ t, s, size = 'md' }: { t: Topic; s: AppState; size?: 'md' | 'wide' }) {
  const st = status(t, s)
  const [loaded, setLoaded] = useState(false)
  return (
    <button className={`tcard tcard--${size}`} onClick={() => navigate(t.to)} style={{ background: (tones as Record<string, string>)[t.img] }}>
      <img src={`photos/${t.img}.webp`} alt="" loading="lazy" decoding="async" className={loaded ? 'is-loaded' : ''} onLoad={() => setLoaded(true)} style={t.pos ? { objectPosition: t.pos } : undefined} />
      <span className="tcard__text">
        <strong>{t.title}</strong>
        <small>{t.line}</small>
        {(st.line || st.last) && (
          <span className="tcard__status">
            {st.line}
            {st.last ? ` · ${st.last}` : ''}
          </span>
        )}
        {st.pct !== undefined && (
          <span className="tcard__bar" aria-hidden="true">
            <i style={{ width: `${Math.round(Math.min(1, st.pct) * 100)}%` }} />
          </span>
        )}
      </span>
    </button>
  )
}

/** "עוד": every world, grouped, with search. */
export function More() {
  const s = useStore((x) => x)
  const [q, setQ] = useState('')
  const query = q.trim()
  const groups = TOPIC_GROUPS.map((g) => ({ ...g, topics: g.topics.filter((t) => !query || t.title.includes(query) || t.line.includes(query) || g.title.includes(query)) })).filter((g) => g.topics.length)
  return (
    <div className="screen more">
      <header className="more__head">
        <span className="more__kicker">MY JOURNEY</span>
        <h1>כל העולמות</h1>
        <label className="search search--lib more__search">
          <IconSearch size={18} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש נושא" aria-label="חיפוש נושא" />
        </label>
      </header>
      {groups.length === 0 && <p className="mempty">לא נמצא נושא בשם הזה.</p>}
      {groups.map((g) => (
        <section key={g.id} className="block more__group">
          <h2 className="glist__title">{g.title}</h2>
          <div className="tgrid">
            {g.topics.map((t, i) => (
              <TopicCard key={t.id} t={t} s={s} size={i === 0 && g.topics.length % 2 === 1 ? 'wide' : 'md'} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
