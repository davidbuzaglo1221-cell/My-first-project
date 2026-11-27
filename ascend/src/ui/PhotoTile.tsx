import { navigate } from '../lib/router'

/** An editorial photo tile: a real photograph, a kicker, a title, one line. Opens a world in the app. */
export function PhotoTile({ img, kicker, title, line, to, pos, size = 'md' }: { img: string; kicker?: string; title: string; line?: string; to: string; pos?: string; size?: 'md' | 'lg' | 'wide' }) {
  return (
    <button className={`ptile ptile--${size}`} onClick={() => navigate(to)}>
      <img src={`photos/${img}.webp`} alt="" loading="lazy" decoding="async" style={pos ? { objectPosition: pos } : undefined} />
      <span className="ptile__text">
        {kicker && <small>{kicker}</small>}
        <strong>{title}</strong>
        {line && <span>{line}</span>}
      </span>
    </button>
  )
}
