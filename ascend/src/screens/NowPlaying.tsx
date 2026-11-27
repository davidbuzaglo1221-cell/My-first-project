import { haptic } from '../lib/haptics'
import { useEffect, useRef, useState } from 'react'
import { bookById, formatClock, lessonIndex } from '../content'
import { currentVoice, setNarrator, jumpToSegment, neighbours, nextChapter, previousChapter, seek, setRate, setSleep, skip, toggle, usePlayer, load } from '../engine/player'
import { navigate } from '../lib/router'
import { toggleSaved, useStore } from '../lib/store'
import { Backdrop, Cover, bookHue } from '../ui/Cover'
import { IconBack, IconBookmark, IconDown, IconForward, IconHeadphones, IconLyrics, IconMoon, IconNextTrack, IconPrevTrack, IconQueue } from '../ui/Icons'
import { PlayGlyph, Sheet } from '../ui/Kit'
import { closePlayer, showComplete, toast, useUI } from '../ui/uiState'
import { NARRATORS } from './Voices'

const RATES = [0.75, 0.9, 1, 1.15, 1.25, 1.5, 1.75, 2]
const fmtRate = (r: number) => `${Number(r.toFixed(2))}×`
const Rate = ({ r }: { r: number }) => <bdi dir="ltr">{fmtRate(r)}</bdi>
type Pane = 'art' | 'lyrics' | 'queue'

