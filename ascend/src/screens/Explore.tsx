import { useMemo, useState } from 'react'
import { bookSeconds, books, booksByCategory, categories, categoryById, curatedPaths, formatMinutes, lessonIndex } from '../content'
import type { CategoryId } from '../content/types'
import { categoryMastery, pathProgress } from '../lib/insights'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { Cover, CoverFan } from '../ui/Cover'
import { AreaIcon, IconSearch, IconSettings } from '../ui/Icons'
import { BackButton, Bar, SectionHead, Sheet } from '../ui/Kit'
import { BookTile, Learned } from '../ui/Books'
import { bookPercent, bookStatus, libraryStats } from '../lib/learn'

const norm = (t: string) => t.toLowerCase().replace(/[׳״"'\-]/g, '')

type Status = 'all' | 'new' | 'active' | 'done' | 'saved'
type Sort = 'mixed' | 'title' | 'short' | 'progress' | 'newest'
type Len = 'any' | 'short' | 'mid' | 'long'

const STATUS: { id: Status; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'new', label: 'עוד לא התחלתי' },
  { id: 'active', label: 'בתהליך' },
  { id: 'done', label: 'סיימתי' },
  { id: 'saved', label: 'שמורים' },
]
const SORTS: { id: Sort; label: string }[] = [
  { id: 'mixed', label: 'לפי תחום' },
  { id: 'title', label: 'א׳ עד ת׳' },
  { id: 'short', label: 'הקצרים קודם' },
  { id: 'progress', label: 'הכי מתקדם' },
  { id: 'newest', label: 'החדשים ביותר' },
]
const LENS: { id: Len; label: string }[] = [
  { id: 'any', label: 'כל אורך' },
  { id: 'short', label: 'עד 5 דקות' },
  { id: 'mid', label: '5 עד 8 דקות' },
  { id: 'long', label: 'מעל 8 דקות' },
]

/** The library: every book, searchable and filterable. The learner chooses. */
export function Explore() {
  const s = useStore((x) => x)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const [status, setStatus] = useState<Status>('all')
  const [sort, setSort] = useState<Sort>('mixed')
  const [len, setLen] = useState<Len>('any')
  const [level, setLevel] = useState<'any' | 'יסודות' | 'מתקדם'>('any')
  const [sheet, setSheet] = useState(false)
  const stats = libraryStats(s)

  const list = useMemo(() => {
    const n = norm(q.trim())
    let r = books.filter((b) => {
      if (cat !== 'all' && b.category !== cat) return false
      if (level !== 'any' && b.level !== level) return false
      const min = bookSeconds(b) / 60
      if (len === 'short' && min > 5) return false
      if (len === 'mid' && (min <= 5 || min > 8)) return false
      if (len === 'long' && min <= 8) return false
      if (status === 'saved' && !s.saved.includes(b.id)) return false
      if (status !== 'all' && status !== 'saved' && bookStatus(s, b) !== status) return false
      if (n) {
        const hay = [b.title, b.originalTitle, b.author, b.authorEn, b.tagline, b.why, categoryById[b.category].name, ...b.ideas.map((i) => i.title + ' ' + i.body), ...b.lessons.map((l) => l.title)]
        if (!hay.some((f) => norm(f).includes(n))) return false
      }
      return true
    })
    if (sort === 'title') r = [...r].sort((a, b) => a.title.localeCompare(b.title, 'he'))
    if (sort === 'short') r = [...r].sort((a, b) => bookSeconds(a) - bookSeconds(b))
    if (sort === 'progress') r = [...r].sort((a, b) => bookPercent(s, b) - bookPercent(s, a))
    if (sort === 'newest') r = [...r].sort((a, b) => b.year - a.year)
    return r
  }, [q, cat, status, sort, len, level, s])

  const active = (status !== 'all' ? 1 : 0) + (len !== 'any' ? 1 : 0) + (level !== 'any' ? 1 : 0) + (sort !== 'mixed' ? 1 : 0)
  const grouped = sort === 'mixed' && cat === 'all' && !q.trim()

  return (
    <div className="screen lib">
      <header className="lib__head">
        <div className="lib__titles">
          <h1 className="page-title">הספרייה</h1>
          <p className="lib__stat">
            <strong>{stats.books}</strong> ספרים · <strong>{stats.chapters}</strong> פרקים · למדת <strong className="em">{stats.percent}%</strong>
          </p>
        </div>
      </header>

      <div className="lib__bar">
        <label className="search search--lib">
          <IconSearch size={18} />
          <input type="search" placeholder="חפש ספר, סופר, רעיון או פרק" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש בספרייה" />
          {q && (
            <button className="search__clear" onClick={() => setQ('')} aria-label="נקה חיפוש">
              ×
            </button>
          )}
        </label>
        <button className={`filterbtn ${active ? 'is-on' : ''}`} onClick={() => setSheet(true)} aria-label="סינון ומיון">
          <IconSettings size={19} />
          {active > 0 && <b>{active}</b>}
        </button>
      </div>

      <div className="chips" role="tablist" aria-label="תחום">
        <button role="tab" aria-selected={cat === 'all'} className={`chip ${cat === 'all' ? 'is-on' : ''}`} onClick={() => setCat('all')}>
          הכל
        </button>
        {categories.map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} className={`chip ${cat === c.id ? 'is-on' : ''}`} onClick={() => setCat(c.id)}>
            <AreaIcon id={c.id} size={15} /> {c.short}
          </button>
        ))}
      </div>

      <div className="chips chips--status">
        {STATUS.map((x) => (
          <button key={x.id} className={`chip chip--ghost ${status === x.id ? 'is-on' : ''}`} onClick={() => setStatus(x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="lib__empty">
          <p>לא נמצאו ספרים שמתאימים לחיפוש ולסינון.</p>
          <button className="btn btn--quiet" onClick={() => (setQ(''), setCat('all'), setStatus('all'), setLen('any'), setLevel('any'))}>
            נקה הכל
          </button>
        </div>
      ) : grouped ? (
        categories.map((c) => {
          const inCat = list.filter((b) => b.category === c.id)
          if (!inCat.length) return null
          return (
            <section key={c.id} className="block">
              <SectionHead title={c.name} sub={c.promise} action={`${inCat.length} ספרים`} onAction={() => setCat(c.id)} />
              <div className="tiles tiles--row">
                {inCat.map((b) => (
                  <BookTile key={b.id} id={b.id} />
                ))}
              </div>
            </section>
          )
        })
      ) : (
        <section className="block">
          <p className="lib__count">{list.length} ספרים</p>
          <div className="tiles">
            {list.map((b) => (
              <BookTile key={b.id} id={b.id} />
            ))}
          </div>
        </section>
      )}

      <section className="block">
        <SectionHead title="מסלולי למידה" sub="רצף פרקים מכמה ספרים סביב נושא אחד" />
        <div className="paths" role="list">
          {curatedPaths.map((p) => {
            const pr = pathProgress(s, p)
            return (
              <button key={p.id} role="listitem" className="pathcard" onClick={() => navigate(`/path/${p.id}`)}>
                <span className="pathcard__fan">
                  <CoverFan books={[...new Set(p.lessonIds.map((id) => lessonIndex[id].book))]} />
                </span>
                <span className="pathcard__body">
                  <span className="pathcard__title">{p.title}</span>
                  <span className="pathcard__sub">{p.subtitle}</span>
                  <span className="pathcard__meta">{pr.done ? `${pr.done} מתוך ${pr.total}` : `${pr.total} פרקים`}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <Sheet open={sheet} onClose={() => setSheet(false)} label="סינון ומיון">
        <h3 className="sheet__title">סינון ומיון</h3>
        <div className="fgroup">
          <p className="fgroup__label">מיון</p>
          <div className="chips chips--wrap">
            {SORTS.map((x) => (
              <button key={x.id} className={`chip ${sort === x.id ? 'is-on' : ''}`} onClick={() => setSort(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="fgroup">
          <p className="fgroup__label">אורך האזנה</p>
          <div className="chips chips--wrap">
            {LENS.map((x) => (
              <button key={x.id} className={`chip ${len === x.id ? 'is-on' : ''}`} onClick={() => setLen(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="fgroup">
          <p className="fgroup__label">רמה</p>
          <div className="chips chips--wrap">
            {(['any', 'יסודות', 'מתקדם'] as const).map((x) => (
              <button key={x} className={`chip ${level === x ? 'is-on' : ''}`} onClick={() => setLevel(x)}>
                {x === 'any' ? 'כל הרמות' : x}
              </button>
            ))}
          </div>
        </div>
        <div className="fgroup">
          <p className="fgroup__label">מצב</p>
          <div className="chips chips--wrap">
            {STATUS.map((x) => (
              <button key={x.id} className={`chip ${status === x.id ? 'is-on' : ''}`} onClick={() => setStatus(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="sheet__actions">
          <button className="btn btn--primary btn--wide" onClick={() => setSheet(false)}>
            הצג {list.length} ספרים
          </button>
          <button className="btn btn--quiet btn--wide" onClick={() => (setStatus('all'), setLen('any'), setLevel('any'), setSort('mixed'))}>
            איפוס
          </button>
        </div>
      </Sheet>
    </div>
  )
}

export function BookLine({ id }: { id: string }) {
  const b = books.find((x) => x.id === id)!
  const pct = useStore((s) => bookPercent(s, b))
  return (
    <button className="bookline" onClick={() => navigate(`/book/${b.id}`)}>
      <Cover book={b} size="sm" />
      <span className="bookline__body">
        <span className="bookline__title">{b.title}</span>
        <span className="bookline__author">{b.author}</span>
        <span className="bookline__tag">{b.tagline}</span>
        <span className="bookline__meta">
          {b.lessons.length} פרקים
          <span className="sep" aria-hidden="true" />
          {formatMinutes(bookSeconds(b))}
        </span>
        {pct > 0 && <Learned value={pct} />}
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
        <CoverFan books={list} className="cathero__fan" />
        <BackButton fallback="/explore" />
        <div className="cathero__body">
          <h1 className="cathero__title">{c.name}</h1>
          <p className="cathero__promise">{c.promise}</p>
          <div className="cathero__progress">
            <Bar value={m.ratio} />
            <span>
              {m.done} מתוך {m.total} פרקים
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
