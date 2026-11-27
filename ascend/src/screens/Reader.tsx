import { useEffect, useMemo, useRef, useState } from 'react'
import { bookById } from '../content'
import { fullTexts } from '../content/fulltext'
import type { Book } from '../content/types'
import { load } from '../engine/player'
import { navigate } from '../lib/router'
import { addListening, markRead, store, toggleLove, useStore } from '../lib/store'
import { paragraphStart } from '../engine/player'
import { NoteEditor } from './Notebook'
import { IconHeart, IconPen } from '../ui/Icons'
import { toast } from '../ui/uiState'
import { Cover } from '../ui/Cover'
import { IconHeadphones, IconList } from '../ui/Icons'
import { BackButton, Sheet } from '../ui/Kit'
import { openPlayer } from '../ui/uiState'
import { NotFound } from './Explore'

const EMPTY: never[] = []
const NOOBJ: Record<string, number> = {}

export interface Chapter {
  title: string
  paragraphs: string[]
  /** The lesson that narrates this chapter, if any. */
  lessonId?: string
  takeaway?: string
  steps?: string[]
  task?: string
  ideas?: { h: string; t: string }[]
}

/** The readable text of a book: the full public-domain translation, or the הספריה edition built from its lessons. */
export function bookChapters(b: Book): { chapters: Chapter[]; full: boolean; note: string } {
  const full = fullTexts[b.id]
  if (full) {
    const chapters: Chapter[] = full.chapters.map((c) => ({ title: c.title, paragraphs: c.paragraphs }))
    // chapter 0 (foreword) and 1 share the first lesson; the rest map one to one
    chapters.forEach((c, i) => (c.lessonId = b.lessons[Math.max(0, i - 1)]?.id))
    chapters.forEach((c, i) => {
      const l = i > 0 ? b.lessons[i - 1] : undefined
      if (l) Object.assign(c, { takeaway: l.takeaway, steps: l.steps, task: l.exercise.task })
    })
    return { chapters, full: true, note: full.source }
  }
  if (b.complete)
    return {
      chapters: b.lessons.map((l) => ({ title: l.title, paragraphs: l.script.split(/\n+/), lessonId: l.id, takeaway: l.takeaway, steps: l.steps, task: l.exercise.task, ideas: l.ideas })),
      full: true,
      note: 'כל הספר, רק העיקר: כל הפרקים והרעיונות של הספר, בניסוח מקורי ומתומצת של המסע שלי, בלי מילוי. זה לא תרגום מילולי של הספר.',
    }
  const intro: Chapter = { title: 'למה הספר הזה', paragraphs: [b.tagline, b.why, ...b.ideas.map((i) => `${i.title}. ${i.body}`)] }
  return {
    chapters: [intro, ...b.lessons.map((l) => ({ title: l.title, paragraphs: l.script.split(/\n+/), lessonId: l.id }))],
    full: false,
    note: 'מהדורת המסע שלי: הסבר מקורי של רעיונות הספר, לא הטקסט של הספר עצמו. את הספר המלא אפשר לרכוש מההוצאה.',
  }
}

const SIZES = [17, 19, 21, 23, 26]

