import { useEffect, useRef, useState } from 'react'
import { bookById } from '../content'
import { errorText, getSample } from '../lib/claude'
import { addNote } from '../lib/store'
import { Cover } from '../ui/Cover'
import { IconSpark } from '../ui/Icons'
import { BackButton } from '../ui/Kit'
import { toast } from '../ui/uiState'
import { NotFound } from './Explore'

type Turn = { role: 'user' | 'assistant'; content: string }

const SUGGEST = ['מה שלושת הרעיונות שהכי כדאי לי ליישם השבוע?', 'תסביר לי את הפרק הכי חשוב בספר במילים פשוטות', 'איך אני מיישם את הספר בעבודה?', 'תן לי דוגמה מהחיים לרעיון המרכזי', 'בחן אותי בשאלה פתוחה אחת']

/** Ask the book: a conversation with Claude, grounded in the book's chapters. */
export function Ask({ bookId }: { bookId: string }) {
  const b = bookById[bookId]
  const [turns, setTurns] = useState<Turn[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const [avail, setAvail] = useState<boolean | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let on = true
    getSample().then((s) => on && setAvail(!!s))
    return () => {
      on = false
      ctl.current?.abort()
    }
  }, [])
  useEffect(() => end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), [turns, live])
  if (!b) return <NotFound />

  const context = [
    `ספר: ${b.title} (${b.originalTitle}), מאת ${b.author}.`,
    ...b.lessons.map((l, i) => `פרק ${i + 1}: ${l.title}\n${l.script}\nהשורה התחתונה: ${l.takeaway}`),
  ].join('\n\n').slice(0, 24000)
  const rules = `אתה מורה פרטי חכם וחם באפליקציית לימוד בשם ALEXANDRIA. התלמיד לומד את הספר שלהלן. ענה תמיד בעברית טבעית וברורה, בקצרה (עד כמאה וחמישים מילה, אלא אם התבקש יותר), מבוסס על תוכן הספר. אם שואלים משהו שאינו בספר, אמור זאת וענה בזהירות מהידע הכללי שלך. היה מעשי: דוגמאות מהחיים וצעדים לביצוע. בלי כותרות ובלי סימוני עיצוב.\n\nתוכן הספר:\n${context}`

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || busy) return
    const sample = await getSample()
    if (!sample) return setAvail(false)
    const next: Turn[] = [...turns, { role: 'user', content: question }]
    setTurns(next)
    setText('')
    setBusy(true)
    setLive('')
    ctl.current = new AbortController()
    try {
      const { text: answer } = await sample([{ role: 'user', content: rules }, ...next.slice(-10)], {
        cache: false,
        signal: ctl.current.signal,
        onText: ({ text }: { text: string }) => setLive(text),
      })
      setTurns([...next, { role: 'assistant', content: answer }])
    } catch (e) {
      const err = e as { code?: string; text?: string }
      const msg = errorText(err.code)
      if (err.text) setTurns([...next, { role: 'assistant', content: err.text }])
      if (msg) toast(msg)
      if (err.code === 'not_granted' || err.code === 'sampling_disabled') setAvail(false)
    } finally {
      setBusy(false)
      setLive('')
    }
  }

  return (
    <div className="screen ask">
      <header className="ask__top">
        <BackButton fallback={`/book/${bookId}`} />
        <div className="ask__book">
          <Cover book={b} size="xs" />
          <span>
            <strong>שאל את הספר</strong>
            <small>{b.title}</small>
          </span>
        </div>
      </header>

      {avail === false ? (
        <div className="ask__off">
          <IconSpark size={28} />
          <p>שאלות לספר זמינות כשהאפליקציה פתוחה בתוך Claude ומחוברת לחשבון. בינתיים אפשר לקרוא, להאזין ולהיבחן על כל ספר.</p>
        </div>
      ) : (
        <>
          <div className="ask__log" aria-live="polite">
            {turns.length === 0 && (
              <div className="ask__intro">
                <p>שאל כל שאלה על ״{b.title}״. התשובות מבוססות על כל פרקי הספר.</p>
                <div className="ask__sugs">
                  {SUGGEST.map((s) => (
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
                  <button className="bubble__save" onClick={() => (addNote({ kind: 'note', bookId, text: t.content, quote: turns[k - 1]?.content }), toast('נשמר במחברת'))}>
                    שמור במחברת
                  </button>
                )}
              </div>
            ))}
            {busy && (
              <div className="bubble bubble--assistant">
                <p>{live || 'חושב...'}</p>
              </div>
            )}
            <div ref={end} />
          </div>
          <form className="ask__bar" onSubmit={(e) => (e.preventDefault(), ask(text))}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="שאל שאלה על הספר" aria-label="שאלה" />
            {busy ? (
              <button type="button" className="btn btn--quiet" onClick={() => ctl.current?.abort()}>
                עצור
              </button>
            ) : (
              <button type="submit" className="btn btn--primary" disabled={!text.trim()}>
                שאל
              </button>
            )}
          </form>
        </>
      )}
    </div>
  )
}
