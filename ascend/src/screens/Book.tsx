import { bookById, bookSeconds, booksByCategory, categoryById, formatMinutes } from '../content'
import { load, usePlayer } from '../engine/player'
import { navigate } from '../lib/router'
import { toggleSaved, useStore } from '../lib/store'
import { Backdrop, Cover, bookHue } from '../ui/Cover'
import { IconBook, IconBookmark, IconSpark } from '../ui/Icons'
import { fullTexts } from '../content/fulltext'
import { BackButton, LessonRow, PlayGlyph, SectionHead, startLesson } from '../ui/Kit'
import { openPlayer } from '../ui/uiState'
import { NotFound } from './Explore'

export function BookScreen({ id }: { id: string }) {
  const b = bookById[id]
  const s = useStore((x) => x)
  const p = usePlayer()
  if (!b) return <NotFound />
  const c = categoryById[b.category]
  const doneCount = b.lessons.filter((l) => s.progress[l.id]?.done).length
  const started = b.lessons.some((l) => s.progress[l.id])
  const nextLesson = b.lessons.find((l) => !s.progress[l.id]?.done) ?? b.lessons[0]
  const playingHere = p.track?.bookId === b.id && p.status === 'playing'
  const saved = s.saved.includes(b.id)
  const hue = bookHue(b)
  const related = booksByCategory(b.category).filter((x) => x.id !== b.id)
  const reading = s.reading?.[b.id]
  const full = !!fullTexts[b.id]

  return (
    <div className="screen book" style={{ ['--hue' as string]: hue }}>
      <div className="bhero">
        <div className="bhero__ambient" aria-hidden="true">
          <Backdrop book={b} />
        </div>
        <BackButton fallback="/explore" />
        <Cover book={b} size="xl" className="bhero__cover" />
        {full && <span className="bhero__full">הספר המלא בעברית, לקריאה ולהאזנה</span>}
        <h1 className="bhero__title">{b.title}</h1>
        <p className="bhero__author">{b.author}</p>
        <p className="bhero__orig" lang="en" dir="ltr">
          {b.originalTitle}, {b.year < 1000 ? `c. ${b.year}` : b.year}
        </p>
        <div className="bhero__actions">
          <button className="btn btn--primary btn--big" onClick={() => startLesson(nextLesson.id)}>
            <PlayGlyph playing={playingHere} size={18} />
            {playingHere ? 'מתנגן' : started ? 'המשך האזנה' : 'האזנה'}
          </button>
          <button className="btn btn--read btn--big" onClick={() => navigate(`/read/${b.id}`)}>
            <IconBook size={18} />
            {reading ? 'המשך קריאה' : full ? 'קרא את הספר' : 'קריאה'}
          </button>
          <button className={`icon-btn icon-btn--ring ${saved ? 'is-on' : ''}`} onClick={() => toggleSaved(b.id)} aria-pressed={saved} aria-label={saved ? 'הסר משמורים' : 'שמור לספרייה'}>
            <IconBookmark filled={saved} size={20} />
          </button>
        </div>
        <button className="quick" onClick={() => (load(`${b.id}-quick`, { autoplay: true, from: 0 }), openPlayer())}>
          <IconSpark size={16} />
          <span>הספר בדקה: הרעיונות המרכזיים בהאזנה קצרה</span>
        </button>
        <ul className="bhero__facts">
          <li>
            <strong>{b.lessons.length}</strong>
            <span>שיעורים</span>
          </li>
          <li>
            <strong>{formatMinutes(bookSeconds(b))}</strong>
            <span>האזנה</span>
          </li>
          <li>
            <strong>{b.level}</strong>
            <span>רמה</span>
          </li>
        </ul>
      </div>

      <section className="block">
        <p className="book__tagline">{b.tagline}</p>
        <p className="book__why">{b.why}</p>
      </section>

      <section className="block">
        <SectionHead title="השיעורים" sub={doneCount ? `${doneCount} מתוך ${b.lessons.length} הושלמו` : 'כל שיעור מסתיים בתרגיל מעשי'} />
        <div className="list">
          {b.lessons.map((l, i) => (
            <LessonRow key={l.id} id={l.id} index={i + 1} showBook={false} />
          ))}
        </div>
      </section>

      <section className="block">
        <SectionHead title="הרעיונות המרכזיים" />
        <dl className="ideas">
          {b.ideas.map((i) => (
            <div key={i.title} className="idea">
              <dt>{i.title}</dt>
              <dd>{i.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {related.length > 0 && (
        <section className="block">
          <SectionHead title={`עוד ב${c.short}`} action="לכל התחום" onAction={() => navigate(`/explore/${c.id}`)} />
          <div className="shelf" role="list">
            {related.map((r) => (
              <button key={r.id} role="listitem" className="shelf__item" onClick={() => navigate(`/book/${r.id}`)}>
                <Cover book={r} size="md" />
                <span className="shelf__meta">{r.author}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="legal">
        השיעורים הם הסברים מקוריים של ASCEND על הרעיונות שבספר, ואינם קריינות או תרגום שלו. כדי לקבל את התמונה המלאה, כדאי לקרוא או לשמוע את הספר המקורי מגורם מורשה.
      </p>
    </div>
  )
}
