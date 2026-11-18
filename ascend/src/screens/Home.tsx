import { useEffect, useRef, useState } from 'react'
import { bookById, bookSeconds, books, categories, categoryById, curatedPaths, estimateSeconds, formatMinutes, lessonIndex } from '../content'
import { usePlayer } from '../engine/player'
import { dayKey, greeting } from '../lib/dates'
import { currentStreak, focusAreas, growthIndex, pathProgress, recommendations, todaySeconds } from '../lib/insights'
import { navigate } from '../lib/router'
import { toggleHabitToday, useStore } from '../lib/store'
import { Art, Cover, bookHue, bookMotif } from '../ui/Cover'
import { IconCheck, IconFlame, IconPlay } from '../ui/Icons'
import { Bar, PlayGlyph, SectionHead, startLesson } from '../ui/Kit'

/** 270° gauge, opening at the bottom. */
function Gauge({ value, size = 132, children }: { value: number; size?: number; children?: React.ReactNode }) {
  const sw = 9
  const r = (size - sw) / 2 - 2
  const c = 2 * Math.PI * r
  const arc = c * 0.75
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="gaugeG" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="var(--em-600)" />
            <stop offset="1" stopColor="var(--em-300)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="gauge__track" strokeWidth={sw} strokeDasharray={`${arc} ${c}`} strokeLinecap="round" transform={`rotate(135 ${size / 2} ${size / 2})`} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#gaugeG)"
          className="gauge__value"
          strokeWidth={sw}
          strokeDasharray={`${arc * v} ${c}`}
          strokeLinecap="round"
          transform={`rotate(135 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="gauge__inner">{children}</div>
    </div>
  )
}

/** Center-focused shelf: the book nearest the middle grows, its neighbours recede. */
function Showcase({ ids }: { ids: string[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const cps = useStore((s) => s.cps)

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
        const d = (b.left + b.width / 2 - mid) / b.width
        const c = Math.max(-1.6, Math.min(1.6, d))
        ;(child as HTMLElement).style.setProperty('--d', String(c))
        ;(child as HTMLElement).style.setProperty('--a', String(Math.abs(c)))
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
  const first = book.lessons[0]
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
        <h3 className="showcase__title">{book.title}</h3>
        <p className="showcase__author">{book.author}</p>
        <dl className="showcase__stats">
          <div>
            <dt>שיעורים</dt>
            <dd>{book.lessons.length}</dd>
          </div>
          <div>
            <dt>האזנה</dt>
            <dd>{formatMinutes(bookSeconds(book))}</dd>
          </div>
          <div>
            <dt>תחום</dt>
            <dd>{categoryById[book.category].short}</dd>
          </div>
        </dl>
        <div className="showcase__actions">
          <button className="btn btn--primary" onClick={() => startLesson(first.id)}>
            <IconPlay size={14} /> האזן לשיעור הראשון
          </button>
          <button className="btn btn--ghost" onClick={() => navigate(`/book/${book.id}`)}>
            על הספר
          </button>
        </div>
        <span className="sr-only">{formatMinutes(estimateSeconds(first, cps))}</span>
      </div>
    </section>
  )
}

export function Home() {
  const s = useStore((x) => x)
  const p = usePlayer()
  const today = todaySeconds(s)
  const goal = s.dailyGoalMin * 60
  const streak = currentStreak(s)
  const recs = recommendations(s, 5)
  const daily = recs.find((r) => !s.progress[r.lessonId]?.pos) ?? recs[0]
  const dailyRef = daily ? lessonIndex[daily.lessonId] : undefined
  const habits = s.habits.filter((h) => !h.archived)
  const k = dayKey()

  const continuing = Object.entries(s.progress)
    .filter(([id, pr]) => lessonIndex[id] && !pr.done && pr.pos > 3)
    .sort((a, b) => b[1].last - a[1].last)
    .map(([id]) => id)
  const continueIds = continuing.length ? continuing.slice(0, 4) : recs.slice(0, 2).map((r) => r.lessonId)

  const focus = focusAreas(s).map((a) => a.id)
  const featured = [...new Set([...focus.flatMap((c) => books.filter((b) => b.category === c).map((b) => b.id))])]
    .filter((id) => id !== dailyRef?.book.id && !bookById[id].lessons.every((l) => s.progress[l.id]?.done))
    .slice(0, 7)
  const areas = categories
    .filter((c) => s.goals.includes(c.id))
    .concat(categories.filter((c) => !s.goals.includes(c.id)))
    .slice(0, 4)
  const initial = (s.name || 'A').trim().charAt(0)

  return (
    <div className="screen home2">
      <header className="topbar">
        <button className="avatar" onClick={() => navigate('/settings')} aria-label="פרופיל והגדרות">
          {initial}
        </button>
        <span className="wordmark" lang="en">
          ASCEND
        </span>
        <button className="streakpill" onClick={() => navigate('/progress')} aria-label={`${streak} ימים ברצף`}>
          <IconFlame size={15} />
          <span>{streak}</span>
        </button>
      </header>

      <div className="welcome">
        <p className="welcome__hello">
          {greeting()}
          {s.name ? `, ${s.name}` : ''}
        </p>
        <h1 className="welcome__title">{streak > 1 ? `${streak} ימים ברצף. ממשיכים לטפס.` : today > 0 ? 'התחלה טובה. נמשיך?' : 'מה נלמד היום?'}</h1>
      </div>

      {continueIds.length > 0 && (
        <section className="block block--tight">
          <SectionHead title={continuing.length ? 'להמשיך להאזין' : 'מתחילים'} />
          <div className="conts" role="list">
            {continueIds.map((id) => {
              const ref = lessonIndex[id]
              const pr = s.progress[id]
              const ratio = pr?.dur ? pr.pos / pr.dur : 0
              const playing = p.track?.id === id && p.status === 'playing'
              return (
                <div key={id} role="listitem" className="cont" style={{ ['--hue' as string]: bookHue(ref.book) }}>
                  <Art seed={ref.book.id} motif={bookMotif(ref.book)} hue={bookHue(ref.book)} square className="cont__bg" />
                  <button className="cont__main" onClick={() => navigate(`/book/${ref.book.id}`)}>
                    <Cover book={ref.book} size="sm" />
                    <span className="cont__text">
                      <span className="cont__title">{ref.lesson.title}</span>
                      <span className="cont__book">{ref.book.title}</span>
                      <span className="cont__meta">{ratio > 0 ? `${Math.round(ratio * 100)}%` : `שיעור ${ref.index + 1}`}</span>
                    </span>
                  </button>
                  <button className="cont__play" onClick={() => startLesson(id)} aria-label={`${playing ? 'השהה' : 'נגן'}: ${ref.lesson.title}`}>
                    <PlayGlyph playing={playing} size={16} />
                  </button>
                  {ratio > 0 && <Bar value={ratio} className="cont__bar" />}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {dailyRef && (
        <section className="block">
          <button className="daily" onClick={() => startLesson(dailyRef.lesson.id)} style={{ ['--hue' as string]: bookHue(dailyRef.book) }}>
            <Art seed={dailyRef.book.id + ':daily'} motif={bookMotif(dailyRef.book)} hue={bookHue(dailyRef.book)} className="daily__art" />
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
        <div className="goalpanel">
          <Gauge value={today / goal}>
            <strong>{Math.floor(today / 60)}</strong>
            <span>מתוך {s.dailyGoalMin} דק׳</span>
          </Gauge>
          <div className="goalpanel__side">
            <h2>{today >= goal ? 'עמדת ביעד היומי' : 'היעד של היום'}</h2>
            <p>{today >= goal ? 'כל דקה נוספת היא בונוס. המוח שלך מודה לך.' : `עוד ${formatMinutes(goal - today)} של האזנה, ואתה שם.`}</p>
            {dailyRef && today < goal && (
              <button className="btn btn--primary btn--sm" onClick={() => startLesson(dailyRef.lesson.id)}>
                <IconPlay size={12} /> המשך עכשיו
              </button>
            )}
          </div>
          <ul className="areachips" aria-label="מדד הצמיחה בתחומים שלך">
            {areas.map((c) => (
              <li key={c.id}>
                <button onClick={() => navigate('/growth')}>
                  <i style={{ ['--hue' as string]: c.hue }} />
                  {c.short}
                  <strong>{growthIndex(s, c.id)}</strong>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="block">
          <SectionHead title="נבחרו בשבילך" sub="לפי התחומים שהכי כדאי לחזק עכשיו" />
          <Showcase ids={featured} />
        </section>
      )}

      {habits.length > 0 && (
        <section className="block">
          <SectionHead title="הפעולות של היום" action="כל ההרגלים" onAction={() => navigate('/growth')} />
          <ul className="checklist">
            {habits.slice(0, 4).map((h) => {
              const on = h.checks.includes(k)
              return (
                <li key={h.id}>
                  <button className={`check ${on ? 'is-on' : ''}`} onClick={() => toggleHabitToday(h.id)} aria-pressed={on}>
                    <span className="check__box">{on && <IconCheck size={15} />}</span>
                    <span className="check__text">{h.text}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="block">
        <SectionHead title="מסלולי למידה" action="הכל" onAction={() => navigate('/explore')} />
        <div className="packs" role="list">
          {curatedPaths.map((path) => {
            const pr = pathProgress(s, path)
            return (
              <button key={path.id} role="listitem" className="pack" onClick={() => navigate(`/path/${path.id}`)}>
                <Art seed={path.id} motif={path.motif} hue={path.hue} className="pack__art" />
                <span className="pack__body">
                  <span className="pack__title">{path.title}</span>
                  <span className="pack__meta">{pr.done ? `${pr.done}/${pr.total} שיעורים` : `${pr.total} שיעורים`}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