/** The full player, built like Apple Music: artwork, title, scrubber, transport, and three panes (art, lyrics, up next). */
export function NowPlaying() {
  const { playerOpen } = useUI()
  const p = usePlayer()
  const skipBy = useStore((s) => s.settings.skip)
  const saved = useStore((s) => s.saved)
  const [pane, setPane] = useState<Pane>('art')
  const [sheet, setSheet] = useState<null | 'sleep' | 'speed' | 'voice'>(null)
  useStore((s) => s.narrator)
  const voiceNow = NARRATORS.find((n) => n.id === currentVoice())
  const [scrub, setScrub] = useState<number | null>(null)
  const [drag, setDrag] = useState(0)
  const startY = useRef<number | null>(null)
  const lyricsRef = useRef<HTMLDivElement>(null)
  const [, force] = useState(0)

  useEffect(() => {
    if (!p.sleepAt) return
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [p.sleepAt])

  // Keep the current line in view, like synced lyrics.
  useEffect(() => {
    if (pane !== 'lyrics') return
    lyricsRef.current?.querySelector('.is-now')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [p.segment, pane])

  const t = p.track
  const book = t?.bookId ? bookById[t.bookId] : undefined
  const ref = t ? lessonIndex[t.id] : undefined
  const playing = p.status === 'playing'
  const pos = scrub ?? p.position
  const ratio = p.duration ? Math.min(1, pos / p.duration) : 0
  const hue = book ? bookHue(book) : 158
  const nb = neighbours(t?.id)
  const isSaved = !!book && saved.includes(book.id)

  const goBook = () => {
    if (!book) return
    closePlayer()
    setTimeout(() => navigate(`/book/${book.id}`), 60)
  }
  // Swipe down on the top part to dismiss.
  const onTouchStart = (e: React.TouchEvent) => (startY.current = e.touches[0].clientY)
  const onTouchMove = (e: React.TouchEvent) => startY.current != null && setDrag(Math.max(0, e.touches[0].clientY - startY.current))
  const onTouchEnd = () => {
    if (drag > 120) closePlayer()
    setDrag(0)
    startY.current = null
  }

  return (
    <div
      className={`np2 ${playerOpen ? 'is-open' : ''} ${playing ? 'is-playing' : ''} np2--${pane}`}
      inert={!playerOpen || undefined}
      role="dialog"
      aria-label="מתנגן עכשיו"
      style={{ ['--hue' as string]: hue, transform: drag ? `translateY(${drag}px)` : undefined, transition: drag ? 'none' : undefined }}
    >
      {t && (
        <>
          <div className="np2__bg" aria-hidden="true">
            {book ? <Backdrop book={book} /> : <div className="backdrop backdrop--tone" />}
          </div>

          <header className="np2__head" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <span className="np2__grab" aria-hidden="true" />
            <button className="np2__icon" onClick={closePlayer} aria-label="מזער נגן">
              <IconDown size={24} />
            </button>
            <button className="np2__from" onClick={goBook} disabled={!book}>
              <small>{t.kind === 'calm' ? 'מנגן מתוך' : 'מנגן מתוך הספר'}</small>
              <strong>{t.subtitle}</strong>
            </button>
            {book ? (
              <button className={`np2__icon ${isSaved ? 'is-on' : ''}`} onClick={() => toggleSaved(book.id)} aria-label={isSaved ? 'הסר משמורים' : 'שמור'}>
                <IconBookmark size={21} filled={isSaved} />
              </button>
            ) : (
              <span className="np2__icon" />
            )}
          </header>

          <main className="np2__main">
            {pane === 'art' && (
              <div className="np2__art">
                {book ? (
                  <Cover book={book} size="xl" className="np2__cover" />
                ) : t.kind === 'calm' ? (
                  <div className={`np__calm ${playing ? 'is-on' : ''}`} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <span />
                  </div>
                ) : (
                  <div className="cover cover--xl np2__cover np__cover--file">
                    <IconHeadphones size={56} />
                  </div>
                )}
              </div>
            )}

            {pane === 'lyrics' && (
              <div className="np2__lyrics" ref={lyricsRef}>
                {p.segments.length ? (
                  p.segments.map((s, i) => (
                    <button key={i} className={i === p.segment ? 'is-now' : i < p.segment ? 'is-past' : ''} onClick={() => jumpToSegment(i)}>
                      {s}
                    </button>
                  ))
                ) : (
                  <p className="np2__empty">אין כתוביות להקלטה הזאת.</p>
                )}
              </div>
            )}

            {pane === 'queue' && (
              <div className="np2__queue">
                {ref && (
                  <>
                    <p className="np2__qlabel">מתנגן עכשיו</p>
                    <div className="qrow is-now">
                      <span className="qrow__n">{ref.index + 1}</span>
                      <span className="qrow__t">{ref.lesson.title}</span>
                      <span className="qrow__d">{formatClock(Math.max(0, p.duration - p.position))}-</span>
                    </div>
                    <p className="np2__qlabel">הבא בתור</p>
                    {nb.upNext.length ? (
                      nb.upNext.map((id) => (
                        <button key={id} className="qrow" onClick={() => load(id, { autoplay: true, from: 0 })}>
                          <span className="qrow__n">{lessonIndex[id].index + 1}</span>
                          <span className="qrow__t">{lessonIndex[id].lesson.title}</span>
                        </button>
                      ))
                    ) : (
                      <p className="np2__empty">זה הפרק האחרון בספר.</p>
                    )}
                  </>
                )}
                {!ref && <p className="np2__empty">אין פרקים נוספים בתור.</p>}
              </div>
            )}
          </main>

          <section className="np2__panel">
            <div className="np2__titles">
              <div>
                <h1 className="np2__title">{t.title}</h1>
                <p className="np2__sub">
                  {t.author}
                  {ref && ` · פרק ${ref.index + 1} מתוך ${ref.book.lessons.length}`}
                </p>
              </div>
            </div>

            {pane === 'art' && p.segments.length > 0 && (
              <button className="np2__line" onClick={() => setPane('lyrics')} aria-live="polite">
                <span key={p.segment}>{p.segments[p.segment]}</span>
              </button>
            )}

            <div className={`np2__scrub ${scrub != null ? 'is-active' : ''}`}>
              <input
                type="range"
                min={0}
                max={Math.max(1, p.duration)}
                step={0.25}
                value={Math.min(pos, p.duration || 1)}
                aria-label="מיקום בפרק"
                aria-valuetext={`${formatClock(pos)} מתוך ${formatClock(p.duration)}`}
                onChange={(e) => setScrub(Number(e.target.value))}
                onPointerUp={() => scrub != null && (seek(scrub), setScrub(null))}
                onTouchEnd={() => scrub != null && (seek(scrub), setScrub(null))}
                onKeyUp={() => scrub != null && (seek(scrub), setScrub(null))}
                style={{ ['--v' as string]: `${ratio * 100}%` }}
              />
              <div className="np2__times">
                <span>{formatClock(pos)}</span>
                <span>{formatClock(Math.max(0, p.duration - pos))}-</span>
              </div>
            </div>

            <div className="np2__transport">
              <button className="np2__t" onClick={previousChapter} aria-label="פרק קודם" disabled={!ref && !t}>
                <IconPrevTrack size={34} />
              </button>
              <button className="np2__t np2__t--skip" onClick={() => skip(-skipBy)} aria-label={`אחורה ${skipBy} שניות`}>
                <IconBack size={30} seconds={skipBy} />
              </button>
              <button className="np2__play" onClick={() => (haptic('tap'), toggle())} aria-label={playing ? 'השהה' : 'נגן'}>
                <PlayGlyph playing={playing} size={44} />
              </button>
              <button className="np2__t np2__t--skip" onClick={() => skip(skipBy)} aria-label={`קדימה ${skipBy} שניות`}>
                <IconForward size={30} seconds={skipBy} />
              </button>
              <button className="np2__t" onClick={nextChapter} aria-label="פרק הבא" disabled={!nb.next}>
                <IconNextTrack size={34} />
              </button>
            </div>

            <div className="np2__tools">
              <button className="np2__tool np2__tool--rate" onClick={() => setSheet('speed')} aria-label={`מהירות ${fmtRate(p.rate)}`}>
                <Rate r={p.rate} />
              </button>
              {t.kind !== 'calm' && t.kind !== 'file' && (
                <button className="np2__tool np2__tool--voice" onClick={() => setSheet('voice')} aria-label={`קריין: ${voiceNow?.name ?? ''}`}>
                  {voiceNow?.name ?? 'קריין'}
                </button>
              )}
              <button className={`np2__tool ${pane === 'lyrics' ? 'is-on' : ''}`} onClick={() => setPane(pane === 'lyrics' ? 'art' : 'lyrics')} aria-label="כתוביות" aria-pressed={pane === 'lyrics'}>
                <IconLyrics size={22} />
              </button>
              <button className={`np2__tool ${pane === 'queue' ? 'is-on' : ''}`} onClick={() => setPane(pane === 'queue' ? 'art' : 'queue')} aria-label="הבא בתור" aria-pressed={pane === 'queue'}>
                <IconQueue size={22} />
              </button>
              <button className={`np2__tool ${p.sleepAt || p.sleepEndOfTrack ? 'is-on' : ''}`} onClick={() => setSheet('sleep')} aria-label="טיימר שינה">
                {p.sleepAt ? <small>{formatClock((p.sleepAt - Date.now()) / 1000)}</small> : <IconMoon size={20} />}
              </button>
            </div>

            {ref && (
              <div className="np2__extra">
                <p className="np2__take">
                  <span>הרעיון במשפט</span>
                  {ref.lesson.takeaway}
                </p>
                <button className="link" onClick={() => showComplete(t.id)}>
                  לתרגיל של הפרק
                </button>
              </div>
            )}
          </section>

          <Sheet open={sheet === 'voice'} onClose={() => setSheet(null)} label="קריין">
            <h3 className="sheet__title">מי יקריא לך?</h3>
            <div className="voicepick">
              {NARRATORS.map((n) => (
                <button key={n.id} className={`voicepick__row ${voiceNow?.id === n.id ? 'is-on' : ''}`} onClick={() => (setNarrator(n.id), setSheet(null), toast(`הקריין שלך: ${n.name}`))}>
                  <strong>{n.name}</strong>
                  <span>{n.desc}</span>
                </button>
              ))}
            </div>
          </Sheet>

          <Sheet open={sheet === 'speed'} onClose={() => setSheet(null)} label="מהירות השמעה">
            <h3 className="sheet__title">מהירות השמעה</h3>
            <div className="choice-grid">
              {RATES.map((r) => (
                <button key={r} className={`choice ${Math.abs(p.rate - r) < 0.01 ? 'is-on' : ''}`} onClick={() => (setRate(r), setSheet(null))}>
                  <Rate r={r} />
                </button>
              ))}
            </div>
          </Sheet>

          <Sheet open={sheet === 'sleep'} onClose={() => setSheet(null)} label="טיימר שינה">
            <h3 className="sheet__title">טיימר שינה</h3>
            <div className="choice-grid">
              {[5, 10, 15, 30, 45, 60].map((m) => (
                <button key={m} className="choice" onClick={() => (setSleep(m), setSheet(null))}>
                  {m} דק׳
                </button>
              ))}
              <button className={`choice ${p.sleepEndOfTrack ? 'is-on' : ''}`} onClick={() => (setSleep('end'), setSheet(null))}>
                סוף הפרק
              </button>
              {(p.sleepAt || p.sleepEndOfTrack) && (
                <button className="choice choice--quiet" onClick={() => (setSleep(null), setSheet(null))}>
                  בטל טיימר
                </button>
              )}
            </div>
          </Sheet>
        </>
      )}
    </div>
  )
}
