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
import { bookPercent, chapterLearned } from '../lib/learn'
import { IconChat, IconPen, IconQuiz } from '../ui/Icons'
import { Learned } from '../ui/Books'
import { NoteEditor } from './Notebook'
import { useState } from 'react'

export function BookScreen({ id }: { id: string }) {
  const [note, setNote] = useState(false)
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
  const full = !!fullTexts[b.id] || !!b.complete
  const pct = bookPercent(s, b)
  const best = s.quiz?.[`book:${b.id}`]?.best
  const notes = (s.notes ?? []).filter((n) => n.bookId === b.id).length

  return (
    <div className="screen book" style={{ ['--hue' as string]: hue }}>
      <div className="bhero">
        <div className="bhero__ambient" aria-hidden="true">
          <Backdrop book={b} />
        </div>
        <BackButton fallback="/explore" />
        <Cover book={b} size="xl" className="bhero__cover" />
        {full && <span className="bhero__full">{b.complete ? 'כל הספר, רק העיקר. לקריאה ולהאזנה' : 'הספר המלא בעברית, לקריאה ולהאזנה'}</span>}
        <h1 className="bhero__title">{b.title}</h1>
        <p className="bhero__author">{b.author}</p>
        <p className="bhero__orig" lang="en" dir="ltr">
          {b.originalTitle}, {b.year < 0 ? `c. ${-b.year} BC` : b.year < 1000 ? `c. ${b.year}` : b.year}
        </p>
        <div className="bhero__actions">
          <button className="btn btn--primary btn--big" onClick={() => startLesson(nextLesson.id)}>
            <PlayGlyph playing={playingHere} size={18} />
            {playingHere ? 'מתנגן' : started ? 'המשך האזנה' : full ? 'האזן לספר' : 'האזנה'}
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
            <span>{full ? 'פרקים' : 'שיעורים'}</span>
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

      <section className="block learnbox">
        <div className="learnbox__head">
          <span className="learnbox__pct">{pct}%</span>
          <span className="learnbox__label">{pct === 0 ? 'עוד לא התחלת את הספר' : pct >= 100 ? 'למדת את כל הספר' : 'מהספר כבר למדת'}</span>
        </div>
        <Learned value={pct} />
        <div className="tools3">
          <button className="tool" onClick={() => navigate(`/quiz/${b.id}`)}>
            <IconQuiz size={20} />
            <strong>מבחן</strong>
            <small>{best !== undefined ? `שיא: ${Math.round(best * 100)}%` : 'עשר שאלות'}</small>
          </button>
          <button className="tool" onClick={() => navigate(`/ask/${b.id}`)}>
            <IconChat size={20} />
            <strong>שאל את הספר</strong>
            <small>כל שאלה, תשובה מהספר</small>
          </button>
          <button className="tool" onClick={() => setNote(true)}>
            <IconPen size={20} />
            <strong>פתק</strong>
            <small>{notes ? `${notes} פתקים` : 'מה למדתי'}</small>
          </button>
        </div>
      </section>

      <section className="block">
        <p className="book__tagline">{b.tagline}</p>
        <p className="book__why">{b.why}</p>
      </section>

      <section className="block">
        <SectionHead title={full ? 'פרקי הספר' : 'השיעורים'} sub={doneCount ? `${doneCount} מתוך ${b.lessons.length} הושלמו` : full ? 'כל הספר, פרק אחר פרק. כל פרק מסתיים בתרגיל מעשי' : 'כל שיעור מסתיים בתרגיל מעשי'} />
        <div className="list">
          {b.lessons.map((l, i) => (
            <div key={l.id} className={`chrow ${chapterLearned(s, l.id) >= 1 ? 'is-learned' : ''}`}>
              <LessonRow id={l.id} index={i + 1} showBook={false} />
              <button className="chrow__quiz" onClick={() => navigate(`/quiz/${b.id}/${l.id}`)} aria-label={`מבחן על ${l.title}`}>
                <IconQuiz size={17} />
              </button>
            </div>
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

      <NoteEditor open={note} onClose={() => setNote(false)} bookId={b.id} />
      <p className="legal">
        {b.complete ? 'הפרקים מסכמים את כל הספר בניסוח מקורי של ALEXANDRIA, רק העיקר ובלי מילוי. הם אינם תרגום או קריינות של הטקסט המקורי.' : 'השיעורים הם הסברים מקוריים של ALEXANDRIA על הרעיונות שבספר, ואינם קריינות או תרגום שלו.'}
      </p>
    </div>
  )
}
