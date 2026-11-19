import { useEffect, useMemo, useRef, useState } from 'react'
import { bookById, books, lessonIndex } from '../content'
import { load, paragraphStart } from '../engine/player'
import { getDictation, getDownloads } from '../lib/claude'
import { dueCards } from '../lib/learn'
import { chime, reminderIcs } from '../lib/remind'
import { navigate } from '../lib/router'
import {
  addMemo,
  addNote,
  deleteMemo,
  deleteNote,
  deleteReminder,
  gradeCard,
  saveReminder,
  uid,
  updateNote,
  useStore,
  type Reminder,
} from '../lib/store'
import { deleteFile, getFile, putFile } from '../lib/idb'
import { Cover } from '../ui/Cover'
import { IconBook, IconCheck, IconHeadphones, IconPen, IconPlay, IconPlus, IconSearch, IconTrash } from '../ui/Icons'
import { SectionHead, Sheet } from '../ui/Kit'
import { openPlayer, toast } from '../ui/uiState'

const EMPTY: never[] = []
const NOOBJ: Record<string, number> = {}

type Tab = 'notes' | 'loved' | 'cards' | 'reminders' | 'memos'
const TABS: { id: Tab; label: string }[] = [
  { id: 'notes', label: 'פתקים' },
  { id: 'loved', label: 'אהבתי' },
  { id: 'cards', label: 'לזכור' },
  { id: 'reminders', label: 'תזכורות' },
  { id: 'memos', label: 'הקלטות' },
]
const when = (t: number) => new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })

export function Notebook({ tab: initial }: { tab?: string }) {
  const [tab, setTab] = useState<Tab>((TABS.find((t) => t.id === initial)?.id ?? 'notes') as Tab)
  const notes = (useStore((s) => s.notes) ?? EMPTY)
  const due = useStore((s) => dueCards(s).length)
  return (
    <div className="screen notebook">
      <header className="page-head">
        <h1 className="page-title">המחברת</h1>
        <p className="page-sub">כל מה שכתבת, אהבת, הקלטת ורוצה לזכור, במקום אחד.</p>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tabs__t ${tab === t.id ? 'is-on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'cards' && due > 0 && <b>{due}</b>}
            {t.id === 'loved' && notes.some((n) => n.kind === 'love') && <i />}
          </button>
        ))}
      </div>
      {tab === 'notes' && <Notes />}
      {tab === 'loved' && <Loved />}
      {tab === 'cards' && <Cards />}
      {tab === 'reminders' && <Reminders />}
      {tab === 'memos' && <Memos />}
    </div>
  )
}

/* ---------- notes ---------- */

