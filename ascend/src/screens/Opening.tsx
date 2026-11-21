import { useEffect, useState } from 'react'
import { books } from '../content'
import { store } from '../lib/store'
import { coverUrl } from '../ui/Cover'

/** The three books that fly in the opening: one per shelf the library is known for. */
const TRIO = ['psychology-of-money', 'atomic-habits', 'how-to-win-friends']

/** An open book in mid-air. Its leaves turn on their own, right to left like a Hebrew book in the wind. */
function FlyingBook({ id, n }: { id: string; n: number }) {
  return (
    <div className={`fly fly--${n}`} aria-hidden="true">
      <div className="ob">
        <div className="ob__cover" style={{ backgroundImage: `url(${coverUrl(id)})` }} />
        <div className="ob__page ob__page--r" />
        <div className="ob__page ob__page--l" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ob__leaf" style={{ animationDelay: `${n * 0.35 + i * 0.55}s` }}>
            <span className="ob__face" />
            <span className="ob__face ob__face--back" />
          </div>
        ))}
        <span className="ob__ribbon" />
      </div>
    </div>
  )
}

/**
 * The opening: three books float and riffle in the wind, loose pages drift past, then the way in.
 * Shown once per launch; the first visit also marks the library as opened.
 */
export function Opening({ onEnter }: { onEnter: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 900)
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
      <div className="opening__glow" aria-hidden="true" />
      <div className="opening__dust" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 72}%`, animationDelay: `${-i * 0.7}s`, animationDuration: `${7 + (i % 5)}s` }} />
        ))}
      </div>
      <div className="opening__sky">
        {TRIO.map((id, n) => (
          <FlyingBook key={id} id={id} n={n} />
        ))}
        {[0, 1, 2].map((i) => (
          <span key={i} className={`loose loose--${i}`} aria-hidden="true" />
        ))}
      </div>
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