export function Reader({ id }: { id: string }) {
  const b = bookById[id]
  const prefs = useStore((s) => s.readerPrefs) ?? { size: 1, paper: 'night' as const }
  const saved = useStore((s) => s.reading?.[id])
  const [ch, setCh] = useState(saved?.ch ?? 0)
  const [toc, setToc] = useState(false)
  const [sel, setSel] = useState<number | null>(null)
  const [noteFor, setNoteFor] = useState<number | null>(null)
  const loved = (useStore((s) => s.notes) ?? EMPTY).filter((n) => n.kind === 'love' && n.bookId === id)
  const [ratio, setRatio] = useState(0)
  const restored = useRef(false)
  const data = useMemo(() => (b ? bookChapters(b) : undefined), [b])

  // Resume the exact scroll position once, then save progress while reading.
  useEffect(() => {
    if (!data) return
    if (!restored.current && saved && saved.ch === ch) {
      restored.current = true
      requestAnimationFrame(() => window.scrollTo({ top: saved.y }))
    } else window.scrollTo({ top: 0 })
  }, [ch, data])

  useEffect(() => {
    let last = performance.now()
    let saveT: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - innerHeight
      const r = h > 0 ? Math.min(1, scrollY / h) : 1
      setRatio(r)
      const lid = data?.chapters[ch]?.lessonId
      if (r > 0.92 && lid) markRead(lid)
      clearTimeout(saveT)
      saveT = setTimeout(() => store.set((s) => ({ reading: { ...s.reading, [id]: { ch, y: scrollY, last: Date.now() } } })), 400)
    }
    // Reading time counts toward the daily learning goal (only while the page is visible).
    const tick = setInterval(() => {
      const now = performance.now()
      if (document.visibilityState === 'visible') addListening(Math.min(2, (now - last) / 1000))
      last = now
    }, 1000)
    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    return () => {
      removeEventListener('scroll', onScroll)
      clearInterval(tick)
      clearTimeout(saveT)
    }
  }, [id, ch])

  if (!b || !data) return <NotFound />
  const chapter = data.chapters[ch]
  const size = SIZES[prefs.size] ?? SIZES[1]
  const setPrefs = (p: Partial<typeof prefs>) => store.set({ readerPrefs: { ...prefs, ...p } }, { immediate: true })
  const go = (n: number) => {
    const lid = data.chapters[ch]?.lessonId
    if (n > ch && lid) markRead(lid)
    setSel(null)
    setCh(n)
    store.set((s) => ({ reading: { ...s.reading, [id]: { ch: n, y: 0, last: Date.now() } } }), { immediate: true })
  }

  const para = (p: string, i: number) => {
    const isLoved = !!chapter.lessonId && loved.some((n) => n.lessonId === chapter.lessonId && n.para === i)
    return (
      <div key={i} className={`rpara ${sel === i ? 'is-sel' : ''} ${isLoved ? 'is-loved' : ''}`}>
        <p onClick={() => setSel(sel === i ? null : i)}>{p}</p>
        {sel === i && chapter.lessonId && (
          <div className="rpara__bar">
            <button onClick={() => (toast(toggleLove(id, chapter.lessonId!, i, p) ? 'נשמר באהבתי' : 'הוסר מאהבתי'), setSel(null))}>
              <IconHeart size={16} filled={isLoved} /> אהבתי
            </button>
            <button onClick={() => (setNoteFor(i), setSel(null))}>
              <IconPen size={16} /> פתק
            </button>
            <button onClick={() => (load(chapter.lessonId!, { autoplay: true, from: paragraphStart(chapter.lessonId!, i) }), openPlayer(), setSel(null))}>
              <IconHeadphones size={16} /> השמע מכאן
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`reader reader--${prefs.paper}`} style={{ ['--rsize' as string]: `${size}px` }}>
      <div className="reader__progress" style={{ transform: `scaleX(${(ch + ratio) / data.chapters.length})` }} aria-hidden="true" />
      <header className="reader__bar">
        <BackButton fallback={`/book/${id}`} />
        <button className="reader__where" onClick={() => setToc(true)}>
          <span>{b.title}</span>
          <strong>
            פרק {ch + 1} מתוך {data.chapters.length}
          </strong>
        </button>
        <button className="icon-btn" onClick={() => setToc(true)} aria-label="תוכן העניינים">
          <IconList size={21} />
        </button>
      </header>

      <article className="reader__page">
        {ch === 0 && (
          <div className="reader__titlepage">
            <Cover book={b} size="lg" />
            <h1>{b.title}</h1>
            <p className="reader__author">{b.author}</p>
            {data.full ? <p className="reader__badge">{b.complete ? 'כל הספר, רק העיקר' : 'הספר המלא'}</p> : <p className="reader__badge reader__badge--quiet">מהדורת הספריה</p>}
          </div>
        )}
        <p className="reader__chnum">פרק {ch + 1}</p>
        <h2 className="reader__chtitle">{chapter.title}</h2>
        {chapter.lessonId && (
          <button className="reader__listen" onClick={() => (load(chapter.lessonId!, { autoplay: true, from: 0 }), openPlayer())}>
            <IconHeadphones size={16} /> האזן לפרק
          </button>
        )}
        {chapter.takeaway && (
          <p className="reader__brief">
            <span>בקצרה</span>
            {chapter.takeaway}
          </p>
        )}
        <div className="reader__text">{chapter.paragraphs.map((p, i) => para(p, i))}</div>

        {chapter.ideas?.length ? (
          <section className="reader__ideas" aria-label="הרעיונות המרכזיים">
            <header className="reader__ideashead">
              <span>לעומק</span>
              <h3>{chapter.ideas.length === 1 ? 'הרעיון המרכזי' : `${chapter.ideas.length === 3 ? 'שלושה' : chapter.ideas.length === 4 ? 'ארבעה' : chapter.ideas.length === 2 ? 'שני' : chapter.ideas.length} רעיונות מרכזיים`}</h3>
            </header>
            {chapter.ideas.map((idea, k) => (
              <div key={k} className="ridea">
                <h4>
                  <span className="ridea__n">{k + 1}</span>
                  {idea.h}
                </h4>
                {para(idea.t, chapter.paragraphs.length + k)}
              </div>
            ))}
          </section>
        ) : null}

        {(chapter.steps?.length || chapter.task) && (
          <section className="reader__practice" aria-label="בפועל">
            <h3>בפועל</h3>
            {chapter.steps?.length ? (
              <ol>
                {chapter.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            ) : null}
            {chapter.task && (
              <p className="reader__task">
                <span>התרגיל של הפרק</span>
                {chapter.task}
              </p>
            )}
          </section>
        )}

        <nav className="reader__nav" aria-label="מעבר בין פרקים">
          {ch + 1 < data.chapters.length ? (
            <button className="btn btn--primary btn--wide" onClick={() => go(ch + 1)}>
              לפרק הבא: {data.chapters[ch + 1].title}
            </button>
          ) : (
            <div className="reader__end">
              <p>סיימת את הספר.</p>
              <button className="btn btn--primary" onClick={() => navigate(`/book/${id}`)}>
                חזרה לעמוד הספר
              </button>
            </div>
          )}
          {ch > 0 && (
            <button className="btn btn--quiet btn--wide" onClick={() => go(ch - 1)}>
              לפרק הקודם
            </button>
          )}
        </nav>
        <p className="reader__note">{data.note}</p>
      </article>

      <NoteEditor open={noteFor !== null} onClose={() => setNoteFor(null)} bookId={id} lessonId={chapter.lessonId} />
      <Sheet open={toc} onClose={() => setToc(false)} label="תוכן העניינים">
        <h3 className="sheet__title">תוכן העניינים</h3>
        <div className="reader__prefs">
          <div className="reader__sizes" role="group" aria-label="גודל טקסט">
            <button onClick={() => setPrefs({ size: Math.max(0, prefs.size - 1) })} aria-label="הקטן טקסט" disabled={prefs.size === 0}>
              א
            </button>
            <button onClick={() => setPrefs({ size: Math.min(SIZES.length - 1, prefs.size + 1) })} aria-label="הגדל טקסט" disabled={prefs.size === SIZES.length - 1}>
              <span style={{ fontSize: 22 }}>א</span>
            </button>
          </div>
          <div className="seg" role="radiogroup" aria-label="צבע דף">
            <button role="radio" aria-checked={prefs.paper === 'night'} className={`seg__btn ${prefs.paper === 'night' ? 'is-on' : ''}`} onClick={() => setPrefs({ paper: 'night' })}>
              לילה
            </button>
            <button role="radio" aria-checked={prefs.paper === 'ivory'} className={`seg__btn ${prefs.paper === 'ivory' ? 'is-on' : ''}`} onClick={() => setPrefs({ paper: 'ivory' })}>
              שנהב
            </button>
          </div>
        </div>
        <ol className="toc">
          {data.chapters.map((c, i) => (
            <li key={i}>
              <button className={i === ch ? 'is-on' : ''} onClick={() => (go(i), setToc(false))}>
                <span className="toc__n">{i + 1}</span>
                <span>{c.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </Sheet>
    </div>
  )
}
