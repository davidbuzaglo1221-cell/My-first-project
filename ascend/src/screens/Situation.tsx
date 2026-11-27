import { lessonIndex } from '../content'
import { situationOfDay } from '../content/nudges'
import { situationById, situations } from '../content/situations'
import { navigate } from '../lib/router'
import { store, useStore } from '../lib/store'
import { IconCheck } from '../ui/Icons'
import { BackButton } from '../ui/Kit'

const NONE: Record<string, number> = {}

/** "What would you do?": a real-life situation, three responses, and why the best one works. */
export function SituationScreen({ id }: { id?: string }) {
  const s = (id && situationById[id]) || situationOfDay()
  const answers = useStore((x) => x.situations) ?? NONE
  const picked = answers[s.id]
  const ref = lessonIndex[s.lessonId]
  const choose = (i: number) => store.set((x) => ({ situations: { ...x.situations, [s.id]: i } }), { immediate: true })
  const done = Object.keys(answers).length
  const next = situations.find((x) => answers[x.id] === undefined && x.id !== s.id)
  return (
    <div className="screen situation">
      <header className="photohero photohero--situation">
        <img src="photos/situation.webp" alt="" decoding="async" />
        <div className="photohero__top">
          <BackButton fallback="/" />
        </div>
        <div className="photohero__text">
          <span className="photohero__kicker">מצב מהחיים</span>
          <h1>מה היית עושה?</h1>
          <p>שלוש דרכים להגיב. בחר, ותקבל הסבר מתוך הספרים.</p>
        </div>
      </header>

      <article className="sit">
        <span className="sit__kicker">המצב של היום</span>
        <h2>{s.title}</h2>
        <p className="sit__text">{s.text}</p>
        <ol className="sit__choices">
          {s.choices.map((c, i) => {
            const state = picked === undefined ? '' : c.best ? 'is-best' : picked === i ? 'is-picked' : 'is-dim'
            return (
              <li key={i} className={state}>
                <button onClick={() => choose(i)} disabled={picked !== undefined} aria-pressed={picked === i}>
                  <span className="sit__mark">{picked !== undefined && c.best ? <IconCheck size={14} /> : String.fromCharCode(1488 + i)}</span>
                  <span>{c.t}</span>
                </button>
                {picked !== undefined && (picked === i || c.best) && <p className="sit__why">{c.why}</p>}
              </li>
            )
          })}
        </ol>
        {picked !== undefined && (
          <div className="sit__after">
            <p>{s.choices[picked].best ? 'בדיוק. זו התגובה שעובדת.' : 'זו תגובה טבעית, ורוב האנשים בוחרים בה. עכשיו אתה יודע מה עובד יותר.'}</p>
            {ref && (
              <button className="btn btn--ghost btn--wide" onClick={() => navigate(`/book/${ref.book.id}`)}>
                הרעיון מתוך: {ref.book.title}
              </button>
            )}
            {next && (
              <button className="btn btn--primary btn--wide" onClick={() => navigate(`/situation/${next.id}`)}>
                עוד מצב אחד
              </button>
            )}
          </div>
        )}
      </article>
      <p className="sit__count">
        עברת {done} מתוך {situations.length} מצבים
      </p>
    </div>
  )
}
