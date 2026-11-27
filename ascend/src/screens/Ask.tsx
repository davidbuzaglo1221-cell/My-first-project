import { useEffect, useRef, useState } from 'react'
import { bookById } from '../content'
import { AIError, assistant, type ChatProvider, type ChatTurn } from '../lib/ai'
import { haptic } from '../lib/haptics'
import { useDictation } from '../lib/listen'
import { say, stopSpeaking, type Speaking } from '../lib/speech'
import { addNote, updateSettings, useStore } from '../lib/store'
import { Cover } from '../ui/Cover'
import { IconMic, IconSend, IconSpark, IconSpeaker, IconStop } from '../ui/Icons'
import { BackButton } from '../ui/Kit'
import { toast } from '../ui/uiState'
import { NotFound } from './Explore'

const BOOK_SUGGEST = ['מה שלושת הרעיונות שהכי כדאי לי ליישם השבוע?', 'תסביר לי את הפרק הכי חשוב בספר במילים פשוטות', 'איך אני מיישם את הספר בעבודה?', 'תן לי דוגמה מהחיים לרעיון המרכזי', 'בחן אותי בשאלה פתוחה אחת']
const LIBRARY_SUGGEST = ['אני רוצה להפסיק לדחות דברים. במה להתחיל?', 'איזה ספר הכי יעזור לי עם כסף?', 'יש לי שיחה קשה מחר. מה כדאי לקרוא היום?', 'בנה לי תוכנית קריאה לחודש הקרוב']

