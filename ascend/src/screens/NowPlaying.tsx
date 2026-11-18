import { useEffect, useState } from 'react'
import { bookById, categoryById, formatClock, lessonIndex } from '../content'
import { dismissNotice, jumpToSegment, seek, setRate, setSleep, skip, toggle, usePlayer } from '../engine/player'
import { hebrewVoices, pickVoice, voiceLabel } from '../engine/voices'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { Art, Cover, bookHue, bookMotif } from '../ui/Cover'
import { IconBack, IconDown, IconForward, IconHeadphones, IconList, IconMoon } from '../ui/Icons'
import { LessonRow, PlayGlyph, Sheet } from '../ui/Kit'
import { closePlayer, showComplete, useUI } from '../ui/uiState'

const RATES = [0.8, 1, 1.15, 1.3, 1.5, 1.75, 2]
const fmtRate = (r: number) => `${Number(r.toFixed(2))}×`
const Rate = ({ r }: { r: number }) => <bdi dir="ltr">{fmtRate(r)}</bdi>

export function NowPlaying() {
  const { playerOpen } = useUI()
  const p = usePlayer()
  const skipBy = useStore((s) => s.settings.skip)
  const voiceURI = useStore((s) => s.settings.voiceURI)
  const [sheet, setSheet] = useState<null | 'chapters' | 'sleep' | 'speed'>(null)
  const [transcript, setTranscript] = useState(false)
  const [scrub, setScrub] = useState<number | null>(null)
  const [, force] = useState(0)

  useEffect(() => {
    if (!p.sleepAt) return
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [p.sleepAt])

  const t = p.track
  const book = t?.bookId ? bookById[t.bookId] : undefined
  const ref = t ? lessonIndex[t.id] : undefined
  const playing = p.status === 'playing'
  const pos = scrub ?? p.position
  const hue = book ? bookHue(book) : 158
  const voice = pickVoice(voiceURI)

  const goBook = () => {
    if (!book) return
    closePlayer()
    setTimeout(() => navigate(`/book/${book.id}`), 60)
  }

  return (
    <div className={`np ${playerOpen ? 'is-open' : ''} ${playing ? 'is-playing' : ''}`} inert={!playerOpen || undefined} role="dialog" aria-label="מתנגן עכשיו" style={{ ['--hue' as string]: hue }}>
      {t && (
        <>
          <div className="np__ambient" aria-hidden="true">
            {book ? <Art seed={book.id} motif={bookMotif(book)} hue={hue} square /> : <Art seed={t.id} motif="wave" hue={hue} square />}
          </div>
          <div className="np__scroll">
            <header className="np__head">
              <button className="icon-btn" onClick={closePlayer} aria-label="סגור נגן">
                <IconDown size={26} />
              </button>
              <button className="np__from" onClick={goBook} disabled={!book}>
                <span>{book ? categoryById[book.category].short : 'האודיו שלי'}</span>
                <strong>{t.subtitle}</strong>
              </button>
              <button className="icon-btn" onClick={() => setSheet('chapters')} aria-label="שיעורים בספר" disabled={!book}>
                <IconList size={22} />
              </button>
            </header>

            <div className="np__stage">
              {book ? (
                <Cover book={book} size="xl" className="np__cover" />
              ) : (
                <div className="cover cover--xl np__cover np__cover--file">
                  <IconHeadphones size={56} />
                </div>
              )}
            </div>

            <div className="np__meta">
              <h1 className="np__title">{t.title}</h1>
              <p className="np__author">
                {t.author}
                {ref && (
                  <span className="np__part">
                    <span className="sep" aria-hidden="true" />
                    שיעור {ref.index + 1} מתוך {ref.book.lessons.length}
                  </span>
                )}
              </p>
            </div>

            <div className="np__caption" aria-live="polite">
              {p.segments.length > 0 ? (
                <p key={p.segment} className="np__line">
                  {p.segments[p.segment]}
                </p>
              ) : (
                <p className="np__line np__line--muted">{t.kind === 'file' ? 'אודיו מהספרייה האישית שלך' : ''}</p>
              )}
            </div>

            {p.notice && (
              <div className="np__notice" role="status">
                <span>{p.notice}</span>
                <button className="link" onClick={dismissNotice}>
                  הבנתי
                </button>
              </div>
            )}

            <div className="np__scrub">
              <input
                type="range"
                min={0}
                max={Math.max(1, p.duration)}
                step={0.5}
                value={Math.min(pos, p.duration || 1)}
                aria-label="מיקום בשיעור"
                aria-valuetext={`${formatClock(pos)} מתוך ${formatClock(p.duration)}`}
                onChange={(e) => setScrub(Number(e.target.value))}
                onPointerUp={() => scrub != null && (seek(scrub), setScrub(null))}
                onKeyUp={() => scrub != null && (seek(scrub), setScrub(null))}
                style={{ ['--v' as string]: `${p.duration ? (pos / p.duration) * 100 : 0}%` }}
              />
              <div className="np__times">
                <span>{formatClock(pos)}</span>
                <span>-{formatClock(Math.max(0, p.duration - pos))}</span>
              </div>
            </div>

            <div className="np__controls">
              <button className="np__pill" onClick={() => setSheet('speed')} aria-label={`מהירות ${fmtRate(p.rate)}`}>
                <Rate r={p.rate} />
              </button>
              <button className="icon-btn icon-btn--lg" onClick={() => skip(-skipBy)} aria-label={`אחורה ${skipBy} שניות`}>
                <IconBack size={34} seconds={skipBy} />
              </button>
              <button className="np__play" onClick={toggle} aria-label={playing ? 'השהה' : 'נגן'}>
                <PlayGlyph playing={playing} size={34} />
              </button>
              <button className="icon-btn icon-btn--lg" onClick={() => skip(skipBy)} aria-label={`קדימה ${skipBy} שניות`}>
                <IconForward size={34} seconds={skipBy} />
              </button>
              <button className={`np__pill ${p.sleepAt || p.sleepEndOfTrack ? 'is-on' : ''}`} onClick={() => setSheet('sleep')} aria-label="טיימר שינה">
                {p.sleepAt ? formatClock((p.sleepAt - Date.now()) / 1000) : p.sleepEndOfTrack ? 'סוף' : <IconMoon size={18} />}
              </button>
            </div>

            <div className="np__foot">
              <span className="np__voice">
                {p.mode === 'file' ? 'קובץ אודיו' : p.mode === 'voice' ? `קריינות: ${voice ? voiceLabel(voice) : 'קול המכשיר'}` : 'כתוביות מתוזמנות'}
              </span>
              {ref && (
                <button className="link" onClick={() => showComplete(t.id)}>
                  לתרגיל של השיעור
                </button>
              )}
            </div>

            {ref && (
              <section className="np__more">
                <div className="np__takeaway">
                  <span>הרעיון במשפט</span>
                  <p>{ref.lesson.takeaway}</p>
                </div>
                <button className="np__tx-toggle" onClick={() => setTranscript((v) => !v)} aria-expanded={transcript}>
                  {transcript ? 'הסתר תמליל' : 'הצג תמליל מלא'}
                </button>
                {transcript && (
                  <ol className="np__tx">
                    {p.segments.map((s, i) => (
                      <li key={i}>
                        <button className={i === p.segment ? 'is-on' : ''} onClick={() => jumpToSegment(i)}>
                          {s}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="np__legal">הסבר מקורי של ASCEND על רעיונות הספר. אינו קריינות של הספר ואינו מחליף אותו.</p>
              </section>
            )}
          </div>

          <Sheet open={sheet === 'chapters'} onClose={() => setSheet(null)} label="שיעורים בספר">
            {book && (
              <>
                <h3 className="sheet__title">{book.title}</h3>
                <div className="list">
                  {book.lessons.map((l, i) => (
                    <LessonRow key={l.id} id={l.id} index={i + 1} showBook={false} />
                  ))}
                </div>
              </>
            )}
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
              {[5, 10, 15, 30, 45].map((m) => (
                <button key={m} className="choice" onClick={() => (setSleep(m), setSheet(null))}>
                  {m} דק׳
                </button>
              ))}
              <button className={`choice ${p.sleepEndOfTrack ? 'is-on' : ''}`} onClick={() => (setSleep('end'), setSheet(null))}>
                סוף השיעור
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
