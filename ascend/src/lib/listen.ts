/* Voice input in Hebrew: the browser's speech recognition (Chrome, Edge, Safari), or the Claude viewer's dictation.
   The microphone button appears only where one of them exists. */
import { useEffect, useRef, useState } from 'react'
import { getDictation } from './claude'

type Rec = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

const RecCtor = () => {
  const w = globalThis as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const browserDictation = () => !!RecCtor()

export type ListenState = 'idle' | 'listening' | 'denied' | 'error'

/** Dictation hook: `text` fills live while speaking; `onFinal` fires once with the whole sentence. */
export function useDictation(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(browserDictation())
  const [state, setState] = useState<ListenState>('idle')
  const [text, setText] = useState('')
  const rec = useRef<Rec | null>(null)
  const final = useRef(onFinal)
  final.current = onFinal

  useEffect(() => {
    if (supported) return
    let on = true
    getDictation().then((d) => on && d && setSupported(true))
    return () => {
      on = false
    }
  }, [supported])

  useEffect(() => () => rec.current?.abort(), [])

  async function start() {
    setText('')
    const Ctor = RecCtor()
    if (Ctor) {
      const r = new Ctor()
      r.lang = 'he-IL'
      r.interimResults = true
      r.continuous = false
      let heard = ''
      r.onresult = (e) => {
        heard = Array.from(e.results, (x) => x[0]?.transcript ?? '').join('')
        setText(heard)
      }
      r.onerror = (e) => setState(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error === 'no-speech' || e.error === 'aborted' ? 'idle' : 'error')
      r.onend = () => {
        rec.current = null
        setState((s) => (s === 'listening' ? 'idle' : s))
        if (heard.trim()) final.current(heard.trim())
      }
      rec.current = r
      setState('listening')
      r.start()
      return
    }
    const d = await getDictation()
    if (!d) return
    setState('listening')
    let heard = ''
    d.onPartial((e) => setText((heard = e.text)))
    d.onFinal((e) => {
      heard = e.text
      setState('idle')
      if (heard.trim()) final.current(heard.trim())
    })
    d.onState((e) => e.state === 'error' && setState(e.reason === 'not_granted' ? 'denied' : 'error'))
    rec.current = { stop: () => void d.stop(), abort: () => void d.stop() } as Rec
    await d.start().catch(() => setState('error'))
  }

  const stop = () => rec.current?.stop()
  return { supported, state, text, start, stop, listening: state === 'listening' }
}
