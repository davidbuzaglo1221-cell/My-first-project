import { useMemo, useState } from 'react'
import { bookSeconds, books, booksByCategory, categories, categoryById, curatedPaths, formatMinutes } from '../content'
import type { CategoryId } from '../content/types'
import { categoryMastery, pathProgress } from '../lib/insights'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { Art, Cover } from '../ui/Cover'
import { IconSearch } from '../ui/Icons'
import { BackButton, Bar, SectionHead } from '../ui/Kit'

const norm = (t: string) => t.toLowerCase().replace(/[׳״"'\-]/g, '')

export function Explore() {
  const [q, setQ] = useState('')
  const s = useStore((x) => x)
  const results = useMemo(() => {
    const n = norm(q.trim())
    if (!n) return []
    return books.filter((b) => [b.title, b.originalTitle, b.author, b.authorEn, b.tagline, categoryById[b.category].name].some((f) => norm(f).includes(n)))
  }, [q])

  return (
    <div className="screen explore">
      <header className="page-head">
        <h1 className="page-title">גלו</h1>
        <p className="page-sub">תשעה תחומים, הספרים החשובים בכל אחד, ומסלולים שמחברים ביניהם.</p>
      </header>

      <label className="search">
        <IconSearch size={18} />
        <input type="search" placeholder="ספר, סופר או נושא" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש" />
      </label>

      {q.trim() ? (
        <section className="block">
          <SectionHead title={results.length ? `${results.length} תוצאות` : 'לא נמצאו ספרים'} sub={results.length ? undefined : 'נסה שם של סופר, או נושא כמו הרגלים או כסף.'} />
          <div className="booklist">
            {results.map((b) => (
              <BookLine key={b.id} id={b.id} />
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="block">
            <SectionHead title="מסלולי למידה" sub="רצף שיעורים מכמה ספרים סביב מטרה אחת" />
            <div className="paths" role="list">
              {curatedPaths.map((p) => {
                const pr = pathProgress(s, p)
                return (
                  <button key={p.id} role="listitem" className="pathcard" onClick={() => navigate(`/path/${p.id}`)}>
                    <Art seed={p.id} motif={p.motif} hue={p.hue} className="pathcard__art" />
                    <span className="pathcard__body">
                      <span className="pathcard__title">{p.title}</span>
                      <span className="pathcard__sub">{p.subtitle}</span>
                      <span className="pathcard__meta">{pr.done ? `${pr.done} מתוך ${pr.total}` : `${pr.total} שיעורים`}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="block">
            <SectionHead title="תחומים" />
            <div className="cats">
              {categories.map((c) => {
                const m = categoryMastery(s, c.id)
                return (
                  <button key={c.id} className="cat" onClick={() => navigate(`/explore/${c.id}`)}>
                    <Art seed={'cat-' + c.id} motif={c.motif} hue={c.hue} className="cat__art" square />
                    <span className="cat__name">{c.name}</span>
                    <span className="cat__meta">
                      {booksByCategory(c.id).length} ספרים
                      {m.done > 0 && <span className="cat__done"> {Math.round(m.ratio * 100)}%</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="block">
            <SectionHead title="ספרי היסוד" sub="אם מתחילים מאפס, מתחילים מכאן" />
            <div className="shelf" role="list">
              {['psychology-of-money', 'how-to-win-friends', 'atomic-habits', 'never-split-the-difference', 'think-and-grow-rich', 'mindset'].map((id) => {
                const b = books.find((x) => x.id === id)!
                return (
                  <button key={id} role="listitem" className="shelf__item" onClick={() => navigate(`/book/${id}`)}>
                    <Cover book={b} size="md" />
                    <span className="shelf__meta">{b.author}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export function BookLine({ id }: { id: string }) {
  const b = books.find((x) => x.id === id)!
  const done = useStore((s) => b.lessons.filter((l) => s.progress[l.id]?.done).length)
  return (
    <button className="bookline" onClick={() => navigate(`/book/${b.id}`)}>
      <Cover book={b} size="sm" />
      <span className="bookline__body">
        <span className="bookline__title">{b.title}</span>
        <span className="bookline__author">{b.author}</span>
        <span className="bookline__tag">{b.tagline}</span>
        <span className="bookline__meta">
          {b.lessons.length} שיעורים
          <span className="sep" aria-hidden="true" />
          {formatMinutes(bookSeconds(b))}
          {done > 0 && (
            <>
              <span className="sep" aria-hidden="true" />
              <span className="em">
                {done === b.lessons.length ? 'הושלם' : `${done} הושלמו`}
              </span>
            </>
          )}
        </span>
      </span>
    </button>
  )
}

export function CategoryScreen({ id }: { id: string }) {
  const c = categoryById[id as CategoryId]
  const s = useStore((x) => x)
  if (!c) return <NotFound />
  const list = booksByCategory(c.id)
  const m = categoryMastery(s, c.id)
  const order = [...list].sort((a, b) => (a.level === b.level ? 0 : a.level === 'יסודות' ? -1 : 1))
  return (
    <div className="screen category">
      <div className="cathero">
        <Art seed={'cat-' + c.id} motif={c.motif} hue={c.hue} className="cathero__art" />
        <BackButton fallback="/explore" />
        <div className="cathero__body">
          <h1 className="cathero__title">{c.name}</h1>
          <p className="cathero__promise">{c.promise}</p>
          <div className="cathero__progress">
            <Bar value={m.ratio} />
            <span>
              {m.done} מתוך {m.total} שיעורים
            </span>
          </div>
        </div>
      </div>

      <section className="block">
        <SectionHead title="סדר הלמידה המומלץ" sub="מהיסודות אל המתקדם" />
        <ol className="sequence">
          {order.map((b, i) => (
            <li key={b.id}>
              <span className="sequence__n">{i + 1}</span>
              <BookLine id={b.id} />
            </li>
          ))}
        </ol>
      </section>

      <section className="block">
        <SectionHead title="למה הספרים האלה" />
        <div className="whys">
          {order.map((b) => (
            <div key={b.id} className="why">
              <h3>{b.title}</h3>
              <p>{b.why}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="screen empty">
      <h1 className="page-title">הדף לא נמצא</h1>
      <p className="page-sub">אולי הקישור ישן. אפשר לחזור למסך הבית ולהמשיך משם.</p>
      <button className="btn btn--primary" onClick={() => navigate('/')}>
        למסך הבית
      </button>
    </div>
  )
}
