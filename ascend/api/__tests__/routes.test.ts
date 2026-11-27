import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as assistant from '../assistant'
import * as tts from '../tts'

const ORIGIN = 'https://davidbuzaglo1221-cell.github.io'
const post = (url: string, body: unknown, origin: string | null = ORIGIN) =>
  new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) })

/** A minimal Messages API stream, as the server sends it. */
function sse(text: string) {
  const ev = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`
  const msg = { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }
  const body =
    ev('message_start', { message: msg }) +
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
    text
      .split(' ')
      .map((w, i) => ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: (i ? ' ' : '') + w } }))
      .join('') +
    ev('content_block_stop', { index: 0 }) +
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } }) +
    ev('message_stop', {})
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
}

beforeEach(() => {
  vi.unstubAllEnvs()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('/api/assistant', () => {
  it('reports which features are configured, without secrets', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    const r = assistant.GET(new Request('https://app.test/api/assistant'))
    const j = await r.json()
    expect(j).toEqual({ chat: true, tts: false, voices: ['hila', 'avri'] })
    expect(JSON.stringify(j)).not.toContain('sk-test')
  })

  it('refuses callers from other sites', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    const r = await assistant.POST(post('https://app.test/api/assistant', { messages: [{ role: 'user', content: 'hi' }] }, 'https://evil.example'))
    expect(r.status).toBe(403)
  })

  it('says so when the key is missing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const r = await assistant.POST(post('https://app.test/api/assistant', { messages: [{ role: 'user', content: 'hi' }] }))
    expect(r.status).toBe(503)
    expect((await r.json()).code).toBe('not_configured')
  })

  it('rejects malformed conversations and unknown books', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    expect((await assistant.POST(post('https://app.test/api/assistant', { messages: [{ role: 'system', content: 'x' }] }))).status).toBe(400)
    expect((await assistant.POST(post('https://app.test/api/assistant', { bookId: 'no-such-book', messages: [{ role: 'user', content: 'hi' }] }))).status).toBe(400)
  })

  it('streams the answer and builds the instructions on the server', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    let sent: Record<string, unknown> = {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body))
        return sse('שלום לך חבר')
      }),
    )
    const r = await assistant.POST(post('https://app.test/api/assistant', { bookId: 'atomic-habits', messages: [{ role: 'user', content: 'מה הרעיון המרכזי?' }] }))
    expect(r.status).toBe(200)
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(await r.text()).toBe('שלום לך חבר')
    expect(sent.model).toBe('claude-opus-5-5')
    expect(sent.fallbacks).toBe('default')
    const system = (sent.system as { text: string }[])[0].text
    expect(system).toContain('הרגלים אטומיים')
    expect(sent.messages).toEqual([{ role: 'user', content: 'מה הרעיון המרכזי?' }])
  })
})

describe('/api/tts', () => {
  it('says so when Azure is not configured', async () => {
    const r = await tts.POST(post('https://app.test/api/tts', { text: 'שלום' }))
    expect(r.status).toBe(503)
  })

  it('sends escaped SSML with the chosen Hebrew voice and returns audio', async () => {
    vi.stubEnv('AZURE_SPEECH_KEY', 'k')
    vi.stubEnv('AZURE_SPEECH_REGION', 'westeurope')
    let ssml = ''
    let url = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string, init: RequestInit) => {
        url = u
        ssml = String(init.body)
        return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } })
      }),
    )
    const r = await tts.POST(post('https://app.test/api/tts', { text: 'אני & <אתה>', voice: 'avri', rate: 1.25 }))
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('audio/mpeg')
    expect(url).toBe('https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1')
    expect(ssml).toContain('he-IL-AvriNeural')
    expect(ssml).toContain('אני &amp; &lt;אתה&gt;')
    expect(ssml).toContain('rate="25%"')
  })
})
