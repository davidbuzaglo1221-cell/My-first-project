import { useEffect, useRef, useState } from 'react'
import audioManifest from '../content/audioManifest.json'
import { currentVoice, pause as pausePlayer, setNarrator } from '../engine/player'
import { useStore } from '../lib/store'
import { IconCheck } from '../ui/Icons'
import { BackButton, PlayGlyph } from '../ui/Kit'
import { toast } from '../ui/uiState'

/**
 * The narrators. Chosen by measurement: the clearest on joined Hebrew words and the most natural intonation of the
 * free voices, scored against 2,257 Hebrew listener votes. Every one is rendered for the whole library and checked
 * with Hebrew speech recognition.
 */
export const NARRATORS = [
  { id: 'maya', name: 'מאיה', desc: 'קול נשי חם, צלול ומלא חיים. מספרת לך על הספר כמו חברה טובה בשיחה.' },
  { id: 'yoav', name: 'יואב', desc: 'קול גברי רגוע וקרוב, דיבור זורם ונינוח. כמו חבר שיושב איתך על קפה.' },
  { id: 'duo', name: 'מאיה ויואב', desc: 'שניהם לסירוגין, פסקה אחרי פסקה, כמו שיחה בין שני חברים. הכי ערני וחי.' },
  // Earlier narrators: shown only while their recordings are the ones on the site.
  { id: 'avri', name: 'אבי', desc: 'קול גברי חם. מדבר אליך כמו חבר שמספר לך על ספר טוב.' },
  { id: 'hila', name: 'הילה', desc: 'קול נשי רך וברור, נעים להאזנה ארוכה.' },
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
  const fresh = !!available.maya
  const list = NARRATORS.filter((n) => available[n.id]?.[SAMPLE] && (fresh ? !['avri', 'hila'].includes(n.id) : n.id !== 'maya' && n.id !== 'yoav')).map((n) =>
    n.id === 'duo' && !fresh ? { ...n, name: 'אבי והילה' } : n,
  )

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
      <p className="page-sub">שלוש אפשרויות קריינות. כל אחת מקריאה את אותו סיכום, "הפסיכולוגיה של הכסף בדקה". תקשיב ובחר את מי שנעים לך לשמוע.</p>

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
                  <circle cx="50" cy="50" r="46" pathLength={100} strokeDasharray={`${on ? progress * 100 : 0} 100`} strokeOpacity={on && progress > 0.005 ? 1 : 0} transform="rotate(-90 50 50)" />
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
