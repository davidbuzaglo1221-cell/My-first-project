import { useEffect, useRef, useState } from 'react'
import { breathById, breaths, meditations, type Meditation } from '../content/calm'
import { hasNarration, load, usePlayer } from '../engine/player'
import { dayKey, lastNDays } from '../lib/dates'
import { chime } from '../lib/remind'
import { navigate } from '../lib/router'
import { addCalm, useStore } from '../lib/store'
import { BackButton, PlayGlyph, SectionHead } from '../ui/Kit'
import { openPlayer } from '../ui/uiState'
import { Reminders } from './Notebook'
import { NotFound } from './Explore'
import { ProgramSection } from '../ui/Daily'

const EMPTY: never[] = []
const NOOBJ: Record<string, number> = {}

const MED_ICON: Record<Meditation['kind'], string> = { program: '✦', freedom: '◎', stress: '≈', breath: '◌', posture: '│', body: '◍', sleep: '☾', morning: '☼' }
const minutes = (id: string) => {
  const n = hasNarration(`calm:${id}`)
  return n
}

/** From survival to freedom: the calm space. */
export function Freedom() {
  const p = usePlayer()
  const calm = (useStore((s) => s.calm) ?? NOOBJ)
  const week = lastNDays(7).reduce((a, d) => a + (calm[dayKey(d)] ?? 0), 0)
  const play = (id: string) => (load(`calm:${id}`, { autoplay: true, from: 0 }), openPlayer())
  const [lead, ...rest] = meditations
  return (
    <div className="screen freedom">
      <header className="fr-hero">
        <p className="fr-hero__kicker">מרחב השקט</p>
        <h1 className="fr-hero__title">מהישרדות לחופש</h1>
        <p className="fr-hero__lead">כשהגוף במצב הישרדות, אי אפשר לחשוב בבהירות, ללמוד או לבחור. כאן מלמדים את מערכת העצבים לעבור למצב של חופש: נשימה, גוף, ושקט.</p>
        <div className="fr-hero__stats">
          <span>
            <strong>{week}</strong> דקות תרגול השבוע
          </span>
        </div>
      </header>

      <button className="fr-lead" onClick={() => play(lead.id)}>
        <span className="fr-lead__orb" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="fr-lead__body">
          <small>התרגול המרכזי</small>
          <strong>{lead.title}</strong>
          <span>{lead.sub}</span>
        </span>
        <span className="fr-lead__play">
          <PlayGlyph playing={p.track?.id === `calm:${lead.id}` && p.status === 'playing'} size={20} />
        </span>
      </button>

      <ProgramSection />

      <section className="block">
        <SectionHead title="שני מצבים של הגוף" />
        <div className="states">
          <div className="state state--survival">
            <strong>הישרדות</strong>
            <p>נשימה קצרה בחזה, כתפיים מכווצות, מחשבות שרצות, תגובה לפני מחשבה.</p>
          </div>
          <div className="state state--free">
            <strong>חופש</strong>
            <p>נשימה עמוקה בבטן, גוף רפוי, ראש צלול, ומרווח לבחור את התגובה.</p>
          </div>
        </div>
        <p className="muted-line">הגשר בין השניים הוא הנשימה, וכמה דקות של תרגול ביום מספיקות כדי לבנות אותו.</p>
      </section>

      <section className="block">
        <SectionHead title="מדיטציות מודרכות" sub="בקול רגוע, עם צליל רקע שקט" />
        <div className="meds">
          {rest.map((m) => {
            const on = p.track?.id === `calm:${m.id}`
            return (
              <button key={m.id} className={`med med--${m.kind} ${on ? 'is-on' : ''}`} onClick={() => play(m.id)} disabled={!minutes(m.id)}>
                <span className="med__icon" aria-hidden="true">
                  {MED_ICON[m.kind]}
                </span>
                <span className="med__body">
                  <strong>{m.title}</strong>
                  <span>{m.sub}</span>
                </span>
                <span className="med__play">
                  <PlayGlyph playing={on && p.status === 'playing'} size={15} />
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="block">
        <SectionHead title="תרגילי נשימה" sub="עקוב אחרי העיגול. הוא נושם איתך" />
        <div className="breaths">
          {breaths.map((b) => (
            <button key={b.id} className="breathcard" onClick={() => navigate(`/breathe/${b.id}`)}>
              <span className="breathcard__dot" style={{ animationDuration: `${b.pattern.reduce((a, x) => a + x, 0)}s` }} aria-hidden="true" />
              <strong>{b.title}</strong>
              <span>{b.sub}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="block">
        <SectionHead title="גב ישר" sub="בדיקת יציבה של שלושים שניות, בכל מקום" />
        <ol className="posture">
          <li>
            <b>כפות רגליים</b> על הרצפה, ברוחב הירכיים.
          </li>
          <li>
            <b>שב על עצמות הישיבה</b>, בקצה הכיסא, לא נשען אחורה.
          </li>
          <li>
            <b>חוט דמיוני</b> מושך את קודקוד הראש אל התקרה.
          </li>
          <li>
            <b>כתפיים</b> מתגלגלות אחורה ומטה, הרחק מהאוזניים.
          </li>
          <li>
            <b>סנטר</b> נמשך מעט פנימה. החזה פתוח, הבטן רכה.
          </li>
          <li>
            <b>נשימה אחת</b> עמוקה אל הבטן. זהו.
          </li>
        </ol>
        <button className="btn btn--quiet btn--wide" onClick={() => play('posture')}>
          תרגול מודרך: גב ישר, נשימה עמוקה
        </button>
      </section>

      <section className="block">
        <SectionHead title="תזכורות" sub="לנשום, לשבת זקוף, ללמוד. בזמן שאתה בוחר" />
        <Reminders />
      </section>
    </div>
  )
}

/** The breathing trainer: an orb that grows and shrinks with the pattern. */
export function Breathe({ id }: { id: string }) {
  const b = breathById[id]
  const [run, setRun] = useState(false)
  const [phase, setPhase] = useState(0)
  const [left, setLeft] = useState(0)
  const [round, setRound] = useState(0)
  const [sound, setSound] = useState(true)
  const startAt = useRef(0)
  useEffect(() => {
    if (!run || !b) return
    let ph = 0
    let r = 0
    let t0 = performance.now()
    const steps = b.pattern.map((d, i) => ({ d, i })).filter((x) => x.d > 0)
    let k = 0
    setPhase(steps[0].i)
    setRound(1)
    if (sound) chime(0.06)
    const tick = setInterval(() => {
      const el = (performance.now() - t0) / 1000
      const cur = steps[k]
      setLeft(Math.max(0, Math.ceil(cur.d - el)))
      if (el >= cur.d) {
        k = (k + 1) % steps.length
        t0 = performance.now()
        if (k === 0) {
          r++
          if (r >= b.rounds) {
            clearInterval(tick)
            setRun(false)
            addCalm(Math.max(1, Math.round((Date.now() - startAt.current) / 60000)))
            if (sound) chime(0.12)
            return
          }
          setRound(r + 1)
        }
        ph = steps[k].i
        setPhase(ph)
        if (sound && b.id !== 'circular') chime(0.04)
        navigator.vibrate?.(30)
      }
    }, 100)
    return () => clearInterval(tick)
  }, [run])
  if (!b) return <NotFound />
  const label = ['שאיפה', 'החזק', 'נשיפה', 'החזק'][phase]
  const scale = !run ? 0.62 : phase === 0 || phase === 1 ? 1 : 0.55
  const dur = run ? b.pattern[phase] || 0.3 : 0.8
  return (
    <div className="screen breathe">
      <BackButton fallback="/freedom" />
      <h1 className="breathe__title">{b.title}</h1>
      <p className="breathe__sub">{b.sub}</p>
      <div className="orbwrap" aria-live="polite">
        <div className="orb" style={{ transform: `scale(${scale})`, transitionDuration: `${dur}s` }} />
        <div className="orb__ring" />
        <div className="orb__text">
          {run ? (
            <>
              <strong>{label}</strong>
              <span>{left}</span>
            </>
          ) : (
            <strong>מוכן?</strong>
          )}
        </div>
      </div>
      <p className="breathe__round">{run ? `סבב ${round} מתוך ${b.rounds}` : `${b.rounds} סבבים, בערך ${Math.round((b.pattern.reduce((a, x) => a + x, 0) * b.rounds) / 60) || 1} דקות`}</p>
      <p className="breathe__note">{b.note}</p>
      <div className="breathe__actions">
        <button className="btn btn--primary btn--big btn--wide" onClick={() => (startAt.current = Date.now(), setRun(!run))}>
          {run ? 'עצור' : 'התחל'}
        </button>
        <button className="btn btn--quiet" onClick={() => setSound(!sound)}>
          {sound ? 'צליל: פועל' : 'צליל: כבוי'}
        </button>
      </div>
    </div>
  )
}
