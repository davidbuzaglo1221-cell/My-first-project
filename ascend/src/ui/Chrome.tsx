import { bookById } from '../content'
import { usePlayer, toggle } from '../engine/player'
import { navigate, type Route, tabOf } from '../lib/router'
import { Cover } from './Cover'
import { IconChart, IconHeadphones, IconHome, IconLibrary, IconLotus, IconPen } from './Icons'
import { PlayGlyph } from './Kit'
import { openPlayer } from './uiState'

const tabs = [
  { id: 'home', label: 'בית', path: '/', Icon: IconHome },
  { id: 'explore', label: 'ספרייה', path: '/explore', Icon: IconLibrary },
  { id: 'freedom', label: 'חופש', path: '/freedom', Icon: IconLotus },
  { id: 'notes', label: 'מחברת', path: '/notes', Icon: IconPen },
  { id: 'progress', label: 'התקדמות', path: '/progress', Icon: IconChart },
] as const

export function TabBar({ route }: { route: Route }) {
  const active = tabOf(route)
  return (
    <nav className="tabbar" aria-label="ניווט ראשי">
      {tabs.map(({ id, label, path, Icon }) => (
        <button key={id} className={`tab ${active === id ? 'is-on' : ''}`} aria-current={active === id ? 'page' : undefined} onClick={() => navigate(path)}>
          <Icon size={22} strokeWidth={active === id ? 1.9 : 1.5} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

export function MiniPlayer() {
  const p = usePlayer()
  if (!p.track) return null
  const book = p.track.bookId ? bookById[p.track.bookId] : undefined
  const ratio = p.duration ? p.position / p.duration : 0
  return (
    <div className="mini" role="region" aria-label="נגן">
      <button className="mini__open" onClick={openPlayer} aria-label={`פתח נגן: ${p.track.title}`}>
        {book ? <Cover book={book} size="xs" /> : <span className="mini__file">{p.track.kind === 'calm' ? <IconLotus size={18} /> : <IconHeadphones size={18} />}</span>}
        <span className="mini__text">
          <span className="mini__title">{p.track.title}</span>
          <span className="mini__sub">{p.track.subtitle}</span>
        </span>
      </button>
      <button className="mini__play" onClick={toggle} aria-label={p.status === 'playing' ? 'השהה' : 'נגן'}>
        <PlayGlyph playing={p.status === 'playing'} size={20} />
      </button>
      <div className="mini__progress" style={{ transform: `scaleX(${ratio})` }} aria-hidden="true" />
    </div>
  )
}