/** Ask the book (or the whole library): a conversation grounded in the library's content, by voice or by text. */
export function Ask({ bookId }: { bookId: string }) {
  const b = bookId ? bookById[bookId] : undefined
  const settings = useStore((s) => s.settings)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const [provider, setProvider] = useState<ChatProvider | null | undefined>(undefined)
  const [speaking, setSpeaking] = useState<number | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const voice = useRef<Speaking | null>(null)
  const dict = useDictation((heard) => ask(heard))

  useEffect(() => {
    let on = true
    assistant().then((p) => on && setProvider(p))
    return () => {
      on = false
      ctl.current?.abort()
      stopSpeaking()
    }
  }, [])
  // Braces matter: newer browsers return a Promise from scrollIntoView, and React would call it as a cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [turns, live])

  if (bookId && !b) return <NotFound />
  const suggest = b ? BOOK_SUGGEST : LIBRARY_SUGGEST

  async function speak(k: number, content: string) {
    if (speaking === k) {
      voice.current?.stop()
      setSpeaking(null)
      return
    }
    haptic('tick')
    setSpeaking(k)
    voice.current = await say(content, { gender: settings.voiceGender ?? 'female', rate: settings.rate, onEnd: () => setSpeaking((x) => (x === k ? null : x)) })
    if (!voice.current) (setSpeaking(null), toast('אין במכשיר הזה קול עברי להקראה.'))
  }

  async function ask(q: string) {
    const question = q.trim()
    if (!question || busy || !provider) return
    haptic('tap')
    stopSpeaking()
    setSpeaking(null)
    const next: ChatTurn[] = [...turns, { role: 'user', content: question }]
    setTurns(next)
    setText('')
    setBusy(true)
    setLive('')
    ctl.current = new AbortController()
    try {
      const answer = await provider.chat(next.slice(-12), { bookId: b?.id, signal: ctl.current.signal, onText: setLive })
      const all: ChatTurn[] = [...next, { role: 'assistant', content: answer }]
      setTurns(all)
      haptic('success')
      if (settings.speakAnswers) speak(all.length - 1, answer)
    } catch (e) {
      const err = e instanceof AIError ? e : new AIError('server')
      if (err.code !== 'cancelled') toast(err.message)
      if (err.code === 'not_granted' || err.code === 'sampling_disabled' || err.code === 'not_configured') setProvider(null)
      // keep the question in the box so it can be sent again
      setTurns(turns)
      setText(question)
    } finally {
      setBusy(false)
      setLive('')
    }
  }

  return (
    <div className="screen ask">
      <header className="ask__top">
        <BackButton fallback={b ? `/book/${b.id}` : '/explore'} />
        <div className="ask__book">
          {b ? <Cover book={b} size="xs" /> : <span className="ask__glyph"><IconSpark size={20} /></span>}
          <span>
            <strong>{b ? 'שאל את הספר' : 'שאל את הספרייה'}</strong>
            <small>{b ? b.title : 'המלצות והסברים מכל הספרים'}</small>
          </span>
        </div>
        <button
          className={`icon-btn ask__voice ${settings.speakAnswers ? 'is-on' : ''}`}
          onClick={() => (haptic('tick'), updateSettings({ speakAnswers: !settings.speakAnswers }), settings.speakAnswers && stopSpeaking())}
          aria-pressed={!!settings.speakAnswers}
          aria-label="הקראת תשובות בקול"
          title="הקראת תשובות בקול"
        >
          <IconSpeaker size={20} />
        </button>
      </header>

      {provider === undefined ? (
        <div className="ask__log" aria-busy="true">
          <div className="skel skel--line" />
          <div className="skel skel--line skel--short" />
        </div>
      ) : provider === null ? (
        <div className="ask__off" role="status">
          <IconSpark size={28} />
          <p>העוזר החכם עוד לא מחובר בכתובת הזו, ולכן אין כאן תשובות מומצאות. בינתיים כל ספר פתוח לקריאה, להאזנה ולמבחן.</p>
        </div>
      ) : (
        <>
          <div className="ask__log" aria-live="polite">
            {turns.length === 0 && (
              <div className="ask__intro">
                <p>{b ? `שאל כל שאלה על ״${b.title}״. התשובות מבוססות על כל פרקי הספר.` : 'ספר מה מעסיק אותך, והספרייה תמצא את הספר והפרק שמתאימים לך.'}</p>
                {dict.supported && <p className="ask__hint">אפשר גם לדבר: לחיצה על המיקרופון.</p>}
                <div className="ask__sugs">
                  {suggest.map((s) => (
                    <button key={s} className="chip chip--ghost" onClick={() => ask(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((t, k) => (
              <div key={k} className={`bubble bubble--${t.role}`}>
                <p>{t.content}</p>
                {t.role === 'assistant' && (
                  <div className="bubble__tools">
                    <button className="bubble__save" onClick={() => speak(k, t.content)} aria-label={speaking === k ? 'עצור הקראה' : 'הקרא תשובה'}>
                      {speaking === k ? <IconStop size={14} /> : <IconSpeaker size={15} />} {speaking === k ? 'עצור' : 'הקרא'}
                    </button>
                    <button className="bubble__save" onClick={() => (addNote({ kind: 'note', bookId: b?.id ?? '', text: t.content, quote: turns[k - 1]?.content }), haptic('success'), toast('נשמר במחברת'))}>
                      שמור במחברת
                    </button>
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="bubble bubble--assistant">
                {live ? (
                  <p>{live}</p>
                ) : (
                  <p className="typing" aria-label="כותב תשובה">
                    <i />
                    <i />
                    <i />
                  </p>
                )}
              </div>
            )}
            <div ref={end} />
          </div>
          <form className="ask__bar" onSubmit={(e) => (e.preventDefault(), ask(text))}>
            {dict.supported && (
              <button
                type="button"
                className={`icon-btn ask__mic ${dict.listening ? 'is-live' : ''}`}
                onClick={() => (haptic('tap'), dict.listening ? dict.stop() : dict.start())}
                aria-label={dict.listening ? 'סיים הקלטה' : 'שאל בקול'}
                aria-pressed={dict.listening}
                disabled={busy}
              >
                <IconMic size={20} />
              </button>
            )}
            <input
              value={dict.listening ? dict.text : text}
              onChange={(e) => setText(e.target.value)}
              placeholder={dict.listening ? 'מקשיב…' : dict.state === 'denied' ? 'אין הרשאה למיקרופון. אפשר להקליד…' : 'שאל שאלה…'}
              aria-label="שאלה"
              enterKeyHint="send"
              autoComplete="off"
              maxLength={1500}
              readOnly={dict.listening}
            />
            {busy ? (
              <button type="button" className="icon-btn ask__send" onClick={() => ctl.current?.abort()} aria-label="עצור תשובה">
                <IconStop size={16} />
              </button>
            ) : (
              <button type="submit" className="icon-btn ask__send" disabled={!text.trim()} aria-label="שלח">
                <IconSend size={18} />
              </button>
            )}
          </form>
        </>
      )}
    </div>
  )
}
