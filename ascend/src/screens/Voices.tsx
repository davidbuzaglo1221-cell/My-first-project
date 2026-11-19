import { useEffect, useRef, useState } from 'react'
import audioManifest from '../content/audioManifest.json'
import { currentVoice, pause as pausePlayer, setNarrator } from '../engine/player'
import { useStore } from '../lib/store'
import { IconCheck } from '../ui/Icons'
import { BackButton, PlayGlyph } from '../ui/Kit'
import { toast } from '../ui/uiState'

/** The four narrators. Every one is rendered for the whole library and checked with Hebrew speech recognition. */
export const NARRATORS = [
  { id: 'avri', name: 'אבי', desc: 'קול גברי חם וטבעי, עברית ילידית. מדבר אליך כמו חבר שמספר לך על ספר טוב.' },
  { id: 'hila', name: 'הילה', desc: 'קול נשי רך וברור, עברית ילידית. נעים להאזנה ארוכה.' },
  { id: 'duo', name: 'אבי והילה', desc: 'שני הקולות לסירוגין, פסקה אחרי פסקה, כמו שיחה בין שני חברים. הכי ערני וחי.' },
]
const SAMPLE = 'psychology-of-money-quick'
const available = audioManifest as Record<string, Record<string, { f?: string; o?: number; d: number }>>

export function Voices() {
  useStore((s) => s.narrator)
  const chosen = currentVoice()
  const [playing, setPlaying] = useState<string>()
  const [progress, setProgress] = useState(0)
  const audio = useRef<HTMLAudioElement>(null)
  const start = useRef(0)
  const end = useRef(0)
  useEffect(() => () => audio.current?.pause(), [])
  const list = NARRATORS.filter((n) => available[n.id]?.[SAMPLE])

  function toggle(id: string) {
    const a = audio.current!
    if (playing === id) {
      a.pause()
      setPlaying(undefined)
      return
    }
    pausePlayer()
    const n = available[id][SAMPLE]
    end.current = (n.o ?? 0) + n.d
    start.current = n.o ?? 0
    a.src = `audio/${id}/${n.f ?? SAMPLE}.mp3`
    a.currentTime = start.current
    setProgress(0)
    a.play().then(
      () => setPlaying(id),
      () => toast('לא הצלחנו לנגן את הדוגמה. נסה שוב.'),
    )
  }

  return (
    <div className="screen voices-screen">
      <header className="page-head page-head--back">
        <BackButton fallback="/settings" />
        <h1 className="page-title">בחירת קריין</h1>
      </header>
      <p className="page-sub">שלושה קולות אנושיים בעברית ילידית. כל אחד מקריא את אותו סיכום, "הפסיכולוגיה של הכסף בדקה". תקשיב ובחר.</p>

      <audio
        ref={audio}
        preload="none"
        onLoadedMetadata={(e) => (e.currentTarget.currentTime = start.current)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget
          const len = end.current - start.current
          setProgress(len > 0 ? Math.max(0, (a.currentTime - start.current) / len) : 0)
          if (end.current && a.currentTime >= end.current) (a.pause(), setPlaying(undefined), setProgress(0))
        }}
        onEnded={() => (setPlaying(undefined), setProgress(0))}
      />

      <ul className="vcards">
        {list.map((v) => {
          const on = playing === v.id
          const isChosen = chosen === v.id
          return (
            <li key={v.id} className={`vcard ${on ? 'is-playing' : ''} ${isChosen ? 'is-chosen' : ''}`}>
              <button className="vcard__play" onClick={() => toggle(v.id)} aria-label={`${on ? 'עצור' : 'השמע'} את ${v.name}`}>
                <svg viewBox="0 0 100 100" className="vcard__ring" aria-hidden="true">
                  <circle cx="50" cy="50" r="46" pathLength={100} strokeDasharray={`${on ? progress * 100 : 0} 100`} transform="rotate(-90 50 50)" />
                </svg>
                <PlayGlyph playing={on} size={22} />
              </button>
              <div className="vcard__body">
                <strong>{v.name}</strong>
                <span className="vcard__desc">{v.desc}</span>
              </div>
              <button
                className={`btn btn--sm ${isChosen ? 'btn--done' : 'btn--ghost'}`}
                onClick={() => (setNarrator(v.id), toast(`הקריין שלך: ${v.name}`))}
                aria-pressed={isChosen}
              >
                {isChosen ? (
                  <>
                    <IconCheck size={14} /> נבחר
                  </>
                ) : (
                  'בחר'
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {list.length < NARRATORS.length && <p className="muted-line">קולות נוספים בהקלטה ויופיעו כאן בקרוב.</p>}
    </div>
  )
}
