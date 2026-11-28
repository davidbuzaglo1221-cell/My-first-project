import { bookById } from '../content'
import { neighbours, nextChapter, usePlayer, toggle } from '../engine/player'
import { navigate, type Route, tabOf } from '../lib/router'
import { Cover } from './Cover'
import { IconAscend, IconChart, IconHeadphones, IconHome, IconLibrary, IconLotus, IconNextTrack, IconSpark } from './Icons'
import { PlayGlyph } from './Kit'
import { openPlayer } from './uiState'

const tabs = [
  { id: 'home', label: 'בית', path: '/', Icon: IconHome },
  { id: 'explore', label: 'ספרייה', path: '/explore', Icon: IconLibrary },
  { id: 'coach', label: 'עוזר אישי', path: '/coach', Icon: IconSpark },
  { id: 'freedom', label: 'לחופש', path: '/freedom', Icon: IconLotus },
  { id: 'mastery', label: 'שליטה', path: '/mastery', Icon: IconAscend },
] as const

export function TabBar({ route }: { route: Route }) {
  const active = tabOf(route)
  return (
    <nav className="tabbar" aria-label="ניווט ראשי">
      {tabs.map(({ id, label, path, Icon }) => (
        <button key={id} className={`tab tab--${id} ${active === id ? 'is-on' : ''}`} aria-current={active === id ? 'page' : undefined} onClick={() => navigate(path)}>
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
