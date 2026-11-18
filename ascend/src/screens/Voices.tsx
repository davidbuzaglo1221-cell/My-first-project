import { useEffect, useRef, useState } from 'react'
import audioManifest from '../content/audioManifest.json'
import { currentVoice, pause as pausePlayer, setNarrator } from '../engine/player'
import { useStore } from '../lib/store'
import { IconCheck } from '../ui/Icons'
import { BackButton, PlayGlyph } from '../ui/Kit'
import { toast } from '../ui/uiState'

/** The four narrators. Every one is rendered for the whole library and checked with Hebrew speech recognition. */
export const NARRATORS = [
  { id: 'michael', name: 'מיכאל', desc: 'קול עמוק ורגוע, בסגנון מגיש פודקאסט. הקריין המומלץ.' },
  { id: 'michael-calm', name: 'מיכאל, קצב איטי', desc: 'אותו קול, בקצב איטי ונינוח יותר. טוב להאזנה לפני שינה.' },
  { id: 'shaul', name: 'שאול', desc: 'קול בהיר ואנרגטי, מבוסס על הקלטות של מגיש פודקאסט אמיתי.' },
  { id: 'ido', name: 'עידו', desc: 'קול בינוני וחם, קצב שיחה טבעי.' },
]
const SAMPLE = 'psychology-of-money-quick'
const available = audioManifest as Record<string, Record<string, unknown>>

export function Voices() {
  useStore((s) => s.narrator)
  const chosen = currentVoice()
  const [playing, setPlaying] = useState<string>()
  const [progress, setProgress] = useState(0)
  const audio = useRef<HTMLAudioElement>(null)
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
    a.src = `audio/${id}/${SAMPLE}.mp3`
    a.currentTime = 0
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
      <p className="page-sub">כל קול מקריא את אותו סיכום, "הפסיכולוגיה של הכסף בדקה". תקשיב ובחר את הקול שילווה אותך בכל השיעורים.</p>

      <audio
        ref={audio}
        preload="none"
        onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
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
