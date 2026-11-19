import { useState } from 'react'
import { booksByCategory, categories, categoryById, estimateSeconds, formatMinutes, lessonIndex } from '../content'
import type { CategoryId } from '../content/types'
import { dayKey, lastNDays } from '../lib/dates'
import { growthIndex, pathProgress, resolvePath } from '../lib/insights'
import { navigate } from '../lib/router'
import { addHabit, archiveHabit, store, toggleHabitToday, useStore } from '../lib/store'
import { CoverFan } from '../ui/Cover'
import { IconCheck, IconPlay, IconPlus, IconTrash } from '../ui/Icons'
import { BackButton, SectionHead, Sheet, startLesson } from '../ui/Kit'
import { NotFound } from './Explore'

function Radar({ now, base }: { now: number[]; base: number[] }) {
  const n = now.length
  const cx = 150
  const cy = 150
  const R = 108
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 - (i / n) * Math.PI * 2
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)]
  }
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(',')).join(' ')
  return (
    <svg viewBox="0 0 300 300" className="radar" role="img" aria-label="מפת הצמיחה בתשעה תחומים">
      {[25, 50, 75, 100].map((r) => (
        <polygon key={r} points={poly(Array(n).fill(r))} className="radar__grid" />
      ))}
      {now.map((_, i) => {
        const [x, y] = pt(i, 100)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="radar__axis" />
      })}
      <polygon points={poly(base)} className="radar__base" />
      <polygon points={poly(now)} className="radar__now" />
      {now.map((v, i) => {
        const [x, y] = pt(i, v)
        return <circle key={i} cx={x} cy={y} r={2.6} className="radar__dot" />
      })}
      {categories.map((c, i) => {
        const [x, y] = pt(i, 124)
        return (
          <text key={c.id} x={x} y={y} className="radar__label" textAnchor="middle" dominantBaseline="middle">
            {c.short}
          </text>
        )
      })}
    </svg>
  )
}

