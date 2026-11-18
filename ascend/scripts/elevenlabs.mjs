// Server-side ElevenLabs narration for ASCEND. The API key never enters the app or the repo:
// it is read from ELEVENLABS_API_KEY (or injected by the environment's network proxy).
//
//   node scripts/elevenlabs.mjs voices            find Hebrew-capable male voices, render 3 samples
//   node scripts/elevenlabs.mjs render <voiceId>  render every lesson and summary (resumable)
//   node scripts/elevenlabs.mjs one <voiceId> <id> render a single track
//
// Output matches the app's narration format: public/audio/<id>.mp3 + <id>.json (sentence start times).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const API = 'https://api.elevenlabs.io'
const KEY = process.env.ELEVENLABS_API_KEY || 'proxy-injected'
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_v3'
const OUT = 'public/audio'
const headers = { 'xi-api-key': KEY, 'content-type': 'application/json' }

async function api(path, init = {}) {
  const r = await fetch(API + path, { ...init, headers: { ...headers, ...(init.headers || {}) } })
  if (!r.ok) throw new Error(`${r.status} ${path}: ${(await r.text()).slice(0, 300)}`)
  return r
}

/** A calm, deep podcast read: v3 follows paragraph breaks and ellipses as natural pauses. */
const SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true }

async function speak(voiceId, text) {
  const r = await api(`/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    body: JSON.stringify({ text, model_id: MODEL, language_code: 'he', voice_settings: SETTINGS }),
  })
  return r.json()
}

/** Sentence start times from the character alignment ElevenLabs returns. */
function sentenceTimes(sent, segments, alignment) {
  const starts = alignment.character_start_times_seconds
  let from = 0
  return segments.map((seg) => {
    const at = sent.indexOf(seg, from)
    const idx = at === -1 ? from : at
    from = idx + seg.length
    return { t: Math.round((starts[Math.min(idx, starts.length - 1)] ?? 0) * 100) / 100, text: seg }
  })
}

function loadItems() {
  if (!existsSync('/home/user/tts/scripts.json')) execFileSync('node', ['scripts/export-scripts.mjs'], { stdio: 'inherit' })
  return JSON.parse(readFileSync('/home/user/tts/scripts.json', 'utf8'))
}

async function renderItem(voiceId, it) {
  const paras = it.paras.map((p) => p.join(' '))
  const sent = paras.join('\n\n')
  const res = await speak(voiceId, sent)
  const mp3 = Buffer.from(res.audio_base64, 'base64')
  writeFileSync(`${OUT}/${it.id}.mp3`, mp3)
  const segs = sentenceTimes(sent, it.paras.flat(), res.alignment || res.normalized_alignment)
  const ends = (res.alignment || res.normalized_alignment).character_end_times_seconds
  writeFileSync(`${OUT}/${it.id}.json`, JSON.stringify({ duration: ends[ends.length - 1], segments: segs, voice: voiceId }))
  return { bytes: mp3.length, seconds: ends[ends.length - 1] }
}

const SAMPLE = `הנה דבר שרוב האנשים לא יודעים על כסף.
הצלחה כלכלית היא לא באמת עניין של ידע... היא עניין של התנהגות.
אפשר להבין הכל על ריבית ומניות, ועדיין להפסיד. כי ההחלטות החשובות לא מתקבלות בגיליון אקסל. הן מתקבלות ליד שולחן ארוחת הערב, תחת לחץ, קנאה ופחד.
אז היום, נלמד איך לשנות את זה.`

async function voices() {
  // Prefer voices built for Hebrew narration in the shared library; fall back to premade multilingual males.
  const found = []
  try {
    const r = await api(`/v1/shared-voices?page_size=30&language=he&gender=male&sort=usage_character_count_1y`)
    for (const v of (await r.json()).voices || []) found.push({ id: v.voice_id, name: v.name, desc: v.description || v.descriptive || v.use_case || '', owner: v.public_owner_id })
  } catch (e) {
    console.warn('shared library search failed:', e.message)
  }
  const mine = await (await api('/v2/voices?page_size=100')).json()
  for (const v of mine.voices || []) if ((v.labels?.gender || '').toLowerCase() === 'male') found.push({ id: v.voice_id, name: v.name, desc: [v.labels?.accent, v.labels?.description, v.labels?.use_case].filter(Boolean).join(', ') })
  console.log(`candidates: ${found.length}`)
  mkdirSync(`${OUT}/voices`, { recursive: true })
  const picked = []
  for (const v of found) {
    if (picked.length === 3) break
    try {
      if (v.owner) await api(`/v1/voices/add/${v.owner}/${v.id}`, { method: 'POST', body: JSON.stringify({ new_name: `ASCEND ${v.name}` }) }).catch(() => {})
      const res = await speak(v.id, SAMPLE)
      writeFileSync(`${OUT}/voices/${v.id}.mp3`, Buffer.from(res.audio_base64, 'base64'))
      picked.push({ id: v.id, name: v.name, desc: v.desc.slice(0, 120) })
      console.log('sample ok:', v.name)
    } catch (e) {
      console.warn('sample failed:', v.name, e.message.slice(0, 160))
    }
  }
  writeFileSync('src/content/voiceSamples.json', JSON.stringify(picked, null, 2))
  console.log(`${picked.length} samples written`)
}

async function render(voiceId, only) {
  mkdirSync(OUT, { recursive: true })
  for (const it of loadItems()) {
    if (only && it.id !== only) continue
    const meta = `${OUT}/${it.id}.json`
    if (!only && existsSync(meta) && JSON.parse(readFileSync(meta, 'utf8')).voice === voiceId) continue
    const t = Date.now()
    const r = await renderItem(voiceId, it)
    console.log(`${it.id}: ${r.seconds.toFixed(0)}s audio, ${(r.bytes / 1024).toFixed(0)} KB, ${((Date.now() - t) / 1000).toFixed(0)}s`)
  }
}

const [cmd, a, b] = process.argv.slice(2)
if (cmd === 'voices') await voices()
else if (cmd === 'render') await render(a)
else if (cmd === 'one') await render(a, b)
else console.log('usage: voices | render <voiceId> | one <voiceId> <trackId>')
