/* POST /api/tts — speaks a short Hebrew text with a Microsoft neural voice (Hila or Avri) and returns MP3.
   Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in the server environment (Azure's free tier: 0.5M characters a month). */
import { allowedOrigin, cors, json, rateLimited, readJson } from './_guard'

const VOICES: Record<string, string> = { hila: 'he-IL-HilaNeural', avri: 'he-IL-AvriNeural' }

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!)

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(allowedOrigin(req)) })
}

export async function POST(req: Request) {
  const origin = allowedOrigin(req)
  if (!origin) return json({ code: 'forbidden' }, 403, null)
  const key = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION
  if (!key || !region) return json({ code: 'not_configured' }, 503, origin)
  if (rateLimited(req, 20)) return json({ code: 'rate_limited' }, 429, origin)

  const body = await readJson(req, 8000)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const voice = VOICES[String(body?.voice)] ?? VOICES.hila
  const rate = Math.min(2, Math.max(0.5, Number(body?.rate) || 1))
  if (!text || text.length > 2500) return json({ code: 'bad_request' }, 400, origin)

  const ssml = `<speak version="1.0" xml:lang="he-IL"><voice name="${voice}"><prosody rate="${Math.round((rate - 1) * 100)}%">${xml(text)}</prosody></voice></speak>`
  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'hasifria' },
    body: ssml,
    signal: req.signal,
  })
  if (!r.ok || !r.body) return json({ code: r.status === 429 ? 'rate_limited' : 'upstream' }, 502, origin)
  return new Response(r.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400', ...cors(origin) } })
}
