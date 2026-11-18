import { useEffect, useRef, useState } from 'react'
import { bookById, bookSeconds, books, categories, categoryById, curatedPaths, estimateSeconds, formatMinutes, lessonIndex } from '../content'
import { hasNarration, load, usePlayer } from '../engine/player'
import { dayKey, greeting, lastNDays, hebrewWeekday } from '../lib/dates'
import { currentStreak, focusAreas, isActiveDay, pathProgress, recommendations, resolvePath, todaySeconds } from '../lib/insights'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { Art, Cover, bookHue, bookMotif, coverUrl, hasRealCover } from '../ui/Cover'
import { AreaIcon, IconCheck, IconFlame, IconHeadphones, IconPlay, IconSearch } from '../ui/Icons'
import { Eq, PlayGlyph, SectionHead, startLesson } from '../ui/Kit'
import { openPlayer } from '../ui/uiState'

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
            {book.lessons.length} שיעורים
            <span className="sep" aria-hidden="true" />
            {formatMinutes(bookSeconds(book))}
          </span>
        </div>
      </div>
    </section>
  )
}

/** Curated list shown as a small fanned stack of its books. */
function Stack({ ids }: { ids: string[] }) {
  return (
    <span className="stack" aria-hidden="true">
      {ids.slice(0, 3).map((id, i) => (
        <span key={id} className={`stack__book stack__book--${i}`}>
          <Cover book={bookById[id]} size="sm" />
        </span>
      ))}
    </span>
  )
}

