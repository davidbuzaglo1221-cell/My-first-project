import { useEffect, useState } from 'react'
import { books } from '../content'
import { store } from '../lib/store'
import { Cover } from '../ui/Cover'


/**
 * The opening: an architectural space coming out of the dark, the name, one line of light,
 * the whole library drifting past in a single band, and the way in. Shown once per launch.
 */
export function Opening({ onEnter }: { onEnter: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 700)
    return () => clearTimeout(t)
  }, [])
  const enter = () => {
    if (leaving) return
    setLeaving(true)
    store.set({ onboarded: true }, { immediate: true })
    setTimeout(onEnter, 650)
  }
  const chapters = books.reduce((a, b) => a + b.lessons.length, 0)
  return (
    <div className={`opening ${leaving ? 'is-leaving' : ''} ${ready ? 'is-ready' : ''}`}>
      <div className="opening__photo" aria-hidden="true">
        <img src="photos/welcome.webp" alt="" fetchPriority="high" decoding="async" />
      </div>
      <div className="opening__shade" aria-hidden="true" />
      <p className="opening__kicker">MY JOURNEY</p>
      <div className="opening__body">
        <h1 className="opening__brand">המסע שלי</h1>
        <span className="opening__line" aria-hidden="true" />
        <p className="opening__lead">
          {books.length} ספרים גדולים, {chapters} פרקים. ללמוד, להקשיב, לתרגל, ולהפוך לגרסה הבאה שלך.
        </p>
        <div className="opening__wall" aria-hidden="true">
          <div className="owall__row">
            {[...books, ...books].map((b, i) => (
              <Cover key={i} book={b} size="md" eager={i < 14} />
            ))}
          </div>
        </div>
        <button className="opening__enter" onClick={enter}>
          כניסה
        </button>
      </div>
    </div>
  )
}
