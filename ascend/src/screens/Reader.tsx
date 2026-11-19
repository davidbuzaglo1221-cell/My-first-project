import { useEffect, useMemo, useRef, useState } from 'react'
import { bookById } from '../content'
import { fullTexts } from '../content/fulltext'
import type { Book } from '../content/types'
import { load } from '../engine/player'
import { navigate } from '../lib/router'
import { addListening, store, useStore } from '../lib/store'
import { Cover } from '../ui/Cover'
import { IconHeadphones, IconList } from '../ui/Icons'
import { BackButton, Sheet } from '../ui/Kit'
import { openPlayer } from '../ui/uiState'
import { NotFound } from './Explore'

export interface Chapter {
  title: string
  paragraphs: string[]
  /** The lesson that narrates this chapter, if any. */
  lessonId?: string
}

/** The readable text of a book: the full public-domain translation, or the ASCEND edition built from its lessons. */
export function bookChapters(b: Book): { chapters: Chapter[]; full: boolean; note: string } {
  const full = fullTexts[b.id]
  if (full) {
    const chapters: Chapter[] = full.chapters.map((c) => ({ title: c.title, paragraphs: c.paragraphs }))
    // chapter 0 (foreword) and 1 share the first lesson; the rest map one to one
    chapters.forEach((c, i) => (c.lessonId = b.lessons[Math.max(0, i - 1)]?.id))
    return { chapters, full: true, note: full.source }
  }
  if (b.complete)
    return {
      chapters: b.lessons.map((l) => ({ title: l.title, paragraphs: l.script.split(/\n+/), lessonId: l.id })),
      full: true,
      note: 'כל הספר, רק העיקר: כל הפרקים והרעיונות של הספר, בניסוח מקורי ומתומצת של ASCEND, בלי מילוי. זה לא תרגום מילולי של הספר.',
    }
  const intro: Chapter = { title: 'למה הספר הזה', paragraphs: [b.tagline, b.why, ...b.ideas.map((i) => `${i.title}. ${i.body}`)] }
  return {
    chapters: [intro, ...b.lessons.map((l) => ({ title: l.title, paragraphs: l.script.split(/\n+/), lessonId: l.id }))],
    full: false,
    note: 'מהדורת ASCEND: הסבר מקורי של רעיונות הספר, לא הטקסט של הספר עצמו. את הספר המלא אפשר לרכוש מההוצאה.',
  }
}

const SIZES = [17, 19, 21, 23, 26]

export function Reader({ id }: { id: string }) {
  const b = bookById[id]
  const prefs = useStore((s) => s.readerPrefs) ?? { size: 1, paper: 'night' as const }
  const saved = useStore((s) => s.reading?.[id])
  const [ch, setCh] = useState(saved?.ch ?? 0)
  const [toc, setToc] = useState(false)
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
      setRatio(h > 0 ? Math.min(1, scrollY / h) : 1)
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
    setCh(n)
    store.set((s) => ({ reading: { ...s.reading, [id]: { ch: n, y: 0, last: Date.now() } } }), { immediate: true })
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
            {data.full ? <p className="reader__badge">{b.complete ? 'כל הספר, רק העיקר' : 'הספר המלא'}</p> : <p className="reader__badge reader__badge--quiet">מהדורת ASCEND</p>}
          </div>
        )}
        <p className="reader__chnum">פרק {ch + 1}</p>
        <h2 className="reader__chtitle">{chapter.title}</h2>
        {chapter.lessonId && (
          <button className="reader__listen" onClick={() => (load(chapter.lessonId!, { autoplay: true, from: 0 }), openPlayer())}>
            <IconHeadphones size={16} /> האזן לפרק
          </button>
        )}
        <div className="reader__text">
          {chapter.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

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
