import { useState } from 'react'
import { books } from '../content'
import { programDays } from '../content/program'
import { load, usePlayer } from '../engine/player'
import { challengeOfDay, ideaOfDay, nextProgramDay, todayChecks } from '../lib/daily'
import { todaySeconds } from '../lib/insights'
import { dayKey } from '../lib/dates'
import { navigate } from '../lib/router'
import { enablePush, isIOS, isStandalone } from '../lib/push'
import { situationOfDay, questionOfDay } from '../content/nudges'
import { markDailyIdea, store, useStore } from '../lib/store'
import { IconCheck, IconPlay } from './Icons'
import { Ring, Sheet } from './Kit'
import { openPlayer, toast } from './uiState'

const playDay = (id: string) => (load(`calm:${id}`, { autoplay: true, from: 0 }), openPlayer())

/** Open the reader at the chapter the idea of the day comes from. */
function openIdea() {
  const idea = ideaOfDay()
  markDailyIdea()
  store.set((x) => ({ reading: { ...x.reading, [idea.bookId]: { ch: idea.chapter, y: 0, last: Date.now() } } }), { immediate: true })
  navigate(`/read/${idea.bookId}`)
}

/** The next chapter to listen to: continue the book you were in, or start the first book. */
function nextChapterId() {
  const s = store.get()
  const last = s.lastTrack && !s.lastTrack.startsWith('calm:') ? s.lastTrack : undefined
  const book = (last && books.find((b) => last.startsWith(b.id + '-'))) || books[0]
  return (book.lessons.find((l) => !s.progress[l.id]?.done) ?? book.lessons[0]).id
}

/** Home: "Your day" — three small things, new every day, and how far you got today. */
export function TodayCard() {
  const s = useStore((x) => x)
  useStore((x) => x.daily)
  usePlayer()
  const [remind, setRemind] = useState(false)
  const checks = todayChecks(s)
  const done = Number(checks.practice) + Number(checks.chapter) + Number(checks.idea)
  const prog = nextProgramDay(s)
  const idea = ideaOfDay()
  const challenge = challengeOfDay()
  const minutes = Math.round(todaySeconds(s) / 60)
  const goal = s.dailyGoalMin
  const line =
    done === 3 ? 'השלמת את היום. כל הכבוד, נתראה מחר.' : minutes >= goal ? `עברת את היעד היומי: ${minutes} דק׳` : `${minutes} מתוך ${goal} דק׳ היום`
  return (
    <section className="myday" aria-label="היום שלך">
      <header className="myday__head">
        <Ring value={done / 3} size={54} stroke={4} className="myday__ring">
          <strong>{done}/3</strong>
        </Ring>
        <span className="myday__titles">
          <span className="myday__kicker">היום שלך</span>
          <strong>{done === 3 ? 'היום הושלם' : 'שלושה צעדים קטנים להיום'}</strong>
          <span className="myday__line">{line}</span>
        </span>
      </header>
      <ol className="myday__list">
        <li className={checks.practice ? 'is-done' : ''}>
          <button onClick={() => playDay(prog.day.id)}>
            <span className="myday__mark">{checks.practice ? <IconCheck size={14} /> : <IconPlay size={12} />}</span>
            <span className="myday__body">
              <small>{prog.finished ? 'התוכנית הושלמה · חזרה' : `התרגול של היום · יום ${prog.index + 1} מתוך ${programDays.length}`}</small>
              <strong>{prog.day.title}</strong>
            </span>
          </button>
        </li>
        <li className={checks.chapter ? 'is-done' : ''}>
          <button onClick={() => (load(nextChapterId(), { autoplay: true }), openPlayer())}>
            <span className="myday__mark">{checks.chapter ? <IconCheck size={14} /> : <IconPlay size={12} />}</span>
            <span className="myday__body">
              <small>פרק אחד מספר</small>
              <strong>{checks.chapter ? 'שמעת היום פרק' : 'עוד לא שמעת היום פרק. כמה דקות ואתה שם'}</strong>
            </span>
          </button>
        </li>
        <li className={checks.idea ? 'is-done' : ''}>
          <button onClick={openIdea}>
            <span className="myday__mark">{checks.idea ? <IconCheck size={14} /> : <span className="myday__dot" />}</span>
            <span className="myday__body">
              <small>הרעיון של היום · {idea.bookTitle}</small>
              <strong>{idea.h}</strong>
            </span>
          </button>
        </li>
      </ol>
      <p className="myday__challenge">
        <span>האתגר של היום</span>
        {challenge.text}
      </p>
      <div className="myday__more">
        <button onClick={() => navigate('/situation')}>
          <small>מה היית עושה?</small>
          <strong>{situationOfDay().title}</strong>
        </button>
        <button onClick={() => navigate('/checkin')}>
          <small>{s.checkins?.[dayKey()] ? 'עצרת היום' : 'איך אתה מרגיש?'}</small>
          <strong>{questionOfDay()}</strong>
        </button>
      </div>
      {!s.push?.on && (
        <button className="myday__remind" onClick={() => setRemind(true)}>
          הפעל התראות מהאפליקציה
        </button>
      )}
      <PushSheet open={remind} onClose={() => setRemind(false)} />
    </section>
  )
}

const MORNING = [7, 8, 9, 10]
const EVENING = [19, 20, 21, 22]