export function Home() {
  const s = useStore((x) => x)
  const p = usePlayer()
  const today = todaySeconds(s)
  const goal = s.dailyGoalMin * 60
  const streak = currentStreak(s)
  const recs = recommendations(s, 6)
  const week = lastNDays(7)
  const weekSec = week.reduce((a, d) => a + (s.log[dayKey(d)] ?? 0), 0)
  const t = fmtListen(today)

  const continuing = Object.entries(s.progress)
    .filter(([id, pr]) => lessonIndex[id] && !pr.done && pr.pos > 3)
    .sort((a, b) => b[1].last - a[1].last)
    .map(([id]) => id)
    .slice(0, 6)

  const path = resolvePath(s, s.activePathId)
  const pp = pathProgress(s, path)
  const plan = path.lessonIds.filter((id) => !s.progress[id]?.done).slice(0, 4)
  const planStart = path.lessonIds.indexOf(plan[0])
  // The daily lesson complements the plan instead of repeating its next step.
  const daily = recs.find((r) => !continuing.includes(r.lessonId) && r.lessonId !== plan[0]) ?? recs[0]
  const dailyRef = daily ? lessonIndex[daily.lessonId] : undefined

  const focus = focusAreas(s).map((a) => a.id)
  const featured = [...new Set(focus.flatMap((c) => books.filter((b) => b.category === c).map((b) => b.id)))]
    .filter((id) => id !== dailyRef?.book.id && !bookById[id].lessons.every((l) => s.progress[l.id]?.done))
    .slice(0, 7)
  const quick = focus.flatMap((c) => books.filter((b) => b.category === c && !b.lessons.some((l) => s.progress[l.id])).slice(0, 1)).slice(0, 8)
  const initial = (s.name || 'A').trim().charAt(0)

  return (
    <div className="screen home3">
      <header className="h3top">
        <button className="avatar" onClick={() => navigate('/settings')} aria-label="פרופיל והגדרות">
          {initial}
        </button>
        <span className="wordmark" lang="en">
          ASCEND
        </span>
        <button className="icon-btn icon-btn--glass" onClick={() => navigate('/explore')} aria-label="חיפוש">
          <IconSearch size={19} />
        </button>
      </header>

      <div className="h3title">
        <p>
          {greeting()}
          {s.name ? `, ${s.name}` : ''}
        </p>
        <h1>בית</h1>
      </div>

      {/* Two quiet stat cards: time and consistency. */}
      <div className="duo">
        <button className="duo__card" onClick={() => navigate('/progress')}>
          <span className="duo__label">
            <IconHeadphones size={15} /> זמן האזנה היום
          </span>
          <span className="duo__value">
            <strong>{t.v}</strong> {t.u}
          </span>
          <span className="duo__sub">השבוע {Math.round(weekSec / 60)} דק׳</span>
          <span className="duo__bar">
            <i style={{ transform: `scaleX(${Math.min(1, today / goal)})` }} />
          </span>
        </button>
        <button className="duo__card" onClick={() => navigate('/progress')}>
          <span className="duo__label">
            <IconFlame size={15} /> רצף למידה
          </span>
          <span className="duo__value">
            <strong>{streak}</strong> {streak === 1 ? 'יום' : 'ימים'}
          </span>
          <span className="duo__sub">יעד יומי {s.dailyGoalMin} דק׳</span>
          <span className="duo__dots" aria-label="שבעת הימים האחרונים">
            {week.map((d) => (
              <i key={dayKey(d)} className={isActiveDay(s, dayKey(d)) ? 'is-on' : ''} title={hebrewWeekday(d)} />
            ))}
          </span>
        </button>
      </div>

      {continuing.length > 0 && (
        <section className="block block--tight">
          <SectionHead title="להמשיך להאזין" action="הספרייה" onAction={() => navigate('/library')} />
          <div className="cgrid" role="list">
            {continuing.map((id) => {
              const ref = lessonIndex[id]
              const pr = s.progress[id]
              const ratio = pr?.dur ? pr.pos / pr.dur : 0
              const playing = p.track?.id === id && p.status === 'playing'
              const left = pr?.dur ? pr.dur - pr.pos : estimateSeconds(ref.lesson, s.cps)
              return (
                <button key={id} role="listitem" className="cgrid__item" onClick={() => startLesson(id)} aria-label={`${playing ? 'מתנגן' : 'המשך'}: ${ref.lesson.title}`}>
                  <span className="cgrid__cover">
                    <Cover book={ref.book} size="md" />
                    <span className="cgrid__play">{playing ? <Eq /> : <IconPlay size={13} />}</span>
                  </span>
                  <span className="cgrid__bar">
                    <i style={{ transform: `scaleX(${ratio})` }} />
                  </span>
                  <span className="cgrid__title">{ref.lesson.title}</span>
                  <span className="cgrid__meta">נותרו {formatMinutes(left)}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {dailyRef && (
        <section className="block">
          <button className="daily" onClick={() => startLesson(dailyRef.lesson.id)} style={{ ['--hue' as string]: bookHue(dailyRef.book) }}>
            {hasRealCover(dailyRef.book.id) ? (
              <img className="daily__art daily__photo" src={coverUrl(dailyRef.book.id)} alt="" aria-hidden="true" />
            ) : (
              <Art seed={dailyRef.book.id + ':daily'} motif={bookMotif(dailyRef.book)} hue={bookHue(dailyRef.book)} className="daily__art" />
            )}
            <span className="daily__book" aria-hidden="true">
              <Cover book={dailyRef.book} size="lg" />
            </span>
            <span className="daily__tag">השיעור של היום</span>
            <span className="daily__body">
              <span className="daily__title">{dailyRef.lesson.title}</span>
              <span className="daily__meta">
                {dailyRef.book.title}
                <span className="sep" aria-hidden="true" />
                {formatMinutes(estimateSeconds(dailyRef.lesson, s.cps))}
                {hasNarration(dailyRef.lesson.id) && (
                  <>
                    <span className="sep" aria-hidden="true" />
                    קריינות
                  </>
                )}
              </span>
              <span className="daily__why">{daily!.reason}</span>
            </span>
            <span className="daily__play" aria-hidden="true">
              <PlayGlyph playing={p.track?.id === dailyRef.lesson.id && p.status === 'playing'} size={22} />
            </span>
          </button>
        </section>
      )}

      <section className="block">
        <SectionHead title="תחומים" />
        <div className="areas" role="list">
          {categories.map((c) => (
            <button key={c.id} role="listitem" className={`area ${s.goals.includes(c.id) ? 'is-goal' : ''}`} onClick={() => navigate(`/explore/${c.id}`)}>
              <span className="area__icon">
                <AreaIcon id={c.id} />
              </span>
              <span className="area__name">{c.short}</span>
            </button>
          ))}
        </div>
      </section>

      {plan.length > 0 && (
        <section className="block">
          <SectionHead title="תוכנית הלמידה שלך" action="לכל המסלול" onAction={() => navigate(`/path/${path.id}`)} />
          <div className="plan">
            <div className="plan__head">
              <span className="plan__name">{path.title}</span>
              <span className="plan__count">
                {pp.done}/{pp.total}
              </span>
            </div>
            <ol className="plan__steps">
              {plan.map((id) => {
                const ref = lessonIndex[id]
                const done = s.progress[id]?.done
                const isNext = id === path.lessonIds[planStart] && !done
                const playing = p.track?.id === id && p.status === 'playing'
                return (
                  <li key={id} className={`pstep ${done ? 'is-done' : ''} ${isNext ? 'is-next' : ''}`}>
                    <button onClick={() => startLesson(id)}>
                      <span className="pstep__mark">{done ? <IconCheck size={13} /> : playing ? <Eq /> : path.lessonIds.indexOf(id) + 1}</span>
                      <span className="pstep__body">
                        <strong>{ref.lesson.title}</strong>
                        <span>
                          {ref.book.title}
                          <span className="sep" aria-hidden="true" />
                          {formatMinutes(estimateSeconds(ref.lesson, s.cps))}
                        </span>
                      </span>
                      {isNext && (
                        <span className="pstep__go" aria-hidden="true">
                          <IconPlay size={12} />
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="block">
          <SectionHead title="נבחרו בשבילך" sub="לפי התחומים שהכי כדאי לחזק עכשיו" />
          <Showcase ids={featured} />
        </section>
      )}

      <section className="block">
        <SectionHead title="רשימות קריאה" sub="מסלולים שמחברים כמה ספרים סביב מטרה אחת" />
        <div className="lists" role="list">
          {curatedPaths.map((path) => {
            const bookIds = [...new Set(path.lessonIds.map((id) => lessonIndex[id].book.id))]
            const pr = pathProgress(s, path)
            return (
              <button key={path.id} role="listitem" className="list-card" onClick={() => navigate(`/path/${path.id}`)} style={{ ['--hue' as string]: path.hue }}>
                <Stack ids={bookIds} />
                <span className="list-card__title">{path.title}</span>
                <span className="list-card__meta">
                  {bookIds.length} ספרים
                  <span className="sep" aria-hidden="true" />
                  {pr.done ? `${pr.done}/${pr.total}` : `${pr.total} שיעורים`}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {quick.length > 0 && (
        <section className="block">
          <SectionHead title="הספר בדקה" sub="הרעיונות המרכזיים, ליום עמוס" />
          <div className="shelf" role="list">
            {quick.map((b) => (
              <button key={b.id} role="listitem" className="shelf__item" onClick={() => (load(`${b.id}-quick`, { autoplay: true, from: 0 }), openPlayer())} aria-label={`הספר בדקה: ${b.title}`}>
                <Cover book={b} size="md" />
                <span className="shelf__title">{b.title}</span>
                <span className="shelf__meta">
                  <IconPlay size={10} /> {b.author}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