export function Growth() {
  const s = useStore((x) => x)
  const [assess, setAssess] = useState(false)
  const [newHabit, setNewHabit] = useState('')
  const areas = categories.map((c) => ({ id: c.id, score: growthIndex(s, c.id) }))
  const now = categories.map((c) => growthIndex(s, c.id))
  const base = categories.map((c) => (s.initialAssessment[c.id] ?? s.assessment[c.id] ?? 3) * 14)
  const path = resolvePath(s, 'personal')
  const pp = pathProgress(s, path)
  const habits = s.habits.filter((h) => !h.archived)
  const week = lastNDays(7)
  const k = dayKey()
  const avg = Math.round(now.reduce((a, b) => a + b, 0) / now.length)

  return (
    <div className="screen growth">
      <header className="page-head">
        <h1 className="page-title">הצמיחה שלך</h1>
        <p className="page-sub">לא כמה שמעת, אלא מה השתנה. המדד משלב איפה התחלת, מה למדת, מה תרגלת ומה הפך להרגל.</p>
      </header>

      <section className="radarbox">
        <Radar now={now} base={base} />
        <div className="radarbox__legend">
          <span className="lg lg--now">היום</span>
          <span className="lg lg--base">נקודת ההתחלה</span>
          <span className="radarbox__avg">
            מדד ממוצע <strong>{avg}</strong>
          </span>
        </div>
        <button className="link" onClick={() => setAssess(true)}>
          עדכן את ההערכה העצמית
        </button>
      </section>

      <section className="block">
        <SectionHead title="כל התחומים" sub="המדד שלך בכל תחום. אתה בוחר מה ללמוד" />
        <ul className="focus">
          {areas.map((a) => {
            const c = categoryById[a.id]
            return (
              <li key={a.id}>
                <button className="focus__item" onClick={() => navigate(`/explore/${a.id}`)}>
                  <span className="focus__score">{a.score}</span>
                  <span className="focus__body">
                    <strong>{c.name}</strong>
                    <span>{booksByCategory(a.id).length} ספרים</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="block">
        <SectionHead title="המסלול האישי שלך" sub={s.goals.length ? `מהתחומים שבחרת: ${path.subtitle}` : 'פרק מכל תחום'} action="לכל המסלול" onAction={() => navigate('/path/personal')} />
        <Roadmap lessonIds={path.lessonIds.slice(0, 5)} />
        <p className="muted-line">
          {pp.done} מתוך {pp.total} פרקים במסלול
        </p>
      </section>

      <section className="block">
        <SectionHead title="ההרגלים שלך" sub="נבנים מהתרגילים שבסוף כל שיעור" />
        {habits.length === 0 && <p className="muted-line">עוד אין הרגלים במעקב. בסוף כל פרק יש הצעה להרגל קטן, ואפשר גם להוסיף כאן הרגל משלך.</p>}
        <ul className="habits">
          {habits.map((h) => {
            const on = h.checks.includes(k)
            const ref = h.lessonId ? lessonIndex[h.lessonId] : undefined
            return (
              <li key={h.id} className="habit">
                <button className={`check ${on ? 'is-on' : ''}`} onClick={() => toggleHabitToday(h.id)} aria-pressed={on}>
                  <span className="check__box">{on && <IconCheck size={15} />}</span>
                  <span className="check__text">
                    {h.text}
                    {ref && <small>מתוך ״{ref.book.title}״</small>}
                  </span>
                </button>
                <div className="habit__week" aria-label="השבוע האחרון">
                  {week.map((d) => (
                    <i key={dayKey(d)} className={h.checks.includes(dayKey(d)) ? 'is-on' : ''} title={dayKey(d)} />
                  ))}
                </div>
                <button className="icon-btn icon-btn--sm" onClick={() => archiveHabit(h.id)} aria-label={`הסר את ההרגל ${h.text}`}>
                  <IconTrash size={16} />
                </button>
              </li>
            )
          })}
        </ul>
        <form
          className="addhabit"
          onSubmit={(e) => {
            e.preventDefault()
            if (newHabit.trim()) addHabit(newHabit.trim())
            setNewHabit('')
          }}
        >
          <input value={newHabit} onChange={(e) => setNewHabit(e.target.value)} placeholder="הרגל משלך, למשל: עשר דקות הליכה" aria-label="הרגל חדש" />
          <button className="icon-btn icon-btn--ring" aria-label="הוסף הרגל" disabled={!newHabit.trim()}>
            <IconPlus size={18} />
          </button>
        </form>
      </section>

      {s.journal.length > 0 && (
        <section className="block">
          <SectionHead title="יומן התובנות" sub="מה שכתבת אחרי הפרקים" />
          <ul className="journal">
            {s.journal.slice(0, 6).map((j) => (
              <li key={j.id}>
                <p className="journal__q">{j.prompt}</p>
                <p className="journal__a">{j.text}</p>
                <span className="journal__meta">
                  {lessonIndex[j.lessonId]?.book.title}
                  <span className="sep" aria-hidden="true" />
                  {new Date(j.at).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet open={assess} onClose={() => setAssess(false)} label="הערכה עצמית">
        <Assessment onDone={() => setAssess(false)} />
      </Sheet>
    </div>
  )
}

export function Assessment({ onDone, only }: { onDone?: () => void; only?: CategoryId[] }) {
  const a = useStore((s) => s.assessment)
  const list = only?.length ? categories.filter((c) => only.includes(c.id)) : categories
  const set = (id: CategoryId, v: number) =>
    store.set((s) => ({ assessment: { ...s.assessment, [id]: v }, initialAssessment: s.onboarded ? s.initialAssessment : { ...s.initialAssessment, [id]: v } }))
  return (
    <div className="assess">
      <h3 className="sheet__title">איפה אתה היום?</h3>
      <p className="sheet__sub">דרג בכנות, מאחת עד חמש. אין תשובה נכונה, רק נקודת התחלה.</p>
      {list.map((c) => (
        <div key={c.id} className="assess__row">
          <span>{c.name}</span>
          <div className="dots" role="radiogroup" aria-label={c.name}>
            {[1, 2, 3, 4, 5].map((v) => (
              <button key={v} role="radio" aria-checked={(a[c.id] ?? 3) === v} className={(a[c.id] ?? 3) >= v ? 'is-on' : ''} onClick={() => set(c.id, v)} aria-label={`${v}`}>
                <i />
              </button>
            ))}
          </div>
        </div>
      ))}
      {onDone && (
        <button className="btn btn--primary btn--wide" onClick={() => (store.flush(), onDone())}>
          שמור
        </button>
      )}
    </div>
  )
}

/** A vertical roadmap: a real sequence, so the steps are numbered. */
export function Roadmap({ lessonIds }: { lessonIds: string[] }) {
  const progress = useStore((s) => s.progress)
  const cps = useStore((s) => s.cps)
  const firstOpen = lessonIds.findIndex((id) => !progress[id]?.done)
  return (
    <ol className="roadmap">
      {lessonIds.map((id, i) => {
        const ref = lessonIndex[id]
        if (!ref) return null
        const done = progress[id]?.done
        const isNext = i === firstOpen
        return (
          <li key={id} className={`roadmap__step ${done ? 'is-done' : ''} ${isNext ? 'is-next' : ''}`}>
            <span className="roadmap__dot">{done ? <IconCheck size={13} /> : i + 1}</span>
            <button className="roadmap__body" onClick={() => startLesson(id)}>
              <strong>{ref.lesson.title}</strong>
              <span>
                {ref.book.title}
                <span className="sep" aria-hidden="true" />
                {formatMinutes(estimateSeconds(ref.lesson, cps))}
              </span>
              {isNext && (
                <span className="roadmap__cta">
                  <IconPlay size={11} /> הצעד הבא
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function PathScreen({ id }: { id: string }) {
  const s = useStore((x) => x)
  const path = id === 'personal' ? resolvePath(s, 'personal') : resolvePath(s, id)
  if (id !== 'personal' && path.id !== id) return <NotFound />
  const pp = pathProgress(s, path)
  const active = (s.activePathId ?? 'personal') === path.id
  const next = path.lessonIds.find((l) => !s.progress[l]?.done)
  const total = path.lessonIds.reduce((a, l) => a + (lessonIndex[l] ? estimateSeconds(lessonIndex[l].lesson, s.cps) : 0), 0)
  return (
    <div className="screen pathscreen">
      <div className="cathero">
        <CoverFan books={[...new Set(path.lessonIds.map((id) => lessonIndex[id].book))]} className="cathero__fan" />
        <BackButton fallback="/explore" />
        <div className="cathero__body">
          <h1 className="cathero__title">{path.title}</h1>
          <p className="cathero__promise">{path.description}</p>
          <p className="cathero__facts">
            {path.lessonIds.length} פרקים
            <span className="sep" aria-hidden="true" />
            {formatMinutes(total)}
            <span className="sep" aria-hidden="true" />
            {pp.done} הושלמו
          </p>
          <div className="row">
            {next && (
              <button className="btn btn--primary" onClick={() => startLesson(next)}>
                <IconPlay size={14} /> {pp.done ? 'המשך במסלול' : 'התחל את המסלול'}
              </button>
            )}
            <button className={`btn btn--ghost ${active ? 'btn--done' : ''}`} onClick={() => store.set({ activePathId: path.id }, { immediate: true })} disabled={active}>
              {active ? (
                <>
                  <IconCheck size={16} /> המסלול הפעיל שלך
                </>
              ) : (
                'קבע כמסלול פעיל'
              )}
            </button>
          </div>
        </div>
      </div>
      <section className="block">
        <Roadmap lessonIds={path.lessonIds} />
      </section>
    </div>
  )
}