/** Notifications from the app itself: it decides what to send (a situation, a question, a nudge), you pick when. */
export function PushSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cur = useStore((x) => x.push)
  const [am, setAm] = useState(cur?.hours[0] ?? 9)
  const [pm, setPm] = useState(cur?.hours[1] ?? 21)
  const [state, setState] = useState<'idle' | 'busy' | 'install' | 'denied' | 'error' | 'unsupported'>('idle')
  const needInstall = isIOS() && !isStandalone()
  const go = async () => {
    setState('busy')
    const r = await enablePush([am, pm])
    if (r === 'on') {
      toast('ההתראות פעילות. ההודעה הראשונה כבר אצלך')
      setState('idle')
      onClose()
    } else setState(r)
  }
  const hour = (h: number) => `${String(h).padStart(2, '0')}:00`
  return (
    <Sheet open={open} onClose={onClose} label="התראות">
      <h3 className="sheet__title">האפליקציה תפנה אליך</h3>
      <p className="sheet__lead">פעמיים ביום, בלי שתצטרך לזכור: בבוקר מצב מהחיים או תרגול, ובערב שאלה קטנה על איך אתה מרגיש. כל יום משהו אחר.</p>
      {needInstall || state === 'install' ? (
        <ol className="install">
          <li>פותחים את הקישור בספארי</li>
          <li>לוחצים על כפתור השיתוף בתחתית המסך</li>
          <li>בוחרים "הוספה למסך הבית", ואז "הוסף"</li>
          <li>נכנסים מהאייקון החדש ולוחצים כאן שוב</li>
        </ol>
      ) : (
        <>
          <span className="sheet__label">בוקר</span>
          <div className="chips chips--wrap" role="radiogroup" aria-label="שעת בוקר">
            {MORNING.map((h) => (
              <button key={h} role="radio" aria-checked={am === h} className={`chip ${am === h ? 'is-on' : ''}`} onClick={() => setAm(h)}>
                {hour(h)}
              </button>
            ))}
          </div>
          <span className="sheet__label">ערב</span>
          <div className="chips chips--wrap" role="radiogroup" aria-label="שעת ערב">
            {EVENING.map((h) => (
              <button key={h} role="radio" aria-checked={pm === h} className={`chip ${pm === h ? 'is-on' : ''}`} onClick={() => setPm(h)}>
                {hour(h)}
              </button>
            ))}
          </div>
          {state === 'denied' && <p className="sheet__note">ההתראות חסומות. הגדרות ← התראות ← המסע שלי ← לאפשר, ואז לנסות שוב.</p>}
          {(state === 'error' || state === 'unsupported') && <p className="sheet__note">לא הצלחנו להפעיל כרגע. בדוק חיבור לאינטרנט ונסה שוב.</p>}
          <div className="sheet__actions">
            <button className="btn btn--primary btn--wide" disabled={state === 'busy'} onClick={go}>
              {state === 'busy' ? 'מפעיל…' : cur?.on ? 'עדכון השעות' : 'הפעל התראות'}
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}

const TIMES = ['07:30', '08:30', '12:30', '18:30', '20:30', '21:30', '22:30']

/** A daily reminder: a calendar file with a different message each day, an alert at the chosen time, and a link back. */
export function ReminderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [t, setT] = useState('20:30')
  const add = () => {
    store.set((x) => ({ daily: { ...x.daily, remindAt: t } }), { immediate: true })
    toast('נפתח היומן. אשר "הוסף הכל" ותקבל תזכורת כל יום')
    location.href = `remind/${t.replace(':', '')}.ics`
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} label="תזכורת יומית">
      <h3 className="sheet__title">תזכורת יומית</h3>
      <p className="sheet__lead">כל יום, בשעה שתבחר, הטלפון יזכיר לך להיכנס: הרעיון של היום, התרגול של היום, והאם כבר שמעת פרק. בכל יום הודעה אחרת.</p>
      <div className="chips chips--wrap" role="radiogroup" aria-label="שעה">
        {TIMES.map((x) => (
          <button key={x} role="radio" aria-checked={t === x} className={`chip ${t === x ? 'is-on' : ''}`} onClick={() => setT(x)}>
            {x}
          </button>
        ))}
      </div>
      <div className="sheet__actions">
        <button className="btn btn--primary btn--wide" onClick={add}>
          הוסף ליומן שלי
        </button>
      </div>
    </Sheet>
  )
}

/** Freedom: the thirty-day program — the next day, and every day as a tile. */
export function ProgramSection() {
  const s = useStore((x) => x)
  const prog = nextProgramDay(s)
  const done = s.program ?? {}
  return (
    <section className="block prog">
      <header className="prog__head">
        <span className="prog__kicker">התוכנית</span>
        <h2>30 יום מהישרדות לחופש</h2>
        <p>
          כל יום שיעור קצר עם תרגול, בקול של מאיה. {prog.doneCount} מתוך {programDays.length} ימים
        </p>
        <span className="prog__bar" aria-hidden="true">
          <i style={{ width: `${(prog.doneCount / programDays.length) * 100}%` }} />
        </span>
      </header>
      <button className="prog__next" onClick={() => playDay(prog.day.id)}>
        <span className="prog__day">
          <small>יום</small>
          <strong>{prog.index + 1}</strong>
        </span>
        <span className="prog__body">
          <small>{prog.day.week}</small>
          <strong>{prog.day.title}</strong>
          <span>{prog.day.mission}</span>
        </span>
        <span className="prog__play">
          <IconPlay size={16} />
        </span>
      </button>
      <ol className="prog__grid" aria-label="כל הימים">
        {programDays.map((d, i) => (
          <li key={d.id}>
            <button className={`${done[d.id] ? 'is-done' : ''} ${i === prog.index && !prog.finished ? 'is-next' : ''}`} onClick={() => playDay(d.id)} aria-label={`יום ${i + 1}: ${d.title}`}>
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
