import { useEffect, useRef, useState } from 'react'
import { uid } from '../lib/store'
import { ALTERNATIVES, GOAL_SUGGESTIONS, STATES, urgePatterns, type UrgeEntry, type UrgeVault } from '../lib/urge'
import { destroyVault, open, seal, vaultExists } from '../lib/vault'
import { BackButton } from '../ui/Kit'
import { toast } from '../ui/uiState'

/**
 * Urges. Private by design: everything is encrypted on this device with a code only the user knows, nothing is sent
 * anywhere, and it locks when you leave. The language never shames: an urge that was acted on is information.
 * Built on urge surfing (mindfulness-based relapse prevention), delay, and naming the urge (CBT, emotion regulation).
 */
export function UrgeScreen() {
  const [code, setCode] = useState<string | null>(null)
  const [v, setV] = useState<UrgeVault | null>(null)
  const save = async (next: UrgeVault) => {
    setV(next)
    if (code) await seal(code, next)
  }
  useEffect(() => () => (setCode(null), setV(null)), [])
  if (!v || !code) return <Gate onOpen={(c, data) => (setCode(c), setV(data))} />
  return <Unlocked v={v} save={save} lock={() => (setCode(null), setV(null))} />
}

function Gate({ onOpen }: { onOpen: (code: string, v: UrgeVault) => void }) {
  const exists = vaultExists()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [goals, setGoals] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const unlock = async () => {
    setBusy(true)
    const data = await open<UrgeVault>(a)
    setBusy(false)
    if (!data) return setErr('הקוד לא נכון')
    onOpen(a, data)
  }
  const create = async () => {
    if (a.length < 4 || a !== b) return setErr(a !== b ? 'הקודים לא זהים' : 'לפחות 4 ספרות')
    setBusy(true)
    const v: UrgeVault = { goals, entries: [] }
    await seal(a, v)
    setBusy(false)
    onOpen(a, v)
  }
  return (
    <div className="screen urge">
      <header className="photohero photohero--power">
        <img src="photos/inner-power.webp" alt="" decoding="async" />
        <InnerLight />
        <div className="photohero__top">
          <BackButton fallback="/more" />
        </div>
        <div className="photohero__text">
          <span className="photohero__kicker">כוח פנימי</span>
          <h1>אתה מחליט, לא הדחף</h1>
          <p>מקום פרטי לגמרי. בלי שיפוט, בלי בושה. דחף הוא דבר טבעי; המטרה היא שאתה תבחר מה לעשות איתו.</p>
        </div>
      </header>
      <div className="mhonest">
        <strong>פרטיות</strong>
        <p>הכל נשמר רק בטלפון הזה, מוצפן בקוד שרק אתה יודע. הקוד לא נשמר בשום מקום: בלעדיו אף אחד, גם לא האפליקציה, לא יכול לקרוא. שום דבר מכאן לא נשלח לאינטרנט. אם תשכח את הקוד, המידע לא ניתן לשחזור.</p>
      </div>
      {!exists && (
        <section className="block">
          <h2 className="glist__title">על מה אתה רוצה לעבוד? (אפשר לבחור כמה)</h2>
          <div className="mwhy">
            {GOAL_SUGGESTIONS.map((g) => (
              <button key={g} className={`chip ${goals.includes(g) ? 'is-on' : ''}`} onClick={() => setGoals(goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g])}>
                {g}
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="block ugate">
        <input className="mfield ucode" type="password" inputMode="numeric" autoComplete="off" value={a} onChange={(e) => (setA(e.target.value.replace(/\D/g, '').slice(0, 8)), setErr(''))} placeholder={exists ? 'הקוד שלך' : 'בחר קוד (לפחות 4 ספרות)'} />
        {!exists && <input className="mfield ucode" type="password" inputMode="numeric" autoComplete="off" value={b} onChange={(e) => (setB(e.target.value.replace(/\D/g, '').slice(0, 8)), setErr(''))} placeholder="עוד פעם, לאישור" />}
        {err && <p className="sheet__note">{err}</p>}
        <button className="btn btn--primary btn--wide" disabled={busy || a.length < 4} onClick={exists ? unlock : create}>
          {busy ? 'רגע...' : exists ? 'פתיחה' : 'יצירת מקום פרטי'}
        </button>
        {exists && (
          <button
            className="btn btn--text btn--wide"
            onClick={() => {
              if (confirm('למחוק את כל המידע הפרטי לצמיתות? אי אפשר לבטל.')) (destroyVault(), location.reload())
            }}
          >
            שכחתי את הקוד: מחיקה והתחלה מחדש
          </button>
        )}
      </section>
    </div>
  )
}

type Step = 'home' | 'stop' | 'name' | 'context' | 'surf' | 'alt' | 'after'

function Unlocked({ v, save, lock }: { v: UrgeVault; save: (v: UrgeVault) => Promise<void>; lock: () => void }) {
  const [step, setStep] = useState<Step>('home')
  const [e, setE] = useState<UrgeEntry | null>(null)
  const p = urgePatterns(v)
  const begin = () => (setE({ id: uid(), at: Date.now(), area: v.goals[0] ?? '', intensity: 6, states: [], outcome: 'open' }), setStep('stop'))
  const finish = async (outcome: UrgeEntry['outcome']) => {
    if (!e) return
    await save({ ...v, entries: [...v.entries, { ...e, outcome }] })
    setE(null)
    setStep('home')
    toast(outcome === 'passed' ? 'עברת את זה. הגוף לומד מכל פעם כזו' : 'נרשם. זה מידע, לא כישלון. מה למדת על הרגע הזה?')
  }
  if (step !== 'home' && e) return <Protocol e={e} setE={setE} step={step} setStep={setStep} finish={finish} />
  return (
    <div className="screen urge">
      <header className="photohero photohero--power photohero--short">
        <img src="photos/inner-power.webp" alt="" decoding="async" />
        <InnerLight />
        <div className="photohero__top">
          <BackButton fallback="/more" />
        </div>
        <div className="photohero__text">
          <span className="photohero__kicker">כוח פנימי</span>
          <h1>הבחירה אצלך</h1>
        </div>
      </header>
      <button className="urge__now" onClick={begin}>
        <strong>יש דחף עכשיו</strong>
        <span>שש דקות שמחזירות לך את הבחירה</span>
      </button>

      <section className="block">
        <h2 className="glist__title">השבוע</h2>
        {p.total === 0 ? (
          <p className="mempty">כאן יופיעו דפוסים אחרי כמה תיעודים: באילו שעות, באיזה מצב, ומה עוזר לך.</p>
        ) : (
          <ul className="cfacts mfacts">
            <li>
              <strong>{p.week.total}</strong>
              <span>דחפים שתועדו</span>
            </li>
            <li>
              <strong>{p.week.passed}</strong>
              <span>עברו בלי לפעול</span>
            </li>
            <li>
              <strong>{p.avgDrop !== null ? `-${p.avgDrop.toFixed(1)}` : '—'}</strong>
              <span>ירידה בעוצמה אחרי המתנה</span>
            </li>
          </ul>
        )}
        {p.topBand && (
          <p className="mfact">
            רוב הדחפים מופיעים ב<strong>{p.topBand[0]}</strong> ({p.topBand[1]} מתוך {p.total}).
            {p.topStates.length > 0 && ` המצבים הנפוצים: ${p.topStates.map(([s, n]) => `${s} (${n})`).join(', ')}.`}
          </p>
        )}
        {p.byState.length > 0 && (
          <p className="mfact">
            איפה השליטה טובה יותר:{' '}
            {p.byState
              .sort((a, b) => b.passed / b.n - a.passed / a.n)
              .map((x) => `${x.st}: ${x.passed}/${x.n}`)
              .join(' · ')}
          </p>
        )}
      </section>

      {v.entries.length > 0 && (
        <section className="block">
          <h2 className="glist__title">תיעודים אחרונים</h2>
          <ul className="glist glist--quiet">
            {[...v.entries].reverse().slice(0, 8).map((x) => (
              <li key={x.id}>
                <span className="glist__row">
                  <span className="glist__body">
                    <strong>
                      {new Date(x.at).toLocaleString('he-IL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · עוצמה {x.intensity}
                      {x.after !== undefined ? `→${x.after}` : ''}
                    </strong>
                    <small>
                      {[x.states.join(', '), x.trigger, x.alternative, x.outcome === 'passed' ? 'עבר' : x.outcome === 'acted' ? 'פעלתי לפי הדחף' : ''].filter(Boolean).join(' · ')}
                    </small>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="block uscience">
        <summary>על מה זה מבוסס</summary>
        <p>
          <b>"גלישה על הדחף" (Urge Surfing):</b> לשים לב לדחף כגל שעולה ויורד, בלי לפעול ובלי להילחם. נבדקה כחלק מתוכניות מניעת הישנות מבוססות קשב, עם תוצאות מבטיחות אך ממחקרים מוגבלים בגודלם. רמת ראיות: מוגבלת-בינונית.
        </p>
        <p>
          <b>דחיית תגובה ושינוי סביבה:</b> עקרונות מרכזיים בטיפול קוגניטיבי-התנהגותי בהרגלים כפייתיים. הראיות לטיפול כולו טובות; לכל תרגיל בנפרד, פחות.
        </p>
        <p>
          <b>מה לא נבטיח:</b> לא נבטיח "איפוס דופמין", שינוי בטסטוסטרון או שינוי מוחי מוגדר. הטענות האלה לא מבוססות מספיק. אם הדחפים פוגעים בחיים שלך, שיחה עם איש מקצוע היא צעד של כוח.
        </p>
      </details>

      <div className="mpause__actions">
        <button className="btn btn--ghost btn--wide" onClick={lock}>
          נעילה
        </button>
      </div>
    </div>
  )
}

function Protocol({ e, setE, step, setStep, finish }: { e: UrgeEntry; setE: (e: UrgeEntry) => void; step: Step; setStep: (s: Step) => void; finish: (o: UrgeEntry['outcome']) => void }) {
  const [mins, setMins] = useState(6)
  const [start, setStart] = useState<number | null>(null)
  const [, setT] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (step !== 'surf' || !start) return
    timer.current = window.setInterval(() => setT((x) => x + 1), 500)
    return () => clearInterval(timer.current)
  }, [step, start])
  const left = start ? Math.max(0, mins * 60 - Math.floor((Date.now() - start) / 1000)) : mins * 60
  const phase = start ? Math.floor((Date.now() - start) / 1000) % 10 : 0
  const steps: Step[] = ['stop', 'name', 'context', 'surf', 'alt', 'after']
  return (
    <div className="screen urge uproto">
      <div className="cdots" aria-label={`שלב ${steps.indexOf(step) + 1} מתוך 6`}>
        {steps.map((s, i) => (
          <i key={s} className={i <= steps.indexOf(step) ? 'is-on' : ''} />
        ))}
      </div>
      {step === 'stop' && (
        <article className="cq">
          <h2>עצור. רק לרגע.</h2>
          <p>לא צריך להחליט כלום עכשיו. נשימה אחת איטית, ונשיפה ארוכה.</p>
          <div className="ubreath" aria-hidden="true" />
          <button className="btn btn--primary btn--wide" onClick={() => setStep('name')}>
            נשמתי
          </button>
        </article>
      )}
      {step === 'name' && (
        <article className="cq">
          <h2>תן לזה שם, בלי לשפוט</h2>
          <p>"יש לי דחף." זה הכל. כמה הוא חזק עכשיו?</p>
          <input type="range" min={1} max={10} value={e.intensity} onChange={(x) => setE({ ...e, intensity: +x.target.value })} className="urange" aria-label="עוצמה" />
          <div className="urange__val">{e.intensity} מתוך 10</div>
          <button className="btn btn--primary btn--wide" onClick={() => setStep('context')}>
            הלאה
          </button>
        </article>
      )}
      {step === 'context' && (
        <article className="cq">
          <h2>מה קורה סביב הדחף?</h2>
          <div className="mwhy">
            {STATES.map((s) => (
              <button key={s} className={`chip ${e.states.includes(s) ? 'is-on' : ''}`} onClick={() => setE({ ...e, states: e.states.includes(s) ? e.states.filter((x) => x !== s) : [...e.states, s] })}>
                {s}
              </button>
            ))}
          </div>
          <textarea rows={2} value={e.trigger ?? ''} onChange={(x) => setE({ ...e, trigger: x.target.value })} placeholder="מה קרה רגע לפני? (לא חובה)" />
          <button className="btn btn--primary btn--wide" onClick={() => setStep('surf')}>
            הלאה
          </button>
        </article>
      )}
      {step === 'surf' && (
        <article className="cq usurf">
          <h2>גלישה על הגל</h2>
          <p>דחף עולה, מגיע לשיא, ויורד. כמו גל. לא נלחמים בו ולא נכנעים לו. רק מסתכלים עליו עד שהוא חולף.</p>
          {!start ? (
            <>
              <div className="chips">
                {[3, 6, 10].map((m) => (
                  <button key={m} className={`chip ${mins === m ? 'is-on' : ''}`} onClick={() => setMins(m)}>
                    {m} דקות
                  </button>
                ))}
              </div>
              <button className="btn btn--primary btn--wide" onClick={() => setStart(Date.now())}>
                להתחיל
              </button>
            </>
          ) : (
            <>
              <div className={`uwave ${phase < 4 ? 'is-in' : 'is-out'}`} aria-hidden="true" />
              <div className="mtimer__clock">
                {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              </div>
              <p className="usurf__cue">{phase < 4 ? 'שאיפה...' : 'נשיפה ארוכה...'} שים לב איפה בגוף אתה מרגיש את הדחף.</p>
              <button
                className={`btn ${left === 0 ? 'btn--primary' : 'btn--ghost'} btn--wide`}
                onClick={() => (setE({ ...e, delayed: Math.round((Date.now() - start) / 60000) }), setStep('alt'))}
              >
                {left === 0 ? 'הגל עבר. הלאה' : 'להמשיך הלאה'}
              </button>
            </>
          )}
        </article>
      )}
      {step === 'alt' && (
        <article className="cq">
          <h2>מה עכשיו במקום?</h2>
          <p>פעולה קצרה שמשנה את המצב של הגוף או את המקום.</p>
          <div className="mwhy">
            {ALTERNATIVES.map((a) => (
              <button key={a} className={`chip ${e.alternative === a ? 'is-on' : ''}`} onClick={() => setE({ ...e, alternative: a })}>
                {a}
              </button>
            ))}
          </div>
          <button className="btn btn--primary btn--wide" onClick={() => setStep('after')}>
            {e.alternative ? 'עשיתי' : 'דלג'}
          </button>
        </article>
      )}
      {step === 'after' && (
        <article className="cq">
          <h2>ועכשיו, כמה הוא חזק?</h2>
          <input type="range" min={0} max={10} value={e.after ?? e.intensity} onChange={(x) => setE({ ...e, after: +x.target.value })} className="urange" aria-label="עוצמה עכשיו" />
          <div className="urange__val">
            {e.after ?? e.intensity} מתוך 10 (בהתחלה: {e.intensity})
          </div>
          <div className="mpause__actions">
            <button className="btn btn--primary btn--wide" onClick={() => finish('passed')}>
              הדחף עבר
            </button>
            <button className="btn btn--ghost btn--wide" onClick={() => finish('acted')}>
              פעלתי לפי הדחף
            </button>
            <button className="btn btn--text btn--wide" onClick={() => finish('open')}>
              עוד לא יודע, לשמור
            </button>
          </div>
        </article>
      )}
    </div>
  )
}

/** INNER POWER: soft emerald light rising from the body, rays, slow dust and low fog. Pure CSS, still when motion is reduced. */
function InnerLight() {
  return (
    <div className="ilight" aria-hidden="true">
      <i className="ilight__glow" />
      <i className="ilight__rays" />
      <i className="ilight__rise" />
      <span className="ilight__dust">
        {Array.from({ length: 18 }, (_, k) => (
          <b key={k} style={{ ['--x' as string]: `${(k * 37) % 100}%`, ['--d' as string]: `${(k * 1.7) % 9}s`, ['--s' as string]: `${1 + (k % 3)}px`, ['--t' as string]: `${9 + (k % 5) * 2}s` }} />
        ))}
      </span>
      <i className="ilight__fog" />
    </div>
  )
}
