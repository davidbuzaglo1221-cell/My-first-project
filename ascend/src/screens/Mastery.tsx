import { useEffect, useRef, useState } from 'react'
import { addDays, dayKey } from '../lib/dates'
import { todaySeconds } from '../lib/insights'
import {
  addTasks, dayPlan, fmtMin, LADDER, ladderState, logChallenge, logPause, logSleep, MAX_TASKS_PER_DAY, mastery, moveTask, nextWakeTarget, parseSpoken,
  pauseStats, planFollowThrough, rank, removeTask, routines, setDay, setLimits, setRoutineItems, setSleep, setUsage, sleepStats, tasksFor, toggleRoutine,
  toggleTask, weekUsage, type Task,
} from '../lib/mastery'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { vaultExists } from '../lib/vault'
import { IconCheck, IconChevron } from '../ui/Icons'
import { BackButton, Sheet } from '../ui/Kit'
import { toast } from '../ui/uiState'

const APP_URL = 'https://davidbuzaglo1221-cell.github.io/My-first-project/'

function Hero({ img, kicker, title, line, back = '/mastery', pos }: { img: string; kicker: string; title: string; line?: string; back?: string | null; pos?: string }) {
  return (
    <header className="photohero">
      <img src={`photos/${img}.webp`} alt="" decoding="async" style={pos ? { objectPosition: pos } : undefined} />
      {back && (
        <div className="photohero__top">
          <BackButton fallback={back} />
        </div>
      )}
      <div className="photohero__text">
        <span className="photohero__kicker">{kicker}</span>
        <h1>{title}</h1>
        {line && <p>{line}</p>}
      </div>
    </header>
  )
}

/* ====================== hub ====================== */
export function MasteryHub() {
  const s = useStore((x) => x)
  const today = tasksFor(s)
  const plan = dayPlan(s)
  const sl = sleepStats(s, 7)
  const ps = pauseStats(s)
  const ld = ladderState(s)
  const speech = (s.speech ?? []).length
  const ft = planFollowThrough(s)
  const rows = [
    { to: '/mastery/day', t: 'היום שלי', d: plan.focus ? `המטרה: ${plan.focus}` : 'מטרה אחת, פעולה אחת, תרגול אחד, צעד אחד מחוץ לנוחות', m: today.length ? `${today.filter((x) => x.done).length}/${Math.min(today.length, MAX_TASKS_PER_DAY)} משימות` : '' },
    { to: '/mastery/sleep', t: 'שינה ושגרה', d: sl ? `${sl.nights} לילות מתועדים · ממוצע ${sl.avgHours.toFixed(1)} שעות` : 'שעת שינה, שעת יקיצה, שגרת בוקר וערב', m: '' },
    { to: '/mastery/screen', t: 'זמן מסך וגלילה', d: ps.total ? `${ps.total} עצירות השבוע · ${ps.closed + ps.alternative} בחירות אחרות` : 'מגבלות לכל אפליקציה ועצירה לפני גלילה', m: '' },
    { to: '/mastery/urge', t: 'דחפים', d: vaultExists() ? 'פרטי ומוצפן. נפתח רק עם הקוד שלך' : 'פרוטוקול להתמודדות עם דחף, פרטי לגמרי', m: '' },
    { to: '/mastery/discipline', t: 'משמעת', d: `שלב ${ld.level} · אתגרים שעולים איתך`, m: '' },
    { to: '/mastery/speech', t: 'דיבור וקול', d: speech ? `${speech} הקלטות נמדדו` : 'הקלטה, מדידה ותרגילים יומיים', m: '' },
  ]
  return (
    <div className="screen mastery">
      <Hero img="progress" kicker="שליטה" title="לא רק לעקוב. להוביל." line="מקום אחד לעבוד על כל תחום. כל מספר כאן מגיע ממה שעשית באמת." back={null} />
      {ft.planned > 0 && (
        <p className="mfact">
          השבוע ביצעת <strong>{ft.done}</strong> מתוך <strong>{ft.planned}</strong> דברים שתכננת.
        </p>
      )}
      <ul className="glist">
        {rows.map((r) => (
          <li key={r.to}>
            <button className="glist__row" onClick={() => navigate(r.to)}>
              <span className="glist__body">
                <strong>{r.t}</strong>
                <small>{r.d}</small>
              </span>
              {r.m && <span className="mbadge">{r.m}</span>}
              <IconChevron size={16} />
            </button>
          </li>
        ))}
      </ul>
      <ul className="glist glist--quiet">
        <li>
          <button className="glist__row" onClick={() => navigate('/progress')}>
            <span className="glist__body">
              <strong>ההתקדמות בלמידה</strong>
              <small>ספרים, פרקים, רצף ימים</small>
            </span>
            <IconChevron size={16} />
          </button>
        </li>
      </ul>
    </div>
  )
}

