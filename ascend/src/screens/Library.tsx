import { useRef, useState } from 'react'
import { allLessons, bookById, categories, estimateSeconds, formatClock } from '../content'
import type { CategoryId } from '../content/types'
import { load, usePlayer } from '../engine/player'
import { deleteFile, putFile } from '../lib/idb'
import { store, uid, useStore } from '../lib/store'
import { IconHeadphones, IconPlay, IconTrash, IconUpload } from '../ui/Icons'
import { Eq, LessonRow, Segmented } from '../ui/Kit'
import { openPlayer, toast } from '../ui/uiState'
import { BookLine } from './Explore'

type Tab = 'progress' | 'lessons' | 'saved' | 'mine'

export function Library() {
  const [tab, setTab] = useState<Tab>('progress')
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const [short, setShort] = useState(false)
  const s = useStore((x) => x)

  const inProgress = Object.entries(s.progress)
    .filter(([id, p]) => !p.done && p.pos > 3 && !id.startsWith('file:') && allLessons.some((r) => r.lesson.id === id))
    .sort((a, b) => b[1].last - a[1].last)
    .map(([id]) => id)
  const recentDone = Object.entries(s.progress)
    .filter(([id, p]) => p.done && !id.startsWith('file:'))
    .sort((a, b) => (b[1].doneAt ?? 0) - (a[1].doneAt ?? 0))
    .map(([id]) => id)

  const lessons = allLessons.filter((r) => (cat === 'all' || r.book.category === cat) && (!short || estimateSeconds(r.lesson, s.cps) <= 130))

  return (
    <div className="screen library">
      <header className="page-head">
        <h1 className="page-title">ההאזנות שלי</h1>
        <p className="page-sub">
          {allLessons.length} פרקים מ־{Object.keys(bookById).length} ספרים
        </p>
      </header>
      <Segmented<Tab>
        label="תצוגת ספרייה"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'progress', label: 'בתהליך' },
          { id: 'lessons', label: 'כל הפרקים' },
          { id: 'saved', label: 'שמורים' },
          { id: 'mine', label: 'האודיו שלי' },
        ]}
      />

      {tab === 'progress' && (
        <section className="block">
          {inProgress.length === 0 && recentDone.length === 0 ? (
            <Empty title="עוד לא התחלת להאזין" body="בחר ספר מהספרייה, או עבור לכל הפרקים." action="לכל הפרקים" onAction={() => setTab('lessons')} />
          ) : (
            <>
              {inProgress.length > 0 && <h2 className="subhead">ממשיכים</h2>}
              <div className="list">
                {inProgress.map((id) => (
                  <LessonRow key={id} id={id} />
                ))}
              </div>
              {recentDone.length > 0 && <h2 className="subhead">הושלמו לאחרונה</h2>}
              <div className="list">
                {recentDone.slice(0, 12).map((id) => (
                  <LessonRow key={id} id={id} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'lessons' && (
        <section className="block">
          <div className="chips" role="group" aria-label="סינון">
            <button className={`chip ${short ? 'is-on' : ''}`} aria-pressed={short} onClick={() => setShort((v) => !v)}>
              עד שתי דקות
            </button>
            <button className={`chip ${cat === 'all' ? 'is-on' : ''}`} onClick={() => setCat('all')}>
              הכל
            </button>
            {categories.map((c) => (
              <button key={c.id} className={`chip ${cat === c.id ? 'is-on' : ''}`} onClick={() => setCat(c.id)}>
                {c.short}
              </button>
            ))}
          </div>
          <div className="list">
            {lessons.map((r) => (
              <LessonRow key={r.lesson.id} id={r.lesson.id} />
            ))}
          </div>
          {lessons.length === 0 && <Empty title="אין פרקים בסינון הזה" body="נסה תחום אחר, או בטל את הסינון לפי אורך." />}
        </section>
      )}

      {tab === 'saved' && (
        <section className="block">
          {s.saved.length === 0 ? (
            <Empty title="אין ספרים שמורים" body="בעמוד של כל ספר אפשר לשמור אותו לכאן בלחיצה על סימן השמירה." />
          ) : (
            <div className="booklist">
              {s.saved.map((id) => bookById[id] && <BookLine key={id} id={id} />)}
            </div>
          )}
        </section>
      )}

      {tab === 'mine' && <MyAudio />}
    </div>
  )
}

function MyAudio() {
  const files = useStore((s) => s.files)
  const progress = useStore((s) => s.progress)
  const p = usePlayer()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onFiles(list: FileList | null) {
    if (!list?.length) return
    setBusy(true)
    try {
      for (const f of Array.from(list)) {
        if (!f.type.startsWith('audio/')) continue
        const id = uid()
        await putFile(id, f)
        const name = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
        store.set((s) => ({ files: [...s.files, { id, title: name, author: 'הקובץ שלך', size: f.size, addedAt: Date.now() }] }), { immediate: true })
      }
      toast('האודיו נוסף לספרייה שלך')
    } catch {
      toast('לא הצלחנו לשמור את הקובץ. ייתכן שאין מספיק מקום במכשיר.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove(id: string) {
    await deleteFile(id).catch(() => {})
    store.set((s) => ({ files: s.files.filter((f) => f.id !== id) }), { immediate: true })
  }

  return (
    <section className="block">
      <div className="mine__intro">
        <IconHeadphones size={22} />
        <p>
          הוסף ספרי אודיו והרצאות שרכשת או שיש לך זכות להאזין להם. הקבצים נשמרים רק במכשיר הזה, ומתנגנים בנגן של הספריה עם המשך מאותה נקודה, מהירות ומעקב התקדמות.
        </p>
      </div>
      <input ref={input} type="file" accept="audio/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <button className="btn btn--ghost btn--wide" onClick={() => input.current?.click()} disabled={busy}>
        <IconUpload size={18} /> {busy ? 'שומר...' : 'הוסף קובץ אודיו'}
      </button>
      <div className="list">
        {files.map((f) => {
          const id = `file:${f.id}`
          const pr = progress[id]
          const current = p.track?.id === id
          return (
            <div key={f.id} className={`lrow lrow--file ${current ? 'is-current' : ''}`}>
              <button className="lrow__main" onClick={() => (load(id, { autoplay: true }), openPlayer())}>
                <span className="mini__file">
                  <IconHeadphones size={18} />
                </span>
                <span className="lrow__body">
                  <span className="lrow__title">{f.title}</span>
                  <span className="lrow__meta">
                    {(f.size / 1048576).toFixed(1)} MB
                    {pr?.pos ? (
                      <>
                        <span className="sep" aria-hidden="true" />
                        נעצר ב־{formatClock(pr.pos)}
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="lrow__play" aria-hidden="true">
                  {current && p.status === 'playing' ? <Eq /> : <IconPlay size={14} />}
                </span>
              </button>
              <button className="icon-btn" onClick={() => remove(f.id)} aria-label={`מחק את ${f.title}`}>
                <IconTrash size={18} />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function Empty({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <div className="emptybox">
      <h3>{title}</h3>
      <p>{body}</p>
      {action && (
        <button className="btn btn--ghost" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}
