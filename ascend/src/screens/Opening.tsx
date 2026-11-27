import { useEffect, useRef, useState } from 'react'
import { books } from '../content'
import { store } from '../lib/store'
import { Cover } from '../ui/Cover'

const INSIDE = [
  { img: 'library', kicker: 'הספרייה', title: `${books.length} ספרים גדולים, כל ספר במלואו`, line: 'לקרוא או להקשיב, בקריינות חיה. רק העיקר, בלי מילוי.', books: true },
  { img: 'assistant', kicker: 'עוזר אישי', title: 'שואל את השאלה הנכונה', line: 'מטרה אחת, התחייבויות שהוא חוזר אליהן, וכל שיחה נגמרת בצעד אחד.' },
  { img: 'calm', kicker: 'מהישרדות לחופש', title: 'ללמד את הגוף להירגע', line: 'שלושים יום, נשימה ומדיטציות. מהמצב שבו שורדים, למצב שבו בוחרים.', pos: '50% 62%' },
  { img: 'situation', kicker: 'כל יום משהו חדש', title: 'האפליקציה פונה אליך', line: 'מצב מהחיים בבוקר, שאלה קטנה בערב. בלי שתצטרך לזכור.', pos: '38% 50%' },
  { img: 'progress', kicker: 'המסע', title: 'רואים את הדרך', line: 'כל פרק, כל יום וכל צעד נשמרים. רק מה שבאמת עשית.' },
]

/**
 * The entrance: the house from outside, in full, the camera gliding across it; the mark and the name;
 * then, scrolling down, what waits inside, one photograph per world. Shown once per launch.
 */
export function Opening({ onEnter }: { onEnter: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const [ready, setReady] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500)
    const el = root.current
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('is-in')), { root: el, threshold: 0.22 })
    el?.querySelectorAll('.opin').forEach((n) => io.observe(n))
    return () => (clearTimeout(t), io.disconnect())
  }, [])
  const enter = () => {
    if (leaving) return
    setLeaving(true)
    store.set({ onboarded: true }, { immediate: true })
    setTimeout(onEnter, 650)
  }
  const chapters = books.reduce((a, b) => a + b.lessons.length, 0)
  return (
    <div ref={root} className={`opening ${leaving ? 'is-leaving' : ''} ${ready ? 'is-ready' : ''}`}>
      <section className="ophero">
        <div className="ophero__pano" aria-hidden="true">
          <img src="photos/entrance.webp" alt="" fetchPriority="high" decoding="async" />
        </div>
        <div className="ophero__shade" aria-hidden="true" />
        <p className="opening__kicker">MY JOURNEY</p>
        <div className="opening__body">
          <img className="opening__mark" src="mark.webp" alt="" />
          <h1 className="opening__brand">המסע שלי</h1>
          <span className="opening__line" aria-hidden="true" />
          <p className="opening__lead">
            {books.length} ספרים, {chapters} פרקים, עוזר אישי ותוכנית יומית. כל מה שצריך כדי להפוך לגרסה הבאה שלך.
          </p>
          <button className="opening__enter" onClick={enter}>
            כניסה
          </button>
          <button className="opening__peek" onClick={() => root.current?.querySelector('.opinside')?.scrollIntoView({ behavior: 'smooth' })}>
            מה מחכה בפנים
            <i aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="opinside" aria-label="מה מחכה בפנים">
        <h2 className="opinside__title">מה מחכה בפנים</h2>
        {INSIDE.map((x) => (
          <article key={x.img} className="opin">
            <img src={`photos/${x.img}.webp`} alt="" loading="lazy" decoding="async" style={x.pos ? { objectPosition: x.pos } : undefined} />
            <div className="opin__text">
              <small>{x.kicker}</small>
              <h3>{x.title}</h3>
              <p>{x.line}</p>
            </div>
            {x.books && (
              <div className="opening__wall" aria-hidden="true">
                <div className="owall__row">
                  {[...books, ...books].map((b, i) => (
                    <Cover key={i} book={b} size="md" eager={i < 10} />
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
        <button className="opening__enter opening__enter--end" onClick={enter}>
          כניסה אל המסע שלי
        </button>
      </section>
    </div>
  )
}
