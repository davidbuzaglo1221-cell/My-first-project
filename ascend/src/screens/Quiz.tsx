import { useMemo, useState } from 'react'
import { bookById, lessonIndex } from '../content'
import { bookQuiz, chapterQuiz } from '../lib/learn'
import { navigate } from '../lib/router'
import { saveQuiz, useStore } from '../lib/store'
import { Cover } from '../ui/Cover'
import { IconCheck, IconClose } from '../ui/Icons'
import { BackButton, Ring } from '../ui/Kit'
import { startLesson } from '../ui/Kit'
import { NotFound } from './Explore'

/** A quiz built from the book itself: the whole book, or one chapter. */
export function Quiz({ bookId, lessonId }: { bookId: string; lessonId?: string }) {
  const b = bookById[bookId]
  const [round, setRound] = useState(0)
  const qs = useMemo(() => (b ? (lessonId ? chapterQuiz(lessonId) : bookQuiz(b)) : []), [b, lessonId, round])
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [right, setRight] = useState(0)
  const [missed, setMissed] = useState<string[]>([])
  const qid = lessonId ? `ch:${lessonId}` : `book:${bookId}`
  const best = useStore((s) => s.quiz?.[qid]?.best)
  if (!b || !qs.length) return <NotFound />
  const done = i >= qs.length
  const q = qs[Math.min(i, qs.length - 1)]
  const title = lessonId ? `מבחן על הפרק ״${lessonIndex[lessonId]?.lesson.title}״` : `המבחן הגדול: ${b.title}`

  const choose = (k: number) => {
    if (picked !== null) return
    setPicked(k)
    if (k === q.answer) setRight((r) => r + 1)
    else setMissed((m) => [...new Set([...m, q.lessonId])])
  }
  const next = () => {
    const n = i + 1
    setI(n)
    setPicked(null)
    if (n >= qs.length) saveQuiz(qid, right / qs.length)
  }
  const again = () => (setRound((r) => r + 1), setI(0), setPicked(null), setRight(0), setMissed([]))

  if (done) {
    const score = right / qs.length
    return (
      <div className="screen quiz quiz--done">
        <BackButton fallback={`/book/${bookId}`} />
        <Ring value={score} size={168} stroke={6} className="quiz__ring">
          <strong>{Math.round(score * 100)}%</strong>
          <span>
            {right} מתוך {qs.length}
          </span>
        </Ring>
        <h1 className="quiz__verdict">{score >= 0.9 ? 'שליטה מלאה.' : score >= 0.7 ? 'מצוין. אתה מכיר את הספר.' : score >= 0.5 ? 'בדרך הנכונה.' : 'שווה לחזור על הפרקים.'}</h1>
        {best !== undefined && <p className="muted-line">השיא שלך במבחן הזה: {Math.round(Math.max(best, score) * 100)}%</p>}
        {missed.length > 0 && (
          <div className="quiz__review">
            <p className="fgroup__label">כדאי לחזור על</p>
            {missed.map((id) => (
              <button key={id} className="quiz__redo" onClick={() => startLesson(id)}>
                {lessonIndex[id].lesson.title}
              </button>
            ))}
          </div>
        )}
        <div className="quiz__actions">
          <button className="btn btn--primary btn--wide" onClick={again}>
            מבחן חדש
          </button>
          <button className="btn btn--quiet btn--wide" onClick={() => navigate(`/book/${bookId}`)}>
            חזרה לספר
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen quiz">
      <header className="quiz__top">
        <BackButton fallback={`/book/${bookId}`} />
        <div className="quiz__steps" aria-label={`שאלה ${i + 1} מתוך ${qs.length}`}>
          {qs.map((_, k) => (
            <i key={k} className={k < i ? 'is-done' : k === i ? 'is-now' : ''} />
          ))}
        </div>
      </header>
      <div className="quiz__book">
        <Cover book={b} size="xs" />
        <span>{title}</span>
      </div>
      <p className="quiz__n">
        שאלה {i + 1} מתוך {qs.length}
      </p>
      <h2 className="quiz__q">{q.prompt}</h2>
      <div className="quiz__opts" role="radiogroup">
        {q.options.map((o, k) => {
          const state = picked === null ? '' : k === q.answer ? 'is-right' : k === picked ? 'is-wrong' : 'is-dim'
          return (
            <button key={k} role="radio" aria-checked={picked === k} className={`opt ${state}`} onClick={() => choose(k)}>
              <span className="opt__k">{'אבגד'[k]}</span>
              <span className="opt__t">{o}</span>
              {state === 'is-right' && <IconCheck size={18} />}
              {state === 'is-wrong' && <IconClose size={18} />}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <div className={`quiz__explain ${picked === q.answer ? 'is-right' : 'is-wrong'}`}>
          <strong>{picked === q.answer ? 'נכון.' : 'לא בדיוק.'}</strong> {q.explain}
        </div>
      )}
      <div className="quiz__foot">
        <button className="btn btn--primary btn--wide btn--big" disabled={picked === null} onClick={next}>
          {i + 1 < qs.length ? 'לשאלה הבאה' : 'לתוצאה'}
        </button>
      </div>
    </div>
  )
}
