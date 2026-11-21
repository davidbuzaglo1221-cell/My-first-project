import { useEffect, useState } from 'react'
import { books } from '../content'
import { store } from '../lib/store'
import { Cover } from '../ui/Cover'

const ROWS = 5

/**
 * The opening: the whole library as a diagonal wall of covers drifting past, row against row,
 * then the name and the way in. Shown once per launch; the first visit also marks the library as opened.
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
  // Every book in the library, dealt across the rows; each row is doubled so it loops without a seam.
  const rows = Array.from({ length: ROWS }, (_, r) => books.filter((_, i) => i % ROWS === r))
  const chapters = books.reduce((a, b) => a + b.lessons.length, 0)
  return (
    <div className={`opening ${leaving ? 'is-leaving' : ''} ${ready ? 'is-ready' : ''}`}>
      <div className="opening__wall" aria-hidden="true">
        {rows.map((row, r) => (
          <div key={r} className={`owall__row owall__row--${r}`}>
            {[...row, ...row].map((b, i) => (
              <Cover key={i} book={b} size="md" eager />
            ))}
          </div>
        ))}
      </div>
      <div className="opening__shade" aria-hidden="true" />
      <div className="opening__body">
        <h1 className="opening__brand">הספריה</h1>
        <p className="opening__lead">
          {books.length} הספרים הטובים בעולם. {chapters} פרקים, כל ספר במלואו, רק העיקר.
        </p>
        <button className="opening__enter" onClick={enter}>
          כניסה אל הספרייה שלי
        </button>
      </div>
    </div>
  )
}
