/* POST /api/assistant — the book tutor and library guide, streamed as plain text.
   GET  /api/assistant — which server features are configured (no secrets are returned).
   Needs ANTHROPIC_API_KEY in the server environment. The client sends only a book id and the conversation;
   the instructions are built here from the library's own content. */
import Anthropic from '@anthropic-ai/sdk'
import { bookById, books } from '../src/content'
import { bookTutor, cleanTurns, libraryGuide } from '../src/lib/tutor'
import { allowedOrigin, cors, json, rateLimited, readJson } from './_guard'

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5'

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(allowedOrigin(req)) })
}

export function GET(req: Request) {
  return json(
    { chat: !!process.env.ANTHROPIC_API_KEY, tts: !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION), voices: ['hila', 'avri'] },
    200,
    allowedOrigin(req),
  )
}

export async function POST(req: Request) {
  const origin = allowedOrigin(req)
  if (!origin) return json({ code: 'forbidden' }, 403, null)
  if (!process.env.ANTHROPIC_API_KEY) return json({ code: 'not_configured' }, 503, origin)
  if (rateLimited(req, 12)) return json({ code: 'rate_limited' }, 429, origin)

  const body = await readJson(req, 40_000)
  const turns = cleanTurns(body?.messages)
  if (!body || !turns) return json({ code: 'bad_request' }, 400, origin)
  const bookId = typeof body.bookId === 'string' ? body.bookId : ''
  const book = bookId ? bookById[bookId] : undefined
  if (bookId && !book) return json({ code: 'bad_request' }, 400, origin)

  const client = new Anthropic()
  const stream = client.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 4000,
      // A short conversational answer: low effort keeps it quick without hurting a chat reply.
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: book ? bookTutor(book) : libraryGuide(books), cache_control: { type: 'ephemeral' } }],
      messages: turns,
    },
    { signal: req.signal },
  )

  const enc = new TextEncoder()
  const out = new ReadableStream<Uint8Array>({
    async start(ctl) {
      try {
        for await (const ev of stream) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') ctl.enqueue(enc.encode(ev.delta.text))
        }
        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal') ctl.enqueue(enc.encode('\n\nעל השאלה הזו אני לא יכול לענות. נסה לנסח אחרת.'))
        if (final.stop_reason === 'max_tokens') ctl.enqueue(enc.encode('…'))
      } catch (e) {
        if (!(e instanceof Anthropic.APIUserAbortError)) ctl.enqueue(enc.encode('\n\n[שגיאה זמנית. נסה שוב.]'))
      } finally {
        ctl.close()
      }
    },
    cancel() {
      stream.abort()
    },
  })
  return new Response(out, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', ...cors(origin) } })
}
