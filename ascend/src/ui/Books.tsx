import { bookById, bookSeconds, categoryById, formatMinutes } from '../content'
import { bookPercent } from '../lib/learn'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { Cover } from './Cover'

/** Percent learned, as a slim bar with the number. */
export function Learned({ value, compact }: { value: number; compact?: boolean }) {
  return (
    <span className={`learned ${value >= 100 ? 'is-done' : ''} ${compact ? 'learned--compact' : ''}`} aria-label={`למדת ${value}%`}>
      <span className="learned__track">
        <span className="learned__fill" style={{ width: `${Math.max(value, value > 0 ? 3 : 0)}%` }} />
      </span>
      <span className="learned__n">{value >= 100 ? 'הושלם' : `${value}%`}</span>
    </span>
  )
}

/** A cover tile in the library grid. */
export function BookTile({ id }: { id: string }) {
  const b = bookById[id]
  const pct = useStore((s) => bookPercent(s, b))
  return (
    <button className="tile" onClick={() => navigate(`/book/${b.id}`)}>
      <span className="tile__cover">
        <Cover book={b} size="md" />
        {pct >= 100 && <span className="tile__badge">✓</span>}
      </span>
      <span className="tile__title">{b.title}</span>
      <span className="tile__author">{b.author}</span>
      <span className="tile__meta">
        {categoryById[b.category].short} · {formatMinutes(bookSeconds(b))}
      </span>
      {pct > 0 && <Learned value={pct} compact />}
    </button>
  )
}