/* ====================== the day: 1% better ====================== */
type Rec = { start(): void; stop(): void; abort(): void; lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null }
const Recognition = () => (globalThis as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ?? (globalThis as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition

export function useDictation(onText: (t: string) => void) {
  const [on, setOn] = useState(false)
  const rec = useRef<Rec | null>(null)
  const supported = !!Recognition()
  const start = () => {
    const R = Recognition()
    if (!R) return toast('הקלטה קולית לא זמינה כאן. אפשר להקליד')
    const r = new R()
    r.lang = 'he-IL'
    r.continuous = true
    r.interimResults = false
    r.onresult = (e) => {
      let t = ''
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + ' '
      if (t.trim()) onText(t.trim())
    }
    r.onend = () => setOn(false)
    r.onerror = (e) => (setOn(false), e.error !== 'aborted' && toast(e.error === 'not-allowed' ? 'צריך לאשר גישה למיקרופון' : 'ההקלטה נעצרה. נסה שוב'))
    rec.current = r
    r.start()
    setOn(true)
  }
  const stop = () => rec.current?.stop()
  useEffect(() => () => rec.current?.abort(), [])
  return { on, start, stop, supported }
}

const SLOTS = [
  { k: 'action', label: 'פעולת ביצוע אחת', ph: 'הדבר שאם תעשה אותו היום, תהיה גאה' },
  { k: 'skill', label: 'תרגול מיומנות אחת', ph: 'דיבור, כתיבה, אימון, מכירה...' },
  { k: 'stretch', label: 'צעד אחד מחוץ לנוחות', ph: 'שיחה, בקשה, החלטה שאתה דוחה' },
] as const

export function MasteryDay() {
  const s = useStore((x) => x)
  const plan = dayPlan(s)
  const all = tasksFor(s).sort((a, b) => rank(b) - rank(a) || a.at - b.at)
  const top = all.slice(0, MAX_TASKS_PER_DAY)
  const rest = all.slice(MAX_TASKS_PER_DAY)
  const ideas = (mastery(s).tasks ?? []).filter((t) => t.kind === 'idea' && !t.done)
  const learnMin = Math.round(todaySeconds(s) / 60)
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<Omit<Task, 'id' | 'at'>[] | null>(null)
  const dict = useDictation((t) => setText((x) => (x ? x + ' ' : '') + t))
  const ft = planFollowThrough(s)
  const [review, setReview] = useState(plan.review ?? { went: '', learn: '', adjust: '', at: 0 })
  const tomorrow = dayKey(addDays(new Date(), 1))
  return (
    <div className="screen mday">
      <Hero img="notebook" kicker="היום שלי" title="אחוז אחד טוב יותר" line="לא שלושים משימות. מעט דברים נכונים, שבאמת קורים." />

      <section className="block">
        <h2 className="glist__title">המטרה המרכזית של היום</h2>
        <input className="mfield" value={plan.focus ?? ''} onChange={(e) => setDay({ focus: e.target.value })} placeholder="משפט אחד. מה הכי חשוב היום?" />
        <ul className="glist mslots">
          {SLOTS.map((x) => (
            <li key={x.k}>
              <div className="glist__row">
                <button className={`cbox ${plan.done?.[x.k] ? 'is-on' : ''}`} disabled={!plan[x.k]} onClick={() => setDay({ done: { ...plan.done, [x.k]: !plan.done?.[x.k] } })} aria-label={`סמן ${x.label}`}>
                  {plan.done?.[x.k] && <IconCheck size={12} />}
                </button>
                <span className="glist__body">
                  <small>{x.label}</small>
                  <input className="mfield mfield--inline" value={plan[x.k] ?? ''} onChange={(e) => setDay({ [x.k]: e.target.value })} placeholder={x.ph} />
                </span>
              </div>
            </li>
          ))}
          <li>
            <button className="glist__row" onClick={() => navigate('/')}>
              <span className={`cbox ${learnMin >= s.dailyGoalMin ? 'is-on' : ''}`}>{learnMin >= s.dailyGoalMin && <IconCheck size={12} />}</span>
              <span className="glist__body">
                <small>זמן למידה</small>
                <strong>
                  {learnMin} מתוך {s.dailyGoalMin} דקות היום
                </strong>
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section className="block">
        <h2 className="glist__title">שלושת הדברים של היום</h2>
        {top.length === 0 && <p className="mempty">עוד אין משימות להיום. דבר או כתוב למטה מה אתה רוצה לעשות.</p>}
        <ul className="glist">
          {top.map((t) => (
            <TaskRow key={t.id} t={t} tomorrow={tomorrow} />
          ))}
        </ul>
        {rest.length > 0 && (
          <>
            <p className="mnote">
              יש עוד {rest.length} משימות להיום. שלוש זה מה שבאמת נכנס ביום. את השאר אפשר להעביר למחר בלחיצה.
            </p>
            <ul className="glist glist--quiet">
              {rest.map((t) => (
                <TaskRow key={t.id} t={t} tomorrow={tomorrow} />
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="block mcapture">
        <h2 className="glist__title">לדבר את היום</h2>
        <p className="mnote">לדוגמה: "מחר אני רוצה להתאמן ב-7, לקרוא, ולחפש דירה. חשוב לשלם חשבון חשמל". שום דבר לא נשמר בלי אישור.</p>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="מה אתה רוצה לעשות?" />
        <div className="mcapture__bar">
          {dict.supported && (
            <button className={`btn btn--ghost ${dict.on ? 'is-rec' : ''}`} onClick={dict.on ? dict.stop : dict.start}>
              {dict.on ? 'עצור הקלטה' : 'הקלטה קולית'}
            </button>
          )}
          <button className="btn btn--primary" disabled={!text.trim()} onClick={() => setDraft(parseSpoken(text))}>
            פרק למשימות
          </button>
        </div>
      </section>

      {ideas.length > 0 && (
        <section className="block">
          <h2 className="glist__title">רעיונות, לא משימות</h2>
          <ul className="glist glist--quiet">
            {ideas.slice(0, 8).map((t) => (
              <li key={t.id}>
                <div className="glist__row">
                  <span className="glist__body">
                    <strong>{t.text}</strong>
                  </span>
                  <button className="btn btn--text" onClick={() => removeTask(t.id)}>
                    מחק
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block">
        <h2 className="glist__title">סיכום היום</h2>
        {ft.planned > 0 && (
          <p className="mfact">
            ב-7 הימים האחרונים: <strong>{ft.done}</strong> מתוך <strong>{ft.planned}</strong> דברים שתוכננו בוצעו בפועל.
          </p>
        )}
        <label className="field">
          <span>מה הלך טוב היום?</span>
          <textarea rows={2} value={review.went} onChange={(e) => setReview({ ...review, went: e.target.value })} />
        </label>
        <label className="field">
          <span>מה למדתי?</span>
          <textarea rows={2} value={review.learn} onChange={(e) => setReview({ ...review, learn: e.target.value })} />
        </label>
        <label className="field">
          <span>מה אשנה מחר? (לא עונש, התאמה)</span>
          <textarea rows={2} value={review.adjust} onChange={(e) => setReview({ ...review, adjust: e.target.value })} />
        </label>
        <button className="btn btn--primary btn--wide" disabled={!review.went && !review.learn && !review.adjust} onClick={() => (setDay({ review: { ...review, at: Date.now() } }), toast('הסיכום נשמר'))}>
          {plan.review ? 'עדכון הסיכום' : 'שמירת הסיכום'}
        </button>
      </section>

      <Sheet open={!!draft} onClose={() => setDraft(null)} label="אישור משימות">
        {draft && (
          <>
            <h3 className="sheet__title">זה מה שהבנתי</h3>
            <p className="sheet__lead">סמן מה נכון, תקן, ורק אז נשמור.</p>
            <ul className="glist mdraft">
              {draft.map((t, i) => (
                <li key={i}>
                  <div className="glist__row mdraft__row">
                    <input className="mfield mfield--inline" value={t.text} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                    <div className="chips">
                      <button className={`chip ${t.kind === 'task' ? 'is-on' : ''}`} onClick={() => setDraft(draft.map((x, j) => (j === i ? { ...x, kind: x.kind === 'task' ? 'idea' : 'task' } : x)))}>
                        {t.kind === 'task' ? 'משימה' : 'רעיון'}
                      </button>
                      <button className={`chip ${t.important ? 'is-on' : ''}`} onClick={() => setDraft(draft.map((x, j) => (j === i ? { ...x, important: !x.important } : x)))}>
                        חשוב
                      </button>
                      <button className={`chip ${t.urgent ? 'is-on' : ''}`} onClick={() => setDraft(draft.map((x, j) => (j === i ? { ...x, urgent: !x.urgent } : x)))}>
                        דחוף
                      </button>
                      <button className="chip" onClick={() => setDraft(draft.map((x, j) => (j === i ? { ...x, day: x.day === dayKey() ? tomorrow : dayKey() } : x)))}>
                        {t.day === dayKey() ? 'היום' : t.day === tomorrow ? 'מחר' : t.day.split('-').reverse().slice(0, 2).join('.')}
                        {t.time ? ` · ${t.time}` : ''}
                      </button>
                      <button className="chip" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                        הסר
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="sheet__actions">
              <button
                className="btn btn--primary btn--wide"
                disabled={!draft.length}
                onClick={() => {
                  addTasks(draft.filter((t) => t.text.trim()))
                  setDraft(null)
                  setText('')
                  toast('נשמר')
                }}
              >
                שמירה
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}

function TaskRow({ t, tomorrow }: { t: Task; tomorrow: string }) {
  return (
    <li className={t.done ? 'is-done' : ''}>
      <div className="glist__row">
        <button className={`cbox ${t.done ? 'is-on' : ''}`} onClick={() => toggleTask(t.id)} aria-label={`סמן ${t.text}`}>
          {t.done && <IconCheck size={12} />}
        </button>
        <span className="glist__body">
          <strong>{t.text}</strong>
          <small>
            {[t.time, t.important && 'חשוב', t.urgent && 'דחוף'].filter(Boolean).join(' · ')}
          </small>
        </span>
        {!t.done && (
          <button className="btn btn--text" onClick={() => moveTask(t.id, tomorrow)}>
            למחר
          </button>
        )}
      </div>
    </li>
  )
}

/* ====================== sleep and routines ====================== */
export function MasterySleep() {
  const s = useStore((x) => x)
  const sl = mastery(s).sleep
  const stats = sleepStats(s)
  const next = nextWakeTarget(s)
  const r = routines(s)
  const done = r.done?.[dayKey()] ?? { m: [], e: [] }
  const last = dayKey()
  const [log, setLog] = useState(() => sl?.logs?.[last] ?? { bed: sl?.bed ?? '23:30', wake: sl?.wake ?? '07:00', quality: 3 })
  const [edit, setEdit] = useState<null | 'morning' | 'evening'>(null)
  const [items, setItems] = useState('')
  return (
    <div className="screen msleep">
      <Hero img="evening2" kicker="שינה ושגרה" title="לקום בזמן מתחיל בערב" line="יעד, ביצוע ושינוי הדרגתי. רק מה שתיעדת." />

      <section className="block">
        <h2 className="glist__title">היעדים</h2>
        <div className="mtimes">
          <label className="field">
            <span>שעת שינה</span>
            <input type="time" value={sl?.bed ?? '23:30'} onChange={(e) => setSleep({ bed: e.target.value })} />
          </label>
          <label className="field">
            <span>שעת יקיצה עכשיו</span>
            <input type="time" value={sl?.wake ?? '07:00'} onChange={(e) => setSleep({ wake: e.target.value })} />
          </label>
          <label className="field">
            <span>היעד הסופי</span>
            <input type="time" value={sl?.goalWake ?? ''} onChange={(e) => setSleep({ goalWake: e.target.value || undefined })} />
          </label>
        </div>
        {next && !next.reached && next.change !== 0 && (
          <div className="cnote">
            <p>
              {next.eased
                ? `שני בקרים קשים מתוך שלושה. היעד הנוכחי מוקדם מדי כרגע. נזיז אותו ל-${next.target}, ונתקדם שוב כשזה יתייצב.`
                : `שלושה בקרים ברצף ביעד. אפשר להתקדם: יקיצה ב-${next.target}.`}
            </p>
            <button className="cnote__act" onClick={() => (setSleep({ wake: next.target }), toast(`היעד החדש: ${next.target}`))}>
              לעדכן ל-{next.target}
            </button>
          </div>
        )}
        {next?.reached && <p className="mfact">הגעת ליעד היקיצה שלך. עכשיו המטרה היא לשמור עליו.</p>}
        <p className="mnote">השעון המעורר עצמו: בשעון של האייפון (שעון ← מעורר). אפליקציית רשת לא יכולה להעיר אותך כשהיא סגורה, ולכן לא נציג שעון מעורר מזויף.</p>
      </section>

      <section className="block">
        <h2 className="glist__title">איך היה הלילה?</h2>
        <div className="mtimes">
          <label className="field">
            <span>הלכתי לישון</span>
            <input type="time" value={log.bed} onChange={(e) => setLog({ ...log, bed: e.target.value })} />
          </label>
          <label className="field">
            <span>קמתי</span>
            <input type="time" value={log.wake} onChange={(e) => setLog({ ...log, wake: e.target.value })} />
          </label>
        </div>
        <div className="chips" role="radiogroup" aria-label="איכות השינה">
          {[1, 2, 3, 4, 5].map((q) => (
            <button key={q} role="radio" aria-checked={log.quality === q} className={`chip ${log.quality === q ? 'is-on' : ''}`} onClick={() => setLog({ ...log, quality: q })}>
              {['גרוע', 'חלש', 'סביר', 'טוב', 'מצוין'][q - 1]}
            </button>
          ))}
        </div>
        <button className="btn btn--primary btn--wide" onClick={() => (logSleep(last, log), toast('נשמר'))}>
          {sl?.logs?.[last] ? 'עדכון הלילה' : 'שמירת הלילה'}
        </button>
        {stats ? (
          <ul className="cfacts mfacts">
            <li>
              <strong>{stats.avgHours.toFixed(1)}</strong>
              <span>שעות בממוצע</span>
            </li>
            <li>
              <strong>{stats.avgWake}</strong>
              <span>יקיצה ממוצעת</span>
            </li>
            <li>
              <strong>±{stats.spread}</strong>
              <span>דקות פיזור</span>
            </li>
            <li>
              <strong>
                {stats.onTarget}/{stats.nights}
              </strong>
              <span>בקרים ביעד</span>
            </li>
          </ul>
        ) : (
          <p className="mempty">אחרי כמה לילות מתועדים יופיעו כאן ממוצעים ועקביות.</p>
        )}
      </section>

      {(['morning', 'evening'] as const).map((k) => (
        <section className="block" key={k}>
          <h2 className="glist__title">
            {k === 'morning' ? 'שגרת בוקר' : 'שגרת ערב'} · {(k === 'morning' ? done.m : done.e).length}/{r[k].length}
            <button className="mlink" onClick={() => (setEdit(k), setItems(r[k].join('\n')))}>
              עריכה
            </button>
          </h2>
          <ul className="glist">
            {r[k].map((it) => {
              const on = (k === 'morning' ? done.m : done.e).includes(it)
              return (
                <li key={it}>
                  <button className="glist__row" onClick={() => toggleRoutine(k === 'morning' ? 'm' : 'e', it)}>
                    <span className={`cbox ${on ? 'is-on' : ''}`}>{on && <IconCheck size={12} />}</span>
                    <span className="glist__body">
                      <strong>{it}</strong>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <Sheet open={!!edit} onClose={() => setEdit(null)} label="עריכת שגרה">
        <h3 className="sheet__title">{edit === 'morning' ? 'שגרת בוקר' : 'שגרת ערב'}</h3>
        <p className="sheet__lead">כל שורה היא צעד. קצר ומעשי.</p>
        <textarea rows={7} value={items} onChange={(e) => setItems(e.target.value)} />
        <div className="sheet__actions">
          <button
            className="btn btn--primary btn--wide"
            onClick={() => {
              setRoutineItems(edit!, items.split('\n').map((x) => x.trim()).filter(Boolean))
              setEdit(null)
            }}
          >
            שמירה
          </button>
        </div>
      </Sheet>
    </div>
  )
}

/* ====================== screen time and the scroll pause ====================== */
const APPS = ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'games']
const APP_NAMES: Record<string, string> = { instagram: 'אינסטגרם', tiktok: 'טיקטוק', youtube: 'יוטיוב', facebook: 'פייסבוק', x: 'X (טוויטר)', games: 'משחקים' }

export function MasteryScreen() {
  const s = useStore((x) => x)
  const limits = mastery(s).limits ?? []
  const ps = pauseStats(s)
  const [setup, setSetup] = useState<string | null>(null)
  const usage = mastery(s).usage?.[dayKey()] ?? {}
  const upd = (app: string, patch: Partial<{ daily: number; weekly?: number }>) => {
    const has = limits.find((l) => l.app === app)
    setLimits(has ? limits.map((l) => (l.app === app ? { ...l, ...patch } : l)) : [...limits, { app, daily: 30, ...patch }])
  }
  return (
    <div className="screen mscreen">
      <Hero img="situation" kicker="זמן מסך" title="הטלפון בשבילך, לא אתה בשבילו" line="מגבלה לכל אפליקציה, ועצירה של רגע לפני שגוללים." pos="38% 50%" />

      <div className="mhonest">
        <strong>מה עובד כאן באמת</strong>
        <p>
          חסימה אמיתית של אפליקציות אפשרית באייפון רק דרך "זמן מסך" של אפל, או באפליקציה מהחנות עם אישור מיוחד מאפל. אפליקציית רשת לא יכולה לחסום אפליקציה אחרת או לקרוא את זמן השימוש בה, ולכן לא נציג חסימה מזויפת. כאן מגדירים את המגבלות, האייפון אוכף אותן, ו"המסע שלי" נכנס לרגע של עצירה לפני הגלילה.
        </p>
      </div>

      <section className="block">
        <h2 className="glist__title">המגבלות שלך</h2>
        <ul className="glist">
          {APPS.map((app) => {
            const l = limits.find((x) => x.app === app)
            const used = usage[app]
            const week = weekUsage(s, app)
            return (
              <li key={app}>
                <div className="glist__row mlimit">
                  <span className="glist__body">
                    <strong>{APP_NAMES[app]}</strong>
                    <small>
                      {l ? `יעד: ${l.daily} דק׳ ביום${l.weekly ? ` · ${l.weekly} דק׳ בשבוע` : ''}` : 'בלי מגבלה'}
                      {used !== undefined && l ? ` · היום ${used} דק׳, נשארו ${Math.max(0, l.daily - used)}` : ''}
                      {week.length > 1 ? ` · ${week.reduce((a, b) => a + b, 0)} דק׳ ב-${week.length} ימים` : ''}
                    </small>
                  </span>
                  <select value={l?.daily ?? 0} onChange={(e) => (+e.target.value ? upd(app, { daily: +e.target.value }) : setLimits(limits.filter((x) => x.app !== app)))} aria-label={`מגבלה יומית ל${APP_NAMES[app]}`}>
                    <option value={0}>ללא</option>
                    {[15, 30, 45, 60, 90, 120].map((m) => (
                      <option key={m} value={m}>
                        {m} דק׳
                      </option>
                    ))}
                  </select>
                </div>
                {l && (
                  <div className="mlimit__more">
                    <label>
                      היום בפועל (מזמן מסך):
                      <input type="number" min={0} inputMode="numeric" value={used ?? ''} placeholder="דקות" onChange={(e) => setUsage(dayKey(), app, Math.max(0, +e.target.value || 0))} />
                    </label>
                    <label>
                      יעד שבועי:
                      <input type="number" min={0} inputMode="numeric" value={l.weekly ?? ''} placeholder="דקות" onChange={(e) => upd(app, { weekly: +e.target.value || undefined })} />
                    </label>
                    <button className="btn btn--text" onClick={() => setSetup(app)}>
                      חיבור לאייפון
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <p className="mnote">את הזמן בפועל מעתיקים מהגדרות ← זמן מסך. כך כל מספר כאן אמיתי, ולא הערכה.</p>
      </section>

      <section className="block">
        <h2 className="glist__title">העצירות שלך, 7 ימים</h2>
        {ps.total ? (
          <ul className="cfacts mfacts">
            <li>
              <strong>{ps.total}</strong>
              <span>עצירות</span>
            </li>
            <li>
              <strong>{ps.closed}</strong>
              <span>סגרתי</span>
            </li>
            <li>
              <strong>{ps.alternative}</strong>
              <span>עשיתי משהו אחר</span>
            </li>
            <li>
              <strong>{ps.continued}</strong>
              <span>נכנסתי בכוונה</span>
            </li>
          </ul>
        ) : (
          <p className="mempty">אחרי החיבור לאייפון, כל פתיחה של אפליקציה מוגבלת תעבור כאן לרגע של עצירה, והנתונים יופיעו כאן.</p>
        )}
        <button className="btn btn--ghost btn--wide" onClick={() => navigate('/pause/instagram')}>
          לראות איך נראית העצירה
        </button>
      </section>

      <Sheet open={!!setup} onClose={() => setSetup(null)} label="חיבור לאייפון">
        {setup && (
          <>
            <h3 className="sheet__title">חיבור {APP_NAMES[setup]} לאייפון</h3>
            <p className="sheet__lead">שני חלקים. פעם אחת, ואז זה עובד לבד.</p>
            <ol className="install">
              <li>
                הגדרות ← זמן מסך ← מגבלות אפליקציות ← הוסף מגבלה ← {APP_NAMES[setup]} ← {limits.find((l) => l.app === setup)?.daily ?? 30} דקות. זו החסימה האמיתית.
              </li>
              <li>אפליקציית קיצורים ← אוטומציה ← + ← אפליקציה ← {APP_NAMES[setup]} ← "נפתחת" ← הפעל מיד.</li>
              <li>הוסף פעולה "פתח כתובת URL", והדבק את הכתובת שלמטה.</li>
            </ol>
            <button
              className="btn btn--primary btn--wide"
              onClick={() => {
                const url = `${APP_URL}#/pause/${setup}`
                navigator.clipboard?.writeText(url).then(() => toast('הכתובת הועתקה'), () => toast(url))
              }}
            >
              העתק את כתובת העצירה
            </button>
          </>
        )}
      </Sheet>
    </div>
  )
}

const WHY = [
  { id: 'check', t: 'לבדוק הודעה או משהו ספציפי', alt: 'תבדוק רק את זה, ותצא. הגדר לעצמך דקה אחת.' },
  { id: 'bored', t: 'משעמם לי', alt: 'שעמום הוא אות, לא בעיה. נסה חמש דקות הליכה, או פרק קצר מספר.' },
  { id: 'escape', t: 'לברוח ממשהו', alt: 'מה הדבר שאתה בורח ממנו? שתי דקות עליו בלבד, ואז תחליט.' },
  { id: 'tired', t: 'אני עייף', alt: 'גלילה לא מנוחה. עשר דקות עיניים עצומות ייתנו לך יותר.' },
  { id: 'habit', t: 'סתם, מתוך הרגל', alt: 'ההרגל פתח את האפליקציה, לא אתה. נשימה אחת עמוקה, ותבחר מחדש.' },
]

export function ScrollPause({ app }: { app: string }) {
  const [why, setWhy] = useState<string | null>(null)
  const name = APP_NAMES[app] ?? app
  const w = WHY.find((x) => x.id === why)
  const finish = (choice: 'closed' | 'alternative' | 'continued') => {
    logPause(app, choice, why ?? undefined)
    if (choice === 'continued') toast('בהצלחה. תזכור מה רצית לעשות שם')
    navigate(choice === 'alternative' ? '/mastery/day' : '/mastery')
  }
  return (
    <div className="screen mpause">
      <Hero img="calm" kicker="רגע לפני" title={`פתחת את ${name}`} line="לא צריך לוותר. רק לבחור בכוונה." pos="50% 62%" back="/mastery/screen" />
      <section className="block">
        <h2 className="glist__title">מה רצית לעשות שם?</h2>
        <div className="mwhy">
          {WHY.map((x) => (
            <button key={x.id} className={`chip ${why === x.id ? 'is-on' : ''}`} onClick={() => setWhy(x.id)}>
              {x.t}
            </button>
          ))}
        </div>
        {w && <p className="cnote mpause__alt">{w.alt}</p>}
      </section>
      <div className="mpause__actions">
        <button className="btn btn--primary btn--wide" onClick={() => finish('closed')}>
          סוגר, לא צריך
        </button>
        <button className="btn btn--ghost btn--wide" onClick={() => finish('alternative')}>
          אעשה משהו אחר
        </button>
        <button className="btn btn--text btn--wide" onClick={() => finish('continued')}>
          נכנס בכוונה
        </button>
      </div>
    </div>
  )
}

/* ====================== discipline ladder ====================== */
export function MasteryDiscipline() {
  const s = useStore((x) => x)
  const st = ladderState(s)
  const now = LADDER.filter((c) => c.level === st.level)
  const [run, setRun] = useState<{ id: string; start: number } | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!run) return
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [run])
  void tick
  const c = run && LADDER.find((x) => x.id === run.id)
  const elapsed = run ? Math.floor((Date.now() - run.start) / 1000) : 0
  const target = (c?.minutes ?? 0) * 60
  const recent = st.log.slice(-6).reverse()
  return (
    <div className="screen mdisc">
      <Hero img="wealth" kicker="משמעת" title={`שלב ${st.level}`} line="אתגרים שעולים כשאתה מצליח, ויורדים כשקשה. בלי עונש." />
      {run && c ? (
        <section className="block mtimer">
          <h2>{c.title}</h2>
          <div className="mtimer__clock" aria-live="polite">
            {Math.floor(Math.max(0, target - elapsed) / 60)}:{String(Math.max(0, target - elapsed) % 60).padStart(2, '0')}
          </div>
          <div className="mtimer__bar">
            <i style={{ width: `${Math.min(100, (elapsed / target) * 100)}%` }} />
          </div>
          <p className="mnote">הזמן נמדד רק כשהאפליקציה פתוחה. אם יצאת ממנה, תסמן בכנות.</p>
          <div className="mpause__actions">
            <button className="btn btn--primary btn--wide" disabled={elapsed < target} onClick={() => (logChallenge(c.id, true, Math.round(elapsed / 60)), setRun(null), toast('עשית את זה'))}>
              {elapsed < target ? 'עוד רגע...' : 'סיימתי'}
            </button>
            <button className="btn btn--text btn--wide" onClick={() => (logChallenge(c.id, false, Math.round(elapsed / 60)), setRun(null))}>
              לא הפעם
            </button>
          </div>
        </section>
      ) : (
        <section className="block">
          <h2 className="glist__title">האתגרים של השלב</h2>
          <ul className="glist">
            {now.map((x) => (
              <li key={x.id}>
                <div className="glist__row">
                  <span className="glist__body">
                    <strong>{x.title}</strong>
                    <small>{x.how}</small>
                  </span>
                  {x.minutes ? (
                    <button className="btn btn--sm btn--ghost" onClick={() => setRun({ id: x.id, start: Date.now() })}>
                      התחל
                    </button>
                  ) : (
                    <span className="mpair">
                      <button className="btn btn--sm btn--ghost" onClick={() => (logChallenge(x.id, true), toast('נרשם'))}>
                        הצלחתי
                      </button>
                      <button className="btn btn--sm btn--text" onClick={() => logChallenge(x.id, false)}>
                        לא הפעם
                      </button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mnote">עולים שלב אחרי שלוש הצלחות ברצף. אחרי שתי פעמים "לא הפעם" מתוך שלוש, האתגר יורד שלב, כדי שיתאים למקום שבו אתה נמצא עכשיו.</p>
        </section>
      )}
      {recent.length > 0 && (
        <section className="block">
          <h2 className="glist__title">לאחרונה</h2>
          <ul className="glist glist--quiet">
            {recent.map((x, i) => (
              <li key={i}>
                <span className="glist__row">
                  <span className={`cbox ${x.ok ? 'is-on' : ''}`}>{x.ok && <IconCheck size={12} />}</span>
                  <span className="glist__body">
                    <strong>{LADDER.find((c) => c.id === x.id)?.title}</strong>
                    <small>{new Date(x.at).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}{x.minutes ? ` · ${x.minutes} דק׳` : ''}</small>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