export function NoteEditor({ open, onClose, bookId, lessonId, editId }: { open: boolean; onClose: () => void; bookId?: string; lessonId?: string; editId?: string }) {
  const existing = useStore((s) => (editId ? s.notes?.find((n) => n.id === editId) : undefined))
  const [text, setText] = useState('')
  const [book, setBook] = useState<string | undefined>(bookId)
  const [mic, setMic] = useState<'off' | 'ready' | 'on'>('off')
  const dict = useRef<Awaited<ReturnType<typeof getDictation>>>(null)
  const base = useRef('')
  useEffect(() => {
    if (open) (setText(existing?.text ?? ''), setBook(existing?.bookId ?? bookId))
  }, [open, editId])
  useEffect(() => {
    let on = true
    getDictation().then((d) => {
      if (!on || !d) return
      dict.current = d
      setMic('ready')
      d.onPartial(({ text }) => setText(base.current + text))
      d.onFinal(({ text }) => {
        base.current = base.current + text + ' '
        setText(base.current)
      })
      d.onState(({ state }) => setMic(state === 'listening' ? 'on' : 'ready'))
    })
    return () => {
      on = false
    }
  }, [])
  const toggleMic = () => {
    const d = dict.current
    if (!d) return
    if (mic === 'on') return void d.stop().catch(() => {})
    base.current = text ? text + ' ' : ''
    d.start().catch(() => setMic('ready'))
  }
  const save = () => {
    if (!text.trim()) return onClose()
    if (editId) updateNote(editId, text.trim())
    else addNote({ kind: 'note', text: text.trim(), bookId: book, lessonId: book === bookId ? lessonId : undefined })
    toast('נשמר במחברת')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} label="פתק">
      <h3 className="sheet__title">{editId ? 'עריכת פתק' : 'פתק חדש'}</h3>
      <textarea className="note-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="מה למדת, מה הרגשת, מה אתה רוצה לזכור?" rows={7} autoFocus />
      {!editId && (
        <label className="field">
          <span>שייך לספר (לא חובה)</span>
          <select value={book ?? ''} onChange={(e) => setBook(e.target.value || undefined)}>
            <option value="">בלי ספר</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="sheet__actions sheet__actions--row">
        <button className="btn btn--primary" onClick={save}>
          שמור
        </button>
        {mic !== 'off' && (
          <button className={`btn btn--quiet ${mic === 'on' ? 'is-rec' : ''}`} onClick={toggleMic}>
            {mic === 'on' ? 'עצור הכתבה' : 'הכתבה בקול'}
          </button>
        )}
        <button className="btn btn--quiet" onClick={onClose}>
          ביטול
        </button>
      </div>
    </Sheet>
  )
}

function Notes() {
  const all = (useStore((s) => s.notes) ?? EMPTY).filter((n) => n.kind === 'note')
  const journal = useStore((s) => s.journal)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<{ open: boolean; id?: string }>({ open: false })
  const list = all.filter((n) => !q || (n.text + (n.quote ?? '')).includes(q))
  return (
    <section className="block">
      <div className="nb__tools">
        <label className="search search--sm">
          <IconSearch size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש בפתקים" />
        </label>
        <button className="btn btn--primary" onClick={() => setEdit({ open: true })}>
          <IconPlus size={16} /> פתק
        </button>
      </div>
      {list.length === 0 && journal.length === 0 && <Empty icon={<IconPen size={26} />} title="המחברת מחכה לך" body="כתוב מה למדת מכל ספר. פתק קצר אחרי פרק עושה את ההבדל בין לשמוע לבין לזכור." />}
      <div className="notes">
        {list.map((n) => (
          <article key={n.id} className="note">
            {n.quote && <p className="note__quote">{n.quote}</p>}
            <p className="note__text">{n.text}</p>
            <footer>
              {n.bookId && bookById[n.bookId] && (
                <button className="note__book" onClick={() => navigate(`/book/${n.bookId}`)}>
                  {bookById[n.bookId].title}
                </button>
              )}
              <span className="note__date">{when(n.at)}</span>
              <button className="icon-btn icon-btn--sm" onClick={() => setEdit({ open: true, id: n.id })} aria-label="ערוך">
                <IconPen size={15} />
              </button>
              <button className="icon-btn icon-btn--sm" onClick={() => deleteNote(n.id)} aria-label="מחק">
                <IconTrash size={15} />
              </button>
            </footer>
          </article>
        ))}
        {journal.map((j) => (
          <article key={j.id} className="note note--journal">
            <p className="note__quote">{j.prompt}</p>
            <p className="note__text">{j.text}</p>
            <footer>
              {lessonIndex[j.lessonId] && <span className="note__book">{lessonIndex[j.lessonId].book.title}</span>}
              <span className="note__date">{when(j.at)}</span>
            </footer>
          </article>
        ))}
      </div>
      <NoteEditor open={edit.open} editId={edit.id} onClose={() => setEdit({ open: false })} />
    </section>
  )
}

/* ---------- loved passages ---------- */

function Loved() {
  const loved = (useStore((s) => s.notes) ?? EMPTY).filter((n) => n.kind === 'love')
  const listen = (lessonId: string, para: number) => {
    load(lessonId, { autoplay: true, from: paragraphStart(lessonId, para) })
    openPlayer()
  }
  if (!loved.length) return <Empty icon={<span className="heart">♥</span>} title="עוד לא סימנת משפטים" body="בזמן הקריאה, לחץ על פסקה וסמן ״אהבתי״. היא תחכה לך כאן, ותוכל לשמוע אותה שוב בלחיצה." />
  return (
    <section className="block">
      <div className="loved">
        {loved.map((n) => {
          const ref = n.lessonId ? lessonIndex[n.lessonId] : undefined
          return (
            <article key={n.id} className="quote-card">
              <p className="quote-card__text">״{n.quote}״</p>
              {ref && (
                <footer>
                  <Cover book={ref.book} size="xs" />
                  <span className="quote-card__src">
                    <strong>{ref.book.title}</strong>
                    <small>{ref.lesson.title}</small>
                  </span>
                  <button className="icon-btn icon-btn--sm" onClick={() => listen(ref.lesson.id, n.para ?? 0)} aria-label="השמע">
                    <IconHeadphones size={16} />
                  </button>
                  <button className="icon-btn icon-btn--sm" onClick={() => navigate(`/read/${ref.book.id}`)} aria-label="קרא">
                    <IconBook size={16} />
                  </button>
                  <button className="icon-btn icon-btn--sm" onClick={() => deleteNote(n.id)} aria-label="הסר">
                    <IconTrash size={15} />
                  </button>
                </footer>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

/* ---------- memory cards (spaced repetition) ---------- */

function Cards() {
  const s = useStore((x) => x)
  const due = useMemo(() => dueCards(s), [])
  const [i, setI] = useState(0)
  const [flip, setFlip] = useState(false)
  const learned = books.flatMap((b) => b.lessons).filter((l) => s.cards?.[l.id]).length
  if (!due.length || i >= due.length)
    return (
      <Empty
        icon={<IconCheck size={26} />}
        title={i > 0 ? 'סיימת את החזרה להיום' : 'אין כרטיסים לחזרה כרגע'}
        body={`כל פרק שסיימת הופך לכרטיס זיכרון. הכרטיסים חוזרים בדיוק כשעומדים לשכוח: אחרי יום, שלושה ימים, שבוע וחודש. ${learned ? `כבר ${learned} כרטיסים במערכת.` : ''}`}
      />
    )
  const { b, l } = due[i]
  const grade = (knew: boolean) => (gradeCard(l.id, knew), setFlip(false), setI(i + 1))
  return (
    <section className="block cards">
      <p className="cards__n">
        כרטיס {i + 1} מתוך {due.length}
      </p>
      <button className={`flash ${flip ? 'is-flip' : ''}`} onClick={() => setFlip(true)} aria-label="הפוך כרטיס">
        <span className="flash__face flash__front">
          <Cover book={b} size="xs" />
          <small>{b.title}</small>
          <strong>{l.title}</strong>
          <em>מה הרעיון המרכזי של הפרק? נסה להיזכר, ואז הפוך.</em>
        </span>
        <span className="flash__face flash__back">
          <small>השורה התחתונה</small>
          <strong>{l.takeaway}</strong>
          <em>{l.exercise.task}</em>
        </span>
      </button>
      {flip ? (
        <div className="cards__grade">
          <button className="btn btn--quiet btn--wide" onClick={() => grade(false)}>
            לא זכרתי
          </button>
          <button className="btn btn--primary btn--wide" onClick={() => grade(true)}>
            זכרתי
          </button>
        </div>
      ) : (
        <button className="btn btn--primary btn--wide" onClick={() => setFlip(true)}>
          הצג תשובה
        </button>
      )}
    </section>
  )
}

/* ---------- reminders ---------- */

const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
const PRESETS: Omit<Reminder, 'id'>[] = [
  { text: 'עשר דקות של למידה', time: '08:30', days: [0, 1, 2, 3, 4, 5, 6], on: true, kind: 'learn' },
  { text: 'שלוש דקות נשימה', time: '13:00', days: [0, 1, 2, 3, 4], on: true, kind: 'breathe' },
  { text: 'גב ישר, כתפיים רפויות', time: '16:00', days: [0, 1, 2, 3, 4], on: true, kind: 'posture' },
  { text: 'פרק אחד לפני השינה', time: '22:15', days: [0, 1, 2, 3, 4, 5, 6], on: true, kind: 'learn' },
]

export function Reminders() {
  const list = (useStore((s) => s.reminders) ?? EMPTY)
  const [edit, setEdit] = useState<Reminder | null>(null)
  const exportIcs = async (r: Reminder) => {
    const ics = reminderIcs(r)
    const d = await getDownloads()
    if (d) {
      try {
        await d.save({ filename: `alexandria-${r.kind}.ics`, data: new Blob([ics], { type: 'text/calendar' }) })
        toast('פתח את הקובץ כדי להוסיף את התזכורת ללוח השנה')
      } catch {
        /* viewer declined */
      }
      return
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    a.download = `alexandria-${r.kind}.ics`
    a.click()
  }
  return (
    <section className="block">
      <p className="muted-line">תזכורת נשמעת כשהאפליקציה פתוחה. כדי לקבל אותה גם כשהיא סגורה, הוסף אותה ללוח השנה של הטלפון בלחיצה אחת.</p>
      <div className="reminders">
        {list.map((r) => (
          <div key={r.id} className={`rem ${r.on ? '' : 'is-off'}`}>
            <button className="rem__main" onClick={() => setEdit(r)}>
              <strong className="rem__time">{r.time}</strong>
              <span className="rem__text">{r.text}</span>
              <span className="rem__days">{r.days.length === 7 ? 'כל יום' : r.days.map((d) => DAYS[d]).join(' ')}</span>
            </button>
            <button className="chip chip--ghost" onClick={() => exportIcs(r)}>
              ללוח השנה
            </button>
            <button className={`switch ${r.on ? 'is-on' : ''}`} role="switch" aria-checked={r.on} onClick={() => saveReminder({ ...r, on: !r.on })} aria-label="הפעל">
              <i />
            </button>
          </div>
        ))}
      </div>
      <SectionHead title="הוסף תזכורת" />
      <div className="chips chips--wrap">
        {PRESETS.filter((p) => !list.some((r) => r.text === p.text)).map((p) => (
          <button key={p.text} className="chip" onClick={() => (saveReminder({ ...p, id: uid() }), chime(0.1))}>
            <IconPlus size={14} /> {p.text} · {p.time}
          </button>
        ))}
        <button className="chip" onClick={() => setEdit({ id: uid(), text: '', time: '09:00', days: [0, 1, 2, 3, 4, 5, 6], on: true, kind: 'custom' })}>
          <IconPlus size={14} /> תזכורת משלי
        </button>
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} label="תזכורת">
        {edit && (
          <>
            <h3 className="sheet__title">תזכורת</h3>
            <label className="field">
              <span>מה להזכיר</span>
              <input value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} placeholder="למשל: לנשום עמוק שלוש פעמים" />
            </label>
            <label className="field">
              <span>שעה</span>
              <input type="time" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} />
            </label>
            <div className="days">
              {DAYS.map((d, k) => (
                <button key={k} className={`day ${edit.days.includes(k) ? 'is-on' : ''}`} onClick={() => setEdit({ ...edit, days: edit.days.includes(k) ? edit.days.filter((x) => x !== k) : [...edit.days, k].sort() })}>
                  {d}
                </button>
              ))}
            </div>
            <div className="sheet__actions sheet__actions--row">
              <button className="btn btn--primary" disabled={!edit.text.trim()} onClick={() => (saveReminder(edit), setEdit(null))}>
                שמור
              </button>
              {list.some((r) => r.id === edit.id) && (
                <button className="btn btn--quiet" onClick={() => (deleteReminder(edit.id), setEdit(null))}>
                  מחק
                </button>
              )}
            </div>
          </>
        )}
      </Sheet>
    </section>
  )
}

/* ---------- voice memos ---------- */

function Memos() {
  const memos = (useStore((s) => s.memos) ?? EMPTY)
  const [rec, setRec] = useState<'idle' | 'rec' | 'denied' | 'none'>(typeof MediaRecorder === 'undefined' ? 'none' : 'idle')
  const [secs, setSecs] = useState(0)
  const [playing, setPlaying] = useState<string | null>(null)
  const mr = useRef<MediaRecorder | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const t0 = useRef(0)
  useEffect(() => {
    if (rec !== 'rec') return
    const t = setInterval(() => setSecs(Math.round((Date.now() - t0.current) / 1000)), 250)
    return () => clearInterval(t)
  }, [rec])
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const r = new MediaRecorder(stream)
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/mp4' })
        const id = uid()
        await putFile(`memo:${id}`, blob)
        const seconds = Math.round((Date.now() - t0.current) / 1000)
        addMemo({ id, title: `הקלטה מ${new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}`, seconds, at: Date.now() })
        setRec('idle')
        toast('ההקלטה נשמרה')
      }
      mr.current = r
      t0.current = Date.now()
      setSecs(0)
      r.start()
      setRec('rec')
    } catch {
      setRec('denied')
    }
  }
  const play = async (id: string) => {
    audio.current?.pause()
    if (playing === id) return setPlaying(null)
    const blob = await getFile(`memo:${id}`)
    if (!blob) return toast('ההקלטה לא נמצאה במכשיר')
    const a = new Audio(URL.createObjectURL(blob))
    a.onended = () => setPlaying(null)
    audio.current = a
    a.play()
    setPlaying(id)
  }
  return (
    <section className="block">
      <div className="recorder">
        {rec === 'rec' ? (
          <button className="recbtn is-rec" onClick={() => mr.current?.stop()} aria-label="עצור הקלטה">
            <i />
            <span>
              {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
            </span>
          </button>
        ) : (
          <button className="recbtn" onClick={start} disabled={rec === 'none'} aria-label="התחל הקלטה">
            <i />
          </button>
        )}
        <p className="recorder__hint">
          {rec === 'rec'
            ? 'מקליט. לחץ כדי לעצור.'
            : rec === 'denied'
              ? 'אין גישה למיקרופון כאן. אפשר לאשר מיקרופון בהגדרות הדפדפן, או להשתמש בפתקים.'
              : rec === 'none'
                ? 'הקלטה לא נתמכת בדפדפן הזה.'
                : 'הקלט לעצמך: מה למדת היום, תובנה, או הסבר במילים שלך. הסבר בקול הוא הדרך הטובה ביותר לזכור.'}
        </p>
      </div>
      <div className="memos">
        {memos.map((m) => (
          <div key={m.id} className="memo">
            <button className="icon-btn icon-btn--ring" onClick={() => play(m.id)} aria-label="נגן">
              {playing === m.id ? <span className="memo__bars" /> : <IconPlay size={16} />}
            </button>
            <span className="memo__body">
              <strong>{m.title}</strong>
              <small>
                {Math.floor(m.seconds / 60)}:{String(m.seconds % 60).padStart(2, '0')}
              </small>
            </span>
            <button className="icon-btn icon-btn--sm" onClick={() => (deleteMemo(m.id), deleteFile(`memo:${m.id}`))} aria-label="מחק">
              <IconTrash size={15} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="nb-empty">
      <span className="nb-empty__icon">{icon}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}
