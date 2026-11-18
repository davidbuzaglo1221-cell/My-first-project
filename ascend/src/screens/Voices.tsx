import { useEffect, useRef, useState } from 'react'
import samples from '../content/voiceSamples.json'
import { pause as pausePlayer } from '../engine/player'
import { store, useStore } from '../lib/store'
import { IconCheck, IconHeadphones } from '../ui/Icons'
import { BackButton, PlayGlyph } from '../ui/Kit'
import { toast } from '../ui/uiState'

type Sample = { id: string; name: string; desc: string }

/** Listen to each candidate narrator reading the same passage, then choose one. */
export function Voices() {
  const list = samples as Sample[]
  const chosen = useStore((s) => s.narrator)
  const [playing, setPlaying] = useState<string>()
  const [progress, setProgress] = useState(0)
  const audio = useRef<HTMLAudioElement>(null)

  useEffect(() => () => audio.current?.pause(), [])

  function toggle(id: string) {
    const a = audio.current!
    if (playing === id) {
      a.pause()
      setPlaying(undefined)
      return
    }
    pausePlayer()
    a.src = `audio/voices/${id}.mp3`
    a.currentTime = 0
    a.play().then(() => setPlaying(id), () => toast('לא הצלחנו לנגן את הדוגמה. נסה שוב.'))
  }

  return (
    <div className="screen voices-screen">
      <header className="page-head page-head--back">
        <BackButton fallback="/settings" />
        <h1 className="page-title">בחירת קריין</h1>
      </header>
      <p className="page-sub">שלושה קולות קוראים את אותו קטע. תקשיב לכל אחד ובחר את הקול שילווה אותך בכל השיעורים.</p>

      <audio
        ref={audio}
        preload="none"
        onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
        onEnded={() => (setPlaying(undefined), setProgress(0))}
      />

      {list.length === 0 ? (
        <div className="voicewait">
          <IconHeadphones size={28} />
          <h2>הדוגמאות עוד לא הוקלטו</h2>
          <p>הקולות נוצרים בשרת דרך ElevenLabs. ברגע שמפתח ה־API יאושר, שלוש הדוגמאות יופיעו כאן.</p>
        </div>
      ) : (
        <ul className="vcards">
          {list.map((v, i) => {
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
                  <span className="vcard__n">קול {i + 1}</span>
                  <strong>{v.name}</strong>
                  {v.desc && <span className="vcard__desc">{v.desc}</span>}
                </div>
                <button
                  className={`btn btn--sm ${isChosen ? 'btn--done' : 'btn--ghost'}`}
                  onClick={() => (store.set({ narrator: v.id }, { immediate: true }), toast(`נבחר: ${v.name}. נקליט איתו את כל השיעורים.`))}
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
      )}
    </div>
  )
}
