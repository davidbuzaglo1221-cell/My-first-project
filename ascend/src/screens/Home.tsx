import { useEffect, useRef, useState } from 'react'
import { bookById, bookIdeas, bookSeconds, books, categories, categoryById, formatHours, formatMinutes, lessonIndex } from '../content'
import { usePlayer } from '../engine/player'
import { greeting } from '../lib/dates'
import { currentStreak, todaySeconds } from '../lib/insights'
import { bookPercent, bookStatus, dueCards, libraryStats } from '../lib/learn'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { Cover, bookHue } from '../ui/Cover'
import { AreaIcon, IconBook, IconFlame, IconLotus, IconPlay, IconQuiz, IconSearch } from '../ui/Icons'
import { Eq, Ring, SectionHead, startLesson } from '../ui/Kit'
import { BookTile, Learned } from '../ui/Books'
import { TodayCard } from '../ui/Daily'

const fmtListen = (sec: number) => {
  const m = Math.floor(sec / 60)
  return m < 60 ? { v: String(m), u: 'דק׳' } : { v: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`, u: 'שע׳' }
}

/** Center-focused shelf: the book nearest the middle grows, its neighbours recede. */
function Showcase({ ids }: { ids: string[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const mid = el.getBoundingClientRect().left + el.clientWidth / 2
      let best = 0
      let bestD = Infinity
      Array.from(el.children).forEach((child, i) => {
        const b = (child as HTMLElement).getBoundingClientRect()
        const d = Math.max(-1.6, Math.min(1.6, (b.left + b.width / 2 - mid) / b.width))
        ;(child as HTMLElement).style.setProperty('--d', String(d))
        ;(child as HTMLElement).style.setProperty('--a', String(Math.abs(d)))
        if (Math.abs(d) < bestD) {
          bestD = Math.abs(d)
          best = i
        }
      })
      setActive(best)
    }
    const onScroll = () => (raf ||= requestAnimationFrame(update))
    update()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])
  const book = bookById[ids[active]]
  return (
    <section className="showcase" aria-label="ספרים נבחרים">
      <div className="showcase__glow" style={{ ['--hue' as string]: bookHue(book) }} aria-hidden="true" />
      <div className="showcase__track" ref={ref}>
        {ids.map((id, i) => (
          <button
            key={id}
            className={`showcase__item ${i === active ? 'is-active' : ''}`}
            onClick={(e) => (i === active ? navigate(`/book/${id}`) : (e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }))}
            aria-label={bookById[id].title}
          >
            <Cover book={bookById[id]} size="lg" />
          </button>
        ))}
      </div>
      <div className="showcase__info" key={book.id}>
        <p className="showcase__area">{categoryById[book.category].short}</p>
        <h3 className="showcase__title">{book.title}</h3>
        <p className="showcase__author">{book.author}</p>
        <p className="showcase__tag">{book.tagline}</p>
        <div className="showcase__actions">
          <button className="btn btn--primary" onClick={() => startLesson(book.lessons[0].id)}>
            <IconPlay size={14} /> האזן עכשיו
          </button>
          <span className="showcase__len">
            {formatMinutes(bookSeconds(book))}
            <span className="sep" aria-hidden="true" />
            {book.lessons.length} פרקים
          </span>
        </div>
      </div>
    </section>
  )
}

/** The size of the library, shown on the home screen. */
const LIB = {
  chapters: books.reduce((a, b) => a + b.lessons.length, 0),
  ideas: books.reduce((a, b) => a + bookIdeas(b), 0),
  seconds: books.reduce((a, b) => a + bookSeconds(b), 0),
}

export function Home() {
  const s = useStore((x) => x)
  const p = usePlayer()
  const stats = libraryStats(s)
  const streak = currentStreak(s)
  const today = Math.round(todaySeconds(s) / 60)
  const due = dueCards(s).length
  const initial = (s.name || 'A').trim().charAt(0)

  // Books in progress, most recent first
  const recent = (b: (typeof books)[number]) => Math.max(0, s.reading?.[b.id]?.last ?? 0, ...b.lessons.map((l) => s.progress[l.id]?.last ?? 0))
  const active = books.filter((b) => bookStatus(s, b) === 'active').sort((a, b) => recent(b) - recent(a)).slice(0, 8)
  const nextOf = (b: (typeof books)[number]) => b.lessons.find((l) => !s.progress[l.id]?.done && !s.readDone?.[l.id]) ?? b.lessons[0]

  // The whole library, interleaved across areas and rotated daily
  const dayN = Math.floor(Date.now() / 86400000)
  const mixed: string[] = []
  const byArea = categories.map((c) => books.filter((b) => b.category === c.id))
  for (let i = 0; mixed.length < books.length; i++) byArea.forEach((l) => l[i] && mixed.push(l[i].id))
  const rot = dayN % mixed.length
  const featured = [...mixed.slice(rot), ...mixed.slice(0, rot)].slice(0, 12)

  return (
    <div className="screen home4">
      <header className="h3top">
        <button className="avatar" onClick={() => navigate('/settings')} aria-label="פרופיל והגדרות">
          {initial}
        </button>
        <span className="wordmark wordmark--he">
          הספריה
        </span>
        <button className="icon-btn icon-btn--glass" onClick={() => navigate('/explore')} aria-label="חיפוש בספרייה">
          <IconSearch size={19} />
        </button>
      </header>

      <div className="h4intro">
        <p className="h4intro__greet">{greeting()}{s.name ? `, ${s.name}` : ""}</p>
        <h1 className="h4intro__title">הספרייה שלך</h1>
      </div>

      <TodayCard />

      <ul className="valuestrip" aria-label="מה יש בספרייה">
        <li>
          <strong>{books.length}</strong>
          <span>ספרים</span>
        </li>
        <li>
          <strong>{LIB.chapters}</strong>
          <span>פרקים</span>
        </li>
        <li>
          <strong>{LIB.ideas}</strong>
          <span>רעיונות</span>
        </li>
        <li>
          <strong>{formatHours(LIB.seconds).replace(' שעות', '')}</strong>
          <span>שעות האזנה</span>
        </li>
      </ul>

      <button className="learnhero" onClick={() => navigate('/progress')}>
        <Ring value={stats.percent / 100} size={104} stroke={5} className="learnhero__ring">
          <strong>{stats.percent}%</strong>
          <span>מהספרייה</span>
        </Ring>
        <span className="learnhero__facts">
          <span>
            <strong>{stats.done}</strong> פרקים למדת
          </span>
          <span>
            <strong>{stats.booksDone}</strong> ספרים הושלמו
          </span>
          <span>
            <strong>{stats.booksActive}</strong> ספרים בתהליך
          </span>
          <span className="learnhero__mini">
            <IconFlame size={14} /> {streak} ימים ברצף · היום {today} דק׳
          </span>
        </span>
      </button>

      <div className="quick4">
        <button className="q4" onClick={() => navigate('/notes/cards')}>
          <IconBook size={18} />
          <strong>לזכור</strong>
          <small>{due ? `${due} כרטיסים לחזרה` : 'חזרה חכמה'}</small>
        </button>
        <button className="q4" onClick={() => navigate('/freedom')}>
          <IconLotus size={18} />
          <strong>לנשום</strong>
          <small>מהישרדות לחופש</small>
        </button>
        <button className="q4" onClick={() => navigate(active[0] ? `/quiz/${active[0].id}` : '/explore')}>
          <IconQuiz size={18} />
          <strong>להיבחן</strong>
          <small>{active[0] ? active[0].title : 'בחר ספר'}</small>
        </button>
      </div>

      {active.length > 0 && (
        <section className="block">
          <SectionHead title="ממשיכים ללמוד" sub="הספרים שאתה באמצע" />
          <div className="cn4row" role="list">
            {active.map((b) => {
              const l = nextOf(b)
              const playing = p.track?.bookId === b.id && p.status === 'playing'
              return (
                <div key={b.id} role="listitem" className="cn4">
                  <button className="cn4__cover" onClick={() => navigate(`/book/${b.id}`)}>
                    <Cover book={b} size="md" />
                  </button>
                  <span className="cn4__title">{b.title}</span>
                  <Learned value={bookPercent(s, b)} compact />
                  <button className="cn4__go" onClick={() => startLesson(l.id)}>
                    {playing ? <Eq /> : <IconPlay size={11} />} פרק {b.lessons.indexOf(l) + 1}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="block">
        <SectionHead title="מהמדף היום" sub={`${books.length} ספרים, בכל יום מדף אחר`} action="לכל הספרייה" onAction={() => navigate('/explore')} />
        <Showcase ids={featured} />
      </section>

      {categories.map((c) => {
        const list = books.filter((b) => b.category === c.id)
        return (
          <section key={c.id} className="block">
            <SectionHead title={c.name} sub={`${list.length} ספרים · ${c.promise}`} action="לכל התחום" onAction={() => navigate(`/explore/${c.id}`)} />
            <div className="tiles tiles--row">
              {list.map((b) => (
                <BookTile key={b.id} id={b.id} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
