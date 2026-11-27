import { useEffect, useState } from 'react'
/* AI providers behind one interface. The screens ask `assistant()` and never know which engine answers:
   1. the app's own server (/api/assistant, key kept on the server) — when it is deployed and configured;
   2. the viewer's Claude, when the app runs inside a Claude viewer.
   When neither is available the screens say so honestly; nothing is faked. */
import { bookById, books } from '../content'
import { errorText, getSample } from './claude'
import { bookTutor, libraryGuide, type ChatTurn } from './tutor'

export type { ChatTurn }

export interface ChatOptions {
  bookId?: string
  signal?: AbortSignal
  onText?: (soFar: string) => void
}

export interface ChatProvider {
  id: 'server' | 'claude-viewer'
  chat(turns: ChatTurn[], opts: ChatOptions): Promise<string>
}

export class AIError extends Error {
  constructor(
    public code: string,
    message = errorText(code),
  ) {
    super(message)
  }
}

/** Where the server lives: same origin by default, or VITE_AI_BASE when the app is hosted elsewhere (GitHub Pages). */
export const serverBase = () => ((import.meta.env.VITE_AI_BASE as string | undefined) || new URL('.', location.href).href).replace(/\/$/, '')

export interface ServerCaps {
  chat: boolean
  tts: boolean
}

let caps: Promise<ServerCaps> | undefined
/** Asks the server once which features are configured. A static host (no server) answers "nothing". */
export function serverCaps(): Promise<ServerCaps> {
  return (caps ??= fetch(`${serverBase()}/api/assistant`, { headers: { Accept: 'application/json' } })
    .then(async (r) => {
      if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return { chat: false, tts: false }
      const j = (await r.json()) as Partial<ServerCaps>
      return { chat: !!j.chat, tts: !!j.tts }
    })
    .catch(() => ({ chat: false, tts: false })))
}

const serverProvider: ChatProvider = {
  id: 'server',
  async chat(turns, { bookId, signal, onText }) {
    const r = await fetch(`${serverBase()}/api/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, messages: turns }),
      signal,
    }).catch((e) => {
      throw new AIError(signal?.aborted ? 'cancelled' : 'network')
    })
    if (!r.ok || !r.body) {
      const j = (await r.json().catch(() => ({}))) as { code?: string }
      throw new AIError(j.code ?? 'server')
    }
    const reader = r.body.getReader()
    const dec = new TextDecoder()
    let text = ''
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        text += dec.decode(value, { stream: true })
        onText?.(text)
      }
    } catch {
      if (signal?.aborted) throw new AIError('cancelled')
      throw new AIError('network')
    }
    return text.trim()
  },
}

const viewerProvider = (sample: NonNullable<Awaited<ReturnType<typeof getSample>>>): ChatProvider => ({
  id: 'claude-viewer',
  async chat(turns, { bookId, signal, onText }) {
    const b = bookId ? bookById[bookId] : undefined
    const system = b ? bookTutor(b) : libraryGuide(books)
    try {
      const { text } = await sample([{ role: 'user', content: system }, ...turns], {
        cache: false,
        signal,
        onText: ({ text }: { text: string }) => onText?.(text),
      })
      return text
    } catch (e) {
      const err = e as { code?: string }
      throw new AIError(err.code ?? 'server')
    }
  },
})

/** The best available provider, or null when the device has no AI available. */
export async function assistant(): Promise<ChatProvider | null> {
  const [c, sample] = await Promise.all([serverCaps(), getSample()])
  if (c.chat) return serverProvider
  if (sample) return viewerProvider(sample)
  return null
}

/** Test hook: forget the cached server answer. */
export const resetAI = () => (caps = undefined)

/** True once an AI provider answers; entry points to the assistant stay hidden until then. */
export function useAIAvailable() {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    let on = true
    assistant().then((p) => on && setOk(!!p))
    return () => {
      on = false
    }
  }, [])
  return ok
}
