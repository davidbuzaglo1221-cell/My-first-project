import { useEffect, useRef, useState } from 'react'
import { analyze, DRILLS, type SpeechMetrics } from '../lib/speech'
import { store, uid, useStore } from '../lib/store'
import { BackButton } from '../ui/Kit'
import { toast } from '../ui/uiState'

type Rec = { start(): void; stop(): void; abort(): void; lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: (() => void) | null }
const Recognition = () => (globalThis as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ?? (globalThis as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition

/**
 * Speech practice: record, measure on the device, compare with your own earlier takes. The audio is never uploaded and
 * not stored after you leave; only the numbers are saved. Charisma is not scored: it cannot be measured honestly.
 */
export function SpeechLab() {
  const history = useStore((s) => s.speech) ?? []
  const [drill, setDrill] = useState(DRILLS[0].id)
  const [consent, setConsent] = useState(() => {
    try {
      return localStorage.getItem('hamasa:speech-ok') === '1'
    } catch {
      return false
    }
  })
  const [rec, setRec] = useState<{ start: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<{ m: SpeechMetrics; url: string } | null>(null)
  const media = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const words = useRef('')
  const recog = useRef<Rec | null>(null)
  const [, setT] = useState(0)
  useEffect(() => {
    if (!rec) return
    const t = setInterval(() => setT((x) => x + 1), 250)
    return () => clearInterval(t)
  }, [rec])
  useEffect(() => () => (media.current?.state === 'recording' && media.current.stop(), recog.current?.abort()), [])
  const d = DRILLS.find((x) => x.id === drill)!
  const prev = history.filter((h) => h.drill === drill).slice(-1)[0]

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      const mr = new MediaRecorder(stream)
      chunks.current = []
      words.current = ''
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setBusy(true)
        try {
          const blob = new Blob(chunks.current, { type: mr.mimeType })
          const ctx = new AudioContext()
          const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
          const m = analyze(buf.getChannelData(0), buf.sampleRate, words.current)
          ctx.close()
          setRes({ m, url: URL.createObjectURL(blob) })
          store.set((s) => ({ speech: [...(s.speech ?? []), { id: uid(), at: Date.now(), drill, m }].slice(-200) }), { immediate: true })
        } catch {
          toast('לא הצלחנו לנתח את ההקלטה. נסה שוב')
        }
        setBusy(false)
      }
      media.current = mr
      mr.start()
      const R = Recognition()
      if (R) {
        const r = new R()
        r.lang = 'he-IL'
        r.continuous = true
        r.interimResults = false
        r.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) words.current += ' ' + e.results[i][0].transcript
        }
        r.onerror = () => {}
        try {
          r.start()
          recog.current = r
        } catch {
          recog.current = null
        }
      }
      setRes(null)
      setRec({ start: Date.now() })
    } catch {
      toast('צריך לאשר גישה למיקרופון')
    }
  }
  const stopRec = () => {
    recog.current?.stop()
    setTimeout(() => media.current?.stop(), 400)
    setRec(null)
  }
  const elapsed = rec ? Math.floor((Date.now() - rec.start) / 1000) : 0

  return (
    <div className="screen speech">
      <header className="photohero">
        <img src="photos/presence.webp" alt="" decoding="async" />
        <div className="photohero__top">
          <BackButton fallback="/more" />
        </div>
        <div className="photohero__text">
          <span className="photohero__kicker">דיבור וקול</span>
          <h1>לשמוע את עצמך, ולהשתפר</h1>
          <p>מקליטים, מודדים, ומשווים לעצמך מאתמול. לא לאף אחד אחר.</p>
        </div>
      </header>

      {!consent ? (
        <div className="mhonest">
          <strong>לפני ההקלטה הראשונה</strong>
          <p>ההקלטה מנותחת בתוך הטלפון בלבד. השמע לא נשלח לשום מקום ולא נשמר אחרי שיוצאים מהמסך; נשמרים רק המספרים. התמלול (אם המכשיר תומך) נעשה על ידי שירות הדיבור של המכשיר.</p>
          <button
            className="btn btn--primary btn--wide"
            onClick={() => {
              try {
                localStorage.setItem('hamasa:speech-ok', '1')
              } catch {
                /* fine */
              }
              setConsent(true)
            }}
          >
            מאשר, בוא נתחיל
          </button>
        </div>
      ) : (
        <>
          <section className="block">
            <h2 className="glist__title">התרגיל</h2>
            <div className="mwhy">
              {DRILLS.map((x) => (
                <button key={x.id} className={`chip ${drill === x.id ? 'is-on' : ''}`} onClick={() => (setDrill(x.id), setRes(null))} disabled={!!rec}>
                  {x.title}
                </button>
              ))}
            </div>
            <p className="cnote">{d.how}</p>
          </section>

          <section className="block srec">
            <button className={`srec__btn ${rec ? 'is-on' : ''}`} onClick={rec ? stopRec : startRec} disabled={busy} aria-label={rec ? 'עצור הקלטה' : 'התחל הקלטה'}>
              <i />
            </button>
            <div className="srec__time">
              {rec ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')} / ${Math.floor(d.seconds / 60)}:${String(d.seconds % 60).padStart(2, '0')}` : busy ? 'מנתח...' : 'לחץ כדי להקליט'}
            </div>
          </section>

          {res && <Result m={res.m} prev={prev?.m} url={res.url} />}
        </>
      )}

      {history.length > 1 && (
        <section className="block">
          <h2 className="glist__title">ההקלטות שלך</h2>
          <ul className="glist glist--quiet">
            {[...history].reverse().slice(0, 8).map((h) => (
              <li key={h.id}>
                <span className="glist__row">
                  <span className="glist__body">
                    <strong>{DRILLS.find((x) => x.id === h.drill)?.title}</strong>
                    <small>
                      {new Date(h.at).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })} · {Math.round(h.m.speaking)} שנ׳ דיבור · {h.m.pauses} הפסקות
                      {h.m.wpm ? ` · ${h.m.wpm} מילים לדקה` : ''}
                      {h.m.pitchRange ? ` · טווח ${h.m.pitchRange} טונים` : ''}
                    </small>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Result({ m, prev, url }: { m: SpeechMetrics; prev?: SpeechMetrics; url: string }) {
  const delta = (a?: number | null, b?: number | null, unit = '') => (a != null && b != null ? ` (${a - b >= 0 ? '+' : ''}${Math.round((a - b) * 10) / 10}${unit} מהפעם הקודמת)` : '')
  const fillers = m.fillers?.reduce((a, f) => a + f.n, 0)
  return (
    <section className="block sres">
      <audio src={url} controls className="sres__audio" />
      <ul className="cfacts mfacts">
        <li>
          <strong>{Math.round(m.speaking)}</strong>
          <span>שניות דיבור</span>
        </li>
        <li>
          <strong>{m.pauses}</strong>
          <span>הפסקות</span>
        </li>
        <li>
          <strong>{m.wpm ?? '—'}</strong>
          <span>מילים לדקה</span>
        </li>
        <li>
          <strong>{m.pitchRange ?? '—'}</strong>
          <span>טווח אינטונציה</span>
        </li>
      </ul>
      <ul className="glist glist--quiet sres__notes">
        <li>
          <p>
            <b>הפסקות:</b> {m.pauses ? `ממוצע ${m.avgPause.toFixed(1)} שנ׳, הארוכה ${m.longestPause.toFixed(1)} שנ׳.` : 'כמעט בלי הפסקות.'} הפסקה קצרה לפני רעיון חשוב נותנת לו משקל.
            {delta(m.pauses, prev?.pauses)}
          </p>
        </li>
        <li>
          <p>
            <b>אינטונציה:</b> {m.pitchRange ? `טווח של ${m.pitchRange} טונים בין הצליל הנמוך לגבוה.` : 'לא נמדד (מעט קול רציף).'} דיבור שטוח מאוד נע סביב 5 טונים; דיבור חי ובהיר נע בדרך כלל יותר.
            {delta(m.pitchRange, prev?.pitchRange, ' טונים')}
          </p>
        </li>
        <li>
          <p>
            <b>עוצמה:</b> הקול שלך זז בטווח של {m.loudnessSpread} דציבל. תנודה מתונה שומרת על קשב; קול באותה עוצמה כל הזמן מתעייף מהר.
            {delta(m.loudnessSpread, prev?.loudnessSpread, ' דציבל')}
          </p>
        </li>
        {m.words !== undefined ? (
          <li>
            <p>
              <b>מילים:</b> {m.words} מילים{m.wpm ? `, ${m.wpm} לדקה` : ''}. קצב שיחה נוח הוא בערך 120 עד 160 מילים בדקה.
              {fillers ? ` מילות מילוי: ${m.fillers!.map((f) => `"${f.word}" ×${f.n}`).join(', ')}.` : ' בלי מילות מילוי שזוהו.'}
              {m.repeats?.length ? ` מילים שחזרו פעמיים ברצף: ${m.repeats.map((r) => r.word).join(', ')}.` : ''}
              {delta(m.wpm, prev?.wpm)}
            </p>
          </li>
        ) : (
          <li>
            <p>
              <b>מילים:</b> המכשיר לא החזיר תמלול, ולכן קצב ומילות מילוי לא נמדדו הפעם. כל שאר המדדים נמדדו מההקלטה עצמה.
            </p>
          </li>
        )}
      </ul>
    </section>
  )
}
