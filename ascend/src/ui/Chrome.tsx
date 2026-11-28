import { bookById } from '../content'
import { neighbours, nextChapter, usePlayer, toggle } from '../engine/player'
import { coachNotes } from '../lib/coach'
import { todayChecks } from '../lib/daily'
import { currentStreak } from '../lib/insights'
import { tasksFor } from '../lib/mastery'
import { navigate, type Route, tabOf } from '../lib/router'
import { useStore } from '../lib/store'
import { Cover } from './Cover'
import { IconHeadphones, IconLotus, IconNextTrack } from './Icons'
import { PlayGlyph } from './Kit'
import { openPlayer } from './uiState'

/* ---------- the signature tab bar: drawn for this app, two states each, live from real data ---------- */
type TI = { on: boolean }
const sv = { width: 26, height: 26, viewBox: '0 0 26 26', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
/** Home: an arch with a lamp lit inside. */
const TIHome = ({ on }: TI) => (
  <svg {...sv}>
    <path d="M6 21.5V12a7 7 0 0 1 14 0v9.5" fill={on ? 'url(#tg-fill)' : 'none'} />
    <path d="M3.5 21.5h19" />
    <circle cx="13" cy="12.2" r={on ? 1.9 : 1.3} fill="currentColor" stroke="none" className="ti-lamp" />
  </svg>
)
/** Today: the sun coming up over the line. */
const TIToday = ({ on }: TI) => (
  <svg {...sv}>
    <path d="M7.5 18.5a5.5 5.5 0 0 1 11 0" fill={on ? 'url(#tg-fill)' : 'none'} />
    <path d="M3.5 18.5h19M13 6.5v2.2M6.6 9.6l1.5 1.5M19.4 9.6l-1.5 1.5" className="ti-rays" />
    <path d="M9 22h8" opacity="0.5" />
  </svg>
)
/** Progress: a ridge with the summit marked. */
const TIProgress = ({ on }: TI) => (
  <svg {...sv}>
    <path d="M3 21.5 9.5 12l4 5 3.2-4.3 6.3 8.8z" fill={on ? 'url(#tg-fill)' : 'none'} />
    <path d="M16.7 12.7V6.2l3.3 1.3-3.3 1.3" className="ti-flag" />
  </svg>
)
/** More: three points that join into a line when open. */
const TIMore = ({ on }: TI) => (
  <svg {...sv} stroke="none" fill="currentColor">
    <rect x={on ? 5 : 5.6} y="11.6" width={on ? 3.6 : 2.8} height="2.8" rx="1.4" />
    <rect x={on ? 11 : 11.6} y="11.6" width={on ? 4 : 2.8} height="2.8" rx="1.4" />
    <rect x={on ? 17.4 : 17.6} y="11.6" width={on ? 3.6 : 2.8} height="2.8" rx="1.4" />
  </svg>
)
/** The coach: a four-point spark, the app's own mark. */
const Spark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5z" fill="currentColor" />
    <circle cx="18.6" cy="18.4" r="1.4" fill="currentColor" opacity="0.7" />
  </svg>
)

const tabs = [
  { id: 'home', label: 'בית', path: '/', Icon: TIHome },
  { id: 'today', label: 'היום', path: '/mastery/day', Icon: TIToday },
  { id: 'coach', label: 'מאמן', path: '/coach', Icon: null },
  { id: 'progress', label: 'התקדמות', path: '/progress', Icon: TIProgress },
  { id: 'more', label: 'עוד', path: '/more', Icon: TIMore },
] as const

export function TabBar({ route }: { route: Route }) {
  const active = tabOf(route)
  const s = useStore((x) => x)
  const idx = Math.max(0, tabs.findIndex((t) => t.id === active))
  // Real signals only: how much of today is done, the streak, and whether the coach has something to raise.
  const tasks = tasksFor(s)
  const c = todayChecks(s)
  const dayRatio = tasks.length ? tasks.filter((t) => t.done).length / tasks.length : (Number(c.practice) + Number(c.chapter) + Number(c.idea)) / 3
  const streak = currentStreak(s)
  const notes = coachNotes(s).length
  return (
    <nav className="tabbar tabbar--sig" aria-label="ניווט ראשי" style={{ ['--i' as string]: idx }}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="tg-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8CCBA5" stopOpacity="0.55" />
            <stop offset="1" stopColor="#185B3B" stopOpacity="0.15" />
          </linearGradient>
        </defs>
      </svg>
      <span className={`tabbar__light ${active === 'coach' ? 'is-hidden' : ''}`} aria-hidden="true" />
      {tabs.map(({ id, label, path, Icon }) => {
        const on = active === id
        const go = () => {
          if (on) window.scrollTo({ top: 0, behavior: 'smooth' })
          else navigate(path)
          try {
            navigator.vibrate?.(6)
          } catch {
            /* no haptics here */
          }
        }
        if (id === 'coach')
          return (
            <button key={id} className={`tab tab--coach ${on ? 'is-on' : ''}`} aria-current={on ? 'page' : undefined} onClick={go} aria-label={notes ? `מאמן, ${notes} דברים לדבר עליהם` : 'מאמן'}>
              <span className="orb">
                <Spark />
                {notes > 0 && !on && <i className="orb__dot" aria-hidden="true" />}
              </span>
              <span>{label}</span>
            </button>
          )
        const I = Icon!
        return (
          <button key={id} className={`tab tab--${id} ${on ? 'is-on' : ''}`} aria-current={on ? 'page' : undefined} onClick={go}>
            <span className="tab__icon">
              {id === 'today' && dayRatio > 0 && (
                <svg className="tab__ring" viewBox="0 0 36 36" aria-hidden="true">
                  <circle cx="18" cy="18" r="16" pathLength="100" strokeDasharray={`${Math.round(dayRatio * 100)} 100`} />
                </svg>
              )}
              <I on={on} />
              {id === 'progress' && streak > 1 && <b className="tab__badge">{streak}</b>}
            </span>
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function MiniPlayer() {
  const p = usePlayer()
  if (!p.track) return null
  const book = p.track.bookId ? bookById[p.track.bookId] : undefined
  const ratio = p.duration ? p.position / p.duration : 0
  const playing = p.status === 'playing'
  return (
    <div className="mini2" role="region" aria-label="נגן">
      <button className="mini2__open" onClick={openPlayer} aria-label={`פתח נגן: ${p.track.title}`}>
        {book ? <Cover book={book} size="xs" /> : <span className="mini2__file">{p.track.kind === 'calm' ? <IconLotus size={16} /> : <IconHeadphones size={16} />}</span>}
        <span className="mini2__text">
          <span className="mini2__title">{p.track.title}</span>
          <span className="mini2__sub">{p.track.subtitle}</span>
        </span>
      </button>
      <button className="mini2__btn" onClick={toggle} aria-label={playing ? 'השהה' : 'נגן'}>
        <PlayGlyph playing={playing} size={22} />
      </button>
      <button className="mini2__btn" onClick={nextChapter} aria-label="פרק הבא" disabled={!neighbours(p.track.id).next}>
        <IconNextTrack size={22} />
      </button>
      <span className="mini2__bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${ratio})` }} />
      </span>
    </div>
  )
}
