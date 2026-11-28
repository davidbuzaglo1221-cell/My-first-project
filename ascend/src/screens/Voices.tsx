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
]
/**
 * Premium Hebrew voices from ElevenLabs (Eleven v4, verified for Hebrew). Real voice IDs from the ElevenLabs voice
 * library. The previews are recordings David made in ElevenLabs; they are samples only. Narrating books with these
 * voices needs a paid ElevenLabs plan (the free plan returns 402 for library voices over the API), so they cannot be
 * chosen yet.
 */
export const PREMIUM_VOICES = [
  { id: 'itamar', name: 'איתמר', voiceId: 'l7Q9rbdCC6j3J5dNlOOg', desc: 'קריין ישראלי עמוק וברור, מלא הבעה. הכי מדויק בבדיקה.', tag: 'עמוק וסמכותי' },
  { id: 'nimrod', name: 'נמרוד', voiceId: 'ZiofZHcEBTn5sRySe5h8', desc: 'חם ובטוח בעצמו, כמו מנטור שמדבר איתך ישירות.', tag: 'חם וקרוב' },
  { id: 'danit', name: 'דנית', voiceId: 's0T0DT6EAPeX57MQpn3I', desc: 'קול נשי טבעי וצלול, עברית ישראלית רגועה ונעימה.', tag: 'טבעי ורגוע' },
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

  function toggle(id: string, preview?: string) {
    const a = audio.current!
    if (playing === id) {
      a.pause()
      setPlaying(undefined)
      return
    }
    pausePlayer()
    if (preview) {
      start.current = 0
      end.current = 0
      a.src = preview
    } else {
      const n = available[id][SAMPLE]
      end.current = (n.o ?? 0) + n.d
      start.current = n.o ?? 0
      a.src = `audio/${id}/${n.f ?? SAMPLE}.mp3`
    }
    a.currentTime = start.current
    setProgress(0)
    a.play().then(
      () => setPlaying(id),
      () => toast('לא הצלחנו לנגן את הדוגמה. נסה שוב.'),
    )
  }

  return (
    <div className="screen voices-screen">
      <header className="photohero">
        <img src="photos/evening2.webp" alt="" decoding="async" />
        <div className="photohero__top">
          <BackButton fallback="/settings" />
        </div>
        <div className="photohero__text">
          <span className="photohero__kicker">הקריין</span>
          <h1>הקול שילווה אותך</h1>
        </div>
      </header>
      <p className="page-sub">שלוש אפשרויות קריינות. כל אחת מקריאה את אותו סיכום, "הפסיכולוגיה של הכסף בדקה". תקשיב ובחר את מי שנעים לך לשמוע.</p>

      <audio
        ref={audio}
        preload="none"
        onLoadedMetadata={(e) => (e.currentTarget.currentTime = start.current)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget
          const len = (end.current || a.duration || 0) - start.current
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

      <section className="vpremium" aria-label="קולות פרימיום">
        <div className="vpremium__head">
          <span className="vpremium__kicker">קולות פרימיום</span>
          <h2>דוברי עברית ישראלים, ברמת אולפן</h2>
          <p>שלושה קולות שעברו בדיקה על אותו טקסט: הגייה, מבטא ישראלי וטבעיות. אפשר להאזין עכשיו. כדי שיקריאו את הספרים צריך לשדרג את שירות הקולות.</p>
        </div>
        <ul className="vcards">
          {PREMIUM_VOICES.map((v) => {
            const on = playing === v.id
            return (
              <li key={v.id} className={`vcard vcard--premium ${on ? 'is-playing' : ''}`}>
                <button className="vcard__play" onClick={() => toggle(v.id, `voices/${v.id}.m4a`)} aria-label={`${on ? 'עצור' : 'השמע'} את ${v.name}`}>
                  <svg viewBox="0 0 100 100" className="vcard__ring" aria-hidden="true">
                    <circle cx="50" cy="50" r="46" pathLength={100} strokeDasharray={`${on ? progress * 100 : 0} 100`} strokeOpacity={on && progress > 0.005 ? 1 : 0} transform="rotate(-90 50 50)" />
                  </svg>
                  <PlayGlyph playing={on} size={22} />
                </button>
                <div className="vcard__body">
                  <strong>
                    {v.name} <small className="vcard__tag">{v.tag}</small>
                  </strong>
                  <span className="vcard__desc">{v.desc}</span>
                </div>
                <span className="vcard__lock">בשדרוג</span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
