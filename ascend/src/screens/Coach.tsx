import { useState } from 'react'
import { categories } from '../content'
import { coachSessionById, coachSessions } from '../content/coach'
import { addCommit, coachNotes, coachOf, finishSession, setCommit, setGoal, weekFacts } from '../lib/coach'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { IconCheck, IconChevron } from '../ui/Icons'
import { BackButton, Sheet } from '../ui/Kit'
import { toast } from '../ui/uiState'

const ago = (t: number) => {
  const d = Math.floor((Date.now() - t) / 86400000)
  return d === 0 ? 'היום' : d === 1 ? 'אתמול' : `לפני ${d} ימים`
}

/** The coach: direct, honest, strategic. Notices what you actually do, and turns talk into one action. */
export function Coach({ session }: { session?: string }) {
  if (session && coachSessionById[session]) return <SessionRunner id={session} />
  return <CoachHome />
}

function CoachHome() {
  const s = useStore((x) => x)
  const c = coachOf(s)
  const notes = coachNotes(s)
  const [goalOpen, setGoalOpen] = useState(false)
  const [mark, setMark] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const open = (c.commits ?? []).filter((x) => x.status === 'open')
  const closed = (c.commits ?? []).filter((x) => x.status !== 'open').slice(0, 5)
  const markC = (c.commits ?? []).find((x) => x.id === mark)
  return (
    <div className="screen coach">
      <header className="photohero photohero--coach">
        <img src="photos/assistant.webp" alt="" decoding="async" />
        <div className="photohero__text">
          <span className="photohero__kicker">העוזר האישי</span>
          <h1>ישיר, כן, ולעניין</h1>
          <p>בלי מחמאות ריקות. שואל את השאלה הנכונה, וסוגר כל שיחה בצעד אחד.</p>
        </div>
      </header>

      {notes.length > 0 && (
        <section className="cnotes" aria-label="מה העוזר שם לב">
          {notes.map((n) => (
            <div key={n.id} className="cnote">
              <p>{n.text}</p>
              {n.action && (
                <button className="cnote__act" onClick={() => (n.action!.commit ? setMark(n.action!.commit) : navigate(n.action!.to!))}>
                  {n.action.label}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="block">
        <h2 className="glist__title">המטרה</h2>
        <button className="cgoal" onClick={() => setGoalOpen(true)}>
          {c.goal ? (
            <>
              <strong>{c.goal.text}</strong>
              {c.goal.why && <span>למה: {c.goal.why}</span>}
              <small>{c.goal.area ? categories.find((x) => x.id === c.goal!.area)?.short + ' · ' : ''}לעדכן</small>
            </>
          ) : (
            <>
              <strong>עוד לא הגדרת מטרה</strong>
              <span>מטרה אחת ל-90 יום. העוזר מחבר אליה כל דבר אחר.</span>
              <small>להגדיר</small>
            </>
          )}
        </button>
      </section>

      <section className="block">
        <h2 className="glist__title">התחייבויות</h2>
        <ul className="glist">
          {open.map((x) => (
            <li key={x.id}>
              <button className="glist__row" onClick={() => setMark(x.id)}>
                <span className="cbox" aria-hidden="true" />
                <span className="glist__body">
                  <strong>{x.text}</strong>
                  <small>{ago(x.at)}</small>
                </span>
              </button>
            </li>
          ))}
          <li className="glist__add">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="התחייבות חדשה, קטנה וברורה" onKeyDown={(e) => e.key === 'Enter' && (addCommit(draft), setDraft(''))} />
            <button disabled={!draft.trim()} onClick={() => (addCommit(draft), setDraft(''), toast('נרשם. העוזר יחזור אליך על זה'))}>
              הוספה
            </button>
          </li>
        </ul>
        {closed.length > 0 && (
          <ul className="glist glist--quiet">
            {closed.map((x) => (
              <li key={x.id} className={`is-${x.status}`}>
                <span className="glist__row">
                  <span className={`cbox ${x.status === 'done' ? 'is-on' : ''}`} aria-hidden="true">
                    {x.status === 'done' && <IconCheck size={12} />}
                  </span>
                  <span className="glist__body">
                    <strong>{x.text}</strong>
                    <small>{x.status === 'done' ? 'בוצע' : 'שוחרר במודע'}</small>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <h2 className="glist__title">שיחה עם העוזר</h2>
        <ul className="glist">
          {coachSessions.map((x) => (
            <li key={x.id}>
              <button className="glist__row" onClick={() => navigate(`/coach/${x.id}`)}>
                <span className="glist__body">
                  <strong>{x.title}</strong>
                  <small>
                    {x.when} · {x.minutes} דק׳
                  </small>
                </span>
                <IconChevron size={16} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {(c.sessions ?? []).length > 0 && (
        <section className="block">
          <h2 className="glist__title">שיחות קודמות</h2>
          <ul className="glist glist--quiet">
            {(c.sessions ?? []).slice(0, 6).map((x) => (
              <li key={x.id}>
                <details className="chist">
                  <summary>
                    {coachSessionById[x.kind]?.title ?? x.kind} · {ago(x.at)}
                  </summary>
                  {coachSessionById[x.kind]?.questions.map((q, i) =>
                    x.answers[i] ? (
                      <p key={i}>
                        <b>{q.q}</b>
                        {x.answers[i]}
                      </p>
                    ) : null,
                  )}
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      <GoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} />
      <Sheet open={!!markC} onClose={() => setMark(null)} label="התחייבות">
        {markC && (
          <>
            <h3 className="sheet__title">{markC.text}</h3>
            <p className="sheet__lead">אמרת את זה {ago(markC.at)}. מה המצב, בכנות?</p>
            <div className="sheet__actions sheet__actions--stack">
              <button className="btn btn--primary btn--wide" onClick={() => (setCommit(markC.id, 'done'), setMark(null), toast('נרשם. ככה בונים אמון בעצמך'))}>
                עשיתי
              </button>
              <button
                className="btn btn--ghost btn--wide"
                onClick={() => {
                  setCommit(markC.id, 'dropped')
                  setMark(null)
                  navigate('/coach/avoid')
                }}
              >
                עוד לא. בוא נמצא צעד קטן יותר
              </button>
              <button className="btn btn--text btn--wide" onClick={() => (setCommit(markC.id, 'dropped'), setMark(null))}>
                לשחרר במודע
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}

function GoalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const g = useStore((x) => x.coach?.goal)
  const [text, setText] = useState(g?.text ?? '')
  const [why, setWhy] = useState(g?.why ?? '')
  const [area, setArea] = useState(g?.area ?? '')
  const save = () => {
    if (!text.trim()) return
    setGoal({ text: text.trim(), why: why.trim() || undefined, area: area || undefined, at: g?.at ?? Date.now() })
    toast('המטרה נשמרה')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} label="המטרה">
      <h3 className="sheet__title">מטרה אחת ל-90 יום</h3>
      <p className="sheet__lead">משפט אחד שאפשר לבדוק. לא "להיות יותר טוב", אלא "להכפיל את ההכנסה מתספורות עד מרץ".</p>
      <label className="field">
        <span>המטרה</span>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="field">
        <span>למה זה חשוב לך</span>
        <textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} />
      </label>
      <span className="sheet__label">התחום</span>
      <div className="chips chips--wrap">
        {categories.map((x) => (
          <button key={x.id} className={`chip ${area === x.id ? 'is-on' : ''}`} aria-pressed={area === x.id} onClick={() => setArea(area === x.id ? '' : x.id)}>
            {x.short}
          </button>
        ))}
      </div>
      <div className="sheet__actions">
        <button className="btn btn--primary btn--wide" disabled={!text.trim()} onClick={save}>
          שמירה
        </button>
      </div>
    </Sheet>
  )
}

/** One question at a time, then a summary and one action. */
function SessionRunner({ id }: { id: string }) {
  const def = coachSessionById[id]
  const s = useStore((x) => x)
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<string[]>(() => def.questions.map(() => ''))
  const [done, setDone] = useState(false)
  const facts = id === 'week' ? weekFacts(s) : null
  const q = def.questions[i]
  const set = (v: string) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)))
  const next = () => (i < def.questions.length - 1 ? setI(i + 1) : setDone(true))
  const step = answers[def.commitFrom]?.trim()

  if (done)
    return (
      <div className="screen csession">
        <header className="page-head page-head--back">
          <BackButton fallback="/coach" />
          <h1 className="page-title">{def.title}</h1>
        </header>
        <p className="page-sub">זה מה שאמרת. תקרא פעם אחת, לאט.</p>
        <ul className="glist glist--quiet csum">
          {def.questions.map((x, j) =>
            answers[j].trim() ? (
              <li key={j}>
                <p>
                  <b>{x.q}</b>
                  {answers[j].trim()}
                </p>
              </li>
            ) : null,
          )}
        </ul>
        {step ? (
          <div className="cstep">
            <span>הצעד הבא</span>
            <strong>{step}</strong>
            <button
              className="btn btn--primary btn--wide"
              onClick={() => {
                finishSession(id, answers, true)
                toast('נרשם כהתחייבות. אחזור אליך על זה')
                navigate('/coach')
              }}
            >
              להתחייב לזה
            </button>
            <button className="btn btn--text btn--wide" onClick={() => (finishSession(id, answers, false), navigate('/coach'))}>
              לשמור בלי להתחייב
            </button>
          </div>
        ) : (
          <div className="cstep">
            <p>שיחה בלי צעד היא רק מחשבה. חזור לשאלה האחרונה ותן תשובה אחת קטנה.</p>
            <button className="btn btn--ghost btn--wide" onClick={() => (setDone(false), setI(def.commitFrom))}>
              לחזור לצעד
            </button>
          </div>
        )}
      </div>
    )

  return (
    <div className="screen csession">
      <header className="page-head page-head--back">
        <BackButton fallback="/coach" />
        <h1 className="page-title">{def.title}</h1>
      </header>
      <div className="cdots" aria-label={`שאלה ${i + 1} מתוך ${def.questions.length}`}>
        {def.questions.map((_, j) => (
          <i key={j} className={j <= i ? 'is-on' : ''} />
        ))}
      </div>
      {facts && i === 0 && (
        <ul className="cfacts" aria-label="השבוע במספרים">
          <li>
            <strong>{facts.minutes}</strong>
            <span>דקות למידה</span>
          </li>
          <li>
            <strong>{facts.active}/7</strong>
            <span>ימים פעילים</span>
          </li>
          <li>
            <strong>{facts.chapters}</strong>
            <span>פרקים</span>
          </li>
          <li>
            <strong>
              {facts.done}/{facts.total}
            </strong>
            <span>התחייבויות</span>
          </li>
        </ul>
      )}
      <article className="cq" key={i}>
        <h2>{q.q}</h2>
        {q.hint && <p>{q.hint}</p>}
        <textarea autoFocus rows={5} value={answers[i]} onChange={(e) => set(e.target.value)} placeholder="כתוב בחופשיות. זה נשאר רק אצלך." />
      </article>
      <div className="cnav">
        <button className="btn btn--primary btn--wide" disabled={!answers[i].trim()} onClick={next}>
          {i < def.questions.length - 1 ? 'הלאה' : 'לסיכום'}
        </button>
        {i > 0 && (
          <button className="btn btn--text" onClick={() => setI(i - 1)}>
            חזרה
          </button>
        )}
      </div>
    </div>
  )
}
