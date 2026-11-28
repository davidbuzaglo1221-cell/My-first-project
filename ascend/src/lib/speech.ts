/**
 * Speech practice analysis, done on the device. Acoustic measures come from the recording itself; word measures
 * only exist when the device produced a transcript. Charisma and confidence are not measured: they are not
 * objectively measurable from a recording, and the app does not pretend otherwise.
 */
export interface SpeechMetrics {
  seconds: number // whole recording
  speaking: number // seconds with voice
  pauses: number // silences of 0.3 s or more between speech
  avgPause: number // seconds
  longestPause: number // seconds
  loudnessSpread: number // dB, how much the voice level moves (more = more dynamic)
  pitchMedian: number | null // Hz
  pitchRange: number | null // semitones between the 10th and 90th percentile
  words?: number
  wpm?: number // words per minute of speaking time
  fillers?: { word: string; n: number }[]
  repeats?: { word: string; n: number }[]
}

const FRAME = 0.02 // seconds

/** Frame energies in dB. */
function frames(x: Float32Array, sr: number) {
  const n = Math.floor(sr * FRAME)
  const out: number[] = []
  for (let i = 0; i + n <= x.length; i += n) {
    let s = 0
    for (let j = i; j < i + n; j++) s += x[j] * x[j]
    out.push(10 * Math.log10(s / n + 1e-12))
  }
  return out
}

/** Autocorrelation pitch for one frame window; null when unvoiced. */
function pitchAt(x: Float32Array, start: number, sr: number) {
  const n = Math.floor(sr * 0.04)
  const minLag = Math.floor(sr / 400)
  const maxLag = Math.floor(sr / 70)
  if (start + n + maxLag > x.length) return null
  let best = 0
  let lag = 0
  let e0 = 0
  for (let j = 0; j < n; j++) e0 += x[start + j] * x[start + j]
  for (let l = minLag; l <= maxLag; l++) {
    let c = 0
    let e1 = 0
    for (let j = 0; j < n; j++) {
      c += x[start + j] * x[start + j + l]
      e1 += x[start + j + l] * x[start + j + l]
    }
    const r = c / Math.sqrt(e0 * e1 + 1e-12)
    if (r > best) (best = r), (lag = l)
  }
  return best > 0.55 ? sr / lag : null
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * (s.length - 1))))]
}

export const FILLERS = ['אממ', 'אהה', 'אה', 'כאילו', 'בעצם', 'יעני', 'סתם', 'כזה', 'נגיד', 'אז כאילו']

export function analyze(x: Float32Array, sr: number, transcript?: string): SpeechMetrics {
  const db = frames(x, sr)
  const floor = pct(db, 10)
  const peak = pct(db, 95)
  const thr = Math.max(floor + 10, peak - 32)
  const voiced = db.map((d) => d > thr)
  // smooth: fill gaps shorter than 0.12 s inside speech
  for (let i = 1; i < voiced.length - 1; i++) if (!voiced[i]) {
    let k = i
    while (k < voiced.length && !voiced[k]) k++
    if (k - i < 6 && i > 0 && voiced[i - 1] && k < voiced.length) for (let j = i; j < k; j++) voiced[j] = true
    i = k
  }
  const first = voiced.indexOf(true)
  const last = voiced.lastIndexOf(true)
  const gaps: number[] = []
  if (first >= 0) {
    let run = 0
    for (let i = first; i <= last; i++) {
      if (!voiced[i]) run++
      else {
        if (run * FRAME >= 0.3) gaps.push(run * FRAME)
        run = 0
      }
    }
  }
  const vdb = db.filter((_, i) => voiced[i])
  const mean = vdb.reduce((a, b) => a + b, 0) / Math.max(1, vdb.length)
  const spread = Math.sqrt(vdb.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vdb.length))
  const pitches: number[] = []
  const hop = Math.floor(sr * FRAME)
  for (let i = 0; i < voiced.length; i += 2) if (voiced[i]) {
    const p = pitchAt(x, i * hop, sr)
    if (p) pitches.push(p)
  }
  const speaking = vdb.length * FRAME
  const m: SpeechMetrics = {
    seconds: x.length / sr,
    speaking,
    pauses: gaps.length,
    avgPause: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0,
    longestPause: gaps.length ? Math.max(...gaps) : 0,
    loudnessSpread: Math.round(spread * 10) / 10,
    pitchMedian: pitches.length > 20 ? Math.round(pct(pitches, 50)) : null,
    pitchRange: pitches.length > 20 ? Math.round(12 * Math.log2(pct(pitches, 90) / pct(pitches, 10)) * 10) / 10 : null,
  }
  if (transcript && transcript.trim()) Object.assign(m, wordStats(transcript, speaking))
  return m
}

export function wordStats(transcript: string, speakingSeconds: number) {
  const words = transcript.replace(/[^א-ת\s]/g, ' ').split(/\s+/).filter(Boolean)
  const fillers = FILLERS.map((f) => ({ word: f, n: f.includes(' ') ? transcript.split(f).length - 1 : words.filter((w) => w === f).length })).filter((x) => x.n > 0)
  const counts: Record<string, number> = {}
  words.forEach((w, i) => i > 0 && w === words[i - 1] && w.length > 1 && (counts[w] = (counts[w] ?? 0) + 1))
  return {
    words: words.length,
    wpm: speakingSeconds > 3 ? Math.round(words.length / (speakingSeconds / 60)) : undefined,
    fillers,
    repeats: Object.entries(counts).map(([word, n]) => ({ word, n })),
  }
}

export const DRILLS = [
  { id: 'minute', title: 'דקה על נושא אחד', how: 'בחר נושא שאתה מכיר, ודבר עליו דקה שלמה. מטרה: בלי לעצור באמצע משפט.', seconds: 60 },
  { id: 'slow', title: 'דיבור איטי ומדויק', how: 'קרא שלושה משפטים בקצב איטי מהרגיל, עם הפסקה קצרה אחרי כל משפט.', seconds: 45 },
  { id: 'nofill', title: 'סיפור בלי מילות מילוי', how: 'ספר מה עשית אתמול, בלי "כאילו", "בעצם" או "אממ". אם יש צורך, עצור בשקט.', seconds: 60 },
  { id: 'assert', title: 'אמירה אסרטיבית', how: 'אמור לא למשהו שביקשו ממך, במשפט אחד ברור, בלי להתנצל ובלי להסביר יותר מדי.', seconds: 30 },
  { id: 'pitch', title: 'אינטונציה חיה', how: 'אמור את אותו משפט שלוש פעמים: פעם כשאלה, פעם כהחלטה, פעם בהתלהבות.', seconds: 40 },
]
