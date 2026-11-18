import { estimateSeconds, formatMinutes, lessonIndex } from '../content'
import { usePlayer } from '../engine/player'
import { dayKey, greeting } from '../lib/dates'
import { books, categoryById } from '../content'
import { load } from '../engine/player'
import { openPlayer } from '../ui/uiState'
import { currentStreak, focusAreas, pathProgress, recommendations, resolvePath, todaySeconds } from '../lib/insights'
import { navigate } from '../lib/router'
import { toggleHabitToday, useStore } from '../lib/store'
import { Cover } from '../ui/Cover'
import { IconCheck, IconFlame, IconPlay, IconSettings } from '../ui/Icons'
import { Bar, LessonRow, PlayGlyph, Ring, SectionHead, startLesson } from '../ui/Kit'

export function Home() {
  const s = useStore((x) => x)
  const p = usePlayer()
  const today = todaySeconds(s)
  const goal = s.dailyGoalMin * 60
  const streak = currentStreak(s)
  const recs = recommendations(s, 4)
  const hero = recs[0]
  const heroRef = hero ? lessonIndex[hero.lessonId] : undefined
  const heroProg = hero ? s.progress[hero.lessonId] : undefined
  const heroPlaying = p.track?.id === hero?.lessonId && p.status === 'playing'
  const path = resolvePath(s, s.activePathId)
  const pp = pathProgress(s, path)
  const habits = s.habits.filter((h) => !h.archived)
  const k = dayKey()
  const focus = focusAreas(s).map((a) => a.id)
  // One untouched book per area, most-needed areas first, so the row stays varied.
  const fresh = books.filter((b) => !b.lessons.some((l) => s.progress[l.id]))
  const quick = focus.flatMap((c) => fresh.filter((b) => b.category === c).slice(0, 1)).slice(0, 8)
  const remaining = Math.max(0, goal - today)

  return (
    <div className="screen home">
      <header className="home__top">
        <div>
          <p className="home__hello">
            {greeting()}
            {s.name ? `, ${s.name}` : ''}
          </p>
          <h1 className="home__title">{today >= goal ? 'עמדת ביעד של היום.' : today > 0 ? `עוד ${formatMinutes(remaining)} ליעד היומי.` : 'מה תלמד היום?'}</h1>
        </div>
        <button className="icon-btn" onClick={() => navigate('/settings')} aria-label="הגדרות">
          <IconSettings />
        </button>
      </header>

      <div className="today">
        <Ring value={today / goal} size={68} stroke={3.5}>
          <span className="today__min">{Math.floor(today / 60)}</span>
        </Ring>
        <div className="today__text">
          <strong>{today >= goal ? 'היעד הושג' : 'דקות האזנה היום'}</strong>
          <span>מתוך יעד של {s.dailyGoalMin} דקות</span>
        </div>
        <div className="today__streak" title="ימים ברצף">
          <IconFlame size={18} />
          <strong>{streak}</strong>
          <span>{streak === 1 ? 'יום' : 'ימים'} ברצף</span>
        </div>
      </div>

      {heroRef && (
        <section className="hero" aria-label="השיעור הבא">
          <div className="hero__glow" aria-hidden="true" />
          <button className="hero__cover" onClick={() => navigate(`/book/${heroRef.book.id}`)} aria-label={`לעמוד הספר ${heroRef.book.title}`}>
            <Cover book={heroRef.book} size="lg" />
          </button>
          <div className="hero__body">
            <span className="hero__reason">{hero!.reason}</span>
            <h2 className="hero__title">{heroRef.lesson.title}</h2>
            <p className="hero__book">
              {heroRef.book.title}
              <span className="sep" aria-hidden="true" />
              שיעור {heroRef.index + 1}
            </p>
            {heroProg && !heroProg.done && heroProg.pos > 0 && <Bar value={heroProg.dur ? heroProg.pos / heroProg.dur : 0} className="hero__bar" />}
            <button className="btn btn--primary hero__play" onClick={() => startLesson(heroRef.lesson.id)}>
              <PlayGlyph playing={heroPlaying} size={16} />
              {heroPlaying ? 'מתנגן' : heroProg?.pos ? 'המשך האזנה' : 'האזן'}
              <span className="hero__dur">{formatMinutes(estimateSeconds(heroRef.lesson, s.cps) - (heroProg?.pos ?? 0))}</span>
            </button>
          </div>
        </section>
      )}

      {habits.length > 0 && (
        <section className="block">
          <SectionHead title="הפעולות של היום" sub="מה שלמדת, בפועל" action="כל ההרגלים" onAction={() => navigate('/growth')} />
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
        <SectionHead title="הצעד הבא שלך" sub="נבחר לפי ההתקדמות והמטרות שלך" />
        <div className="list">
          {recs.slice(1).map((r) => (
            <LessonRow key={r.lessonId} id={r.lessonId} reason={r.reason} />
          ))}
        </div>
      </section>

      {quick.length > 0 && (
        <section className="block">
          <SectionHead title="יש לך רק דקה?" sub="ספר שלם ברעיונות המרכזיים שלו, ליום עמוס" />
          <div className="shelf" role="list">
            {quick.map((b) => (
              <button key={b.id} role="listitem" className="shelf__item" onClick={() => (load(`${b.id}-quick`, { autoplay: true, from: 0 }), openPlayer())} aria-label={`הספר בדקה: ${b.title}`}>
                <Cover book={b} size="md" />
                <span className="shelf__meta">
                  <IconPlay size={10} /> {categoryById[b.category].short}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="block">
        <SectionHead title="המסלול שלך" action="פתח" onAction={() => navigate(`/path/${path.id}`)} />
        <button className="pathline" onClick={() => navigate(`/path/${path.id}`)}>
          <span className="pathline__title">{path.title}</span>
          <span className="pathline__sub">{path.subtitle}</span>
          <Bar value={pp.ratio} />
          <span className="pathline__count">
            {pp.done} מתוך {pp.total} שיעורים
          </span>
        </button>
      </section>
    </div>
  )
}
