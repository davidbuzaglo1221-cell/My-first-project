import { useEffect, useRef, useState } from 'react'
import { books } from '../content'
import { store } from '../lib/store'
import { Cover } from '../ui/Cover'

const INSIDE = [
  { img: 'library', kicker: 'הספרייה', title: `${books.length} ספרים גדולים, כל ספר במלואו`, line: 'לקרוא או להקשיב, בקריינות חיה. רק העיקר, בלי מילוי.', books: true },
  { img: 'assistant', kicker: 'עוזר אישי', title: 'שואל את השאלה הנכונה', line: 'מטרה אחת, התחייבויות שהוא חוזר אליהן, וכל שיחה נגמרת בצעד אחד.' },
  { img: 'calm', kicker: 'מהישרדות לחופש', title: 'ללמד את הגוף להירגע', line: 'שלושים יום, נשימה ומדיטציות. מהמצב שבו שורדים, למצב שבו בוחרים.', pos: '50% 62%' },
  { img: 'situation', kicker: 'כל יום משהו חדש', title: 'האפליקציה פונה אליך', line: 'מצב מהחיים בבוקר, שאלה קטנה בערב. בלי שתצטרך לזכור.', pos: '38% 50%' },
  { img: 'progress', kicker: 'המסע', title: 'רואים את הדרך', line: 'כל פרק, כל יום וכל צעד נשמרים. רק מה שבאמת עשית.' },
]

const fmt = (s: number) => `0:${String(Math.max(0, Math.ceil(s))).padStart(2, '0')}`
const BARS = 18

/** David's own voice over music: play/pause, progress, and bars that follow the real sound. */
function useVoice() {
  const ref = useRef<HTMLAudioElement | null>(null)
  const raf = useRef(0)
  const an = useRef<AnalyserNode | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [left, setLeft] = useState(44)
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: BARS }, (_, i) => 0.25 + 0.2 * Math.sin(i)))
  const tick = () => {
    const a = ref.current
    if (!a) return
    setProgress(a.duration ? a.currentTime / a.duration : 0)
    setLeft((a.duration || 44) - a.currentTime)
    if (an.current) {
      const d = new Uint8Array(an.current.frequencyBinCount)
      an.current.getByteFrequencyData(d)
      const step = Math.floor(d.length / 2 / BARS)
      setLevels(Array.from({ length: BARS }, (_, i) => 0.12 + (d[i * step + 2] / 255) * 0.95))
    }
    raf.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => (cancelAnimationFrame(raf.current), ref.current?.pause()), [])
  const toggle = () => {
    let a = ref.current
    if (!a) {
      a = new Audio('voice/intro-david.m4a')
      a.preload = 'auto'
      ref.current = a
      a.onended = () => (setPlaying(false), cancelAnimationFrame(raf.current), setProgress(1))
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        const src = ctx.createMediaElementSource(a)
        const node = ctx.createAnalyser()
        node.fftSize = 256
        src.connect(node).connect(ctx.destination)
        an.current = node
      } catch {
        /* the sound still plays without bars */
      }
    }
    if (a.paused) {
      if (a.ended || a.currentTime >= (a.duration || 99) - 0.1) a.currentTime = 0
      a.volume = 1
      a.play().then(() => {
        setPlaying(true)
        cancelAnimationFrame(raf.current)
        raf.current = requestAnimationFrame(tick)
      }, () => setPlaying(false))
    } else {
      a.pause()
      setPlaying(false)
      cancelAnimationFrame(raf.current)
    }
  }
  const fadeOut = () => {
    const a = ref.current
    if (!a || a.paused) return
    const t0 = performance.now()
    const step = () => {
      const k = 1 - (performance.now() - t0) / 600
      if (k <= 0) return a.pause()
      a.volume = k
      requestAnimationFrame(step)
    }
    step()
  }
  return { playing, progress, left, levels, toggle, fadeOut }
}

/**
 * The entrance: the house from outside, in full, the camera gliding across it; the mark and the name;
 * then, scrolling down, what waits inside, one photograph per world. Shown once per launch.
 */
export function Opening({ onEnter }: { onEnter: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const [ready, setReady] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500)
    const el = root.current
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('is-in')), { root: el, threshold: 0.22 })
    el?.querySelectorAll('.opin').forEach((n) => io.observe(n))
    return () => (clearTimeout(t), io.disconnect())
  }, [])
  const enter = () => {
    if (leaving) return
    voice.fadeOut()
    setLeaving(true)
    store.set({ onboarded: true }, { immediate: true })
    setTimeout(onEnter, 650)
  }
  const chapters = books.reduce((a, b) => a + b.lessons.length, 0)
  const voice = useVoice()
  return (
    <div ref={root} className={`opening ${leaving ? 'is-leaving' : ''} ${ready ? 'is-ready' : ''}`}>
      <section className="ophero">
        <div className="ophero__pano" aria-hidden="true">
          <img src="photos/entrance.webp" alt="" fetchPriority="high" decoding="async" />
        </div>
        <div className="ophero__shade" aria-hidden="true" />
        <p className="opening__kicker">MY JOURNEY</p>
        <div className="opening__body">
          <h1 className="opening__brand">המסע שלי</h1>
          <span className="opening__line" aria-hidden="true" />
          <p className="opening__lead">
            {books.length} ספרים, {chapters} פרקים, עוזר אישי ותוכנית יומית. כל מה שצריך כדי להפוך לגרסה הבאה שלך.
          </p>
          <button className={`opvoice ${voice.playing ? 'is-on' : ''}`} onClick={voice.toggle} aria-label={voice.playing ? 'עצור את ההקלטה' : 'השמע את ההקלטה של דוד'}>
            <span className="opvoice__btn" style={{ ['--p' as string]: `${voice.progress * 100}%` }} aria-hidden="true">
              {voice.playing ? <i className="opvoice__pause" /> : <i className="opvoice__play" />}
            </span>
            <span className="opvoice__text">
              <strong>לפני שנכנסים</strong>
              <small>דוד, {voice.playing ? fmt(voice.left) : '44 שניות'}</small>
            </span>
            <span className="opvoice__bars" aria-hidden="true">
              {voice.levels.map((l, i) => (
                <i key={i} style={{ transform: `scaleY(${l})` }} />
              ))}
            </span>
          </button>
          <button className="opening__enter" onClick={enter}>
            כניסה
          </button>
          <button className="opening__peek" onClick={() => root.current?.querySelector('.opinside')?.scrollIntoView({ behavior: 'smooth' })}>
            מה מחכה בפנים
            <i aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="opinside" aria-label="מה מחכה בפנים">
        <h2 className="opinside__title">מה מחכה בפנים</h2>
        {INSIDE.map((x) => (
          <article key={x.img} className="opin">
            <img src={`photos/${x.img}.webp`} alt="" loading="lazy" decoding="async" style={x.pos ? { objectPosition: x.pos } : undefined} />
            <div className="opin__text">
              <small>{x.kicker}</small>
              <h3>{x.title}</h3>
              <p>{x.line}</p>
            </div>
            {x.books && (
              <div className="opening__wall" aria-hidden="true">
                <div className="owall__row">
                  {[...books, ...books].map((b, i) => (
                    <Cover key={i} book={b} size="md" eager={i < 10} />
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
        <button className="opening__enter opening__enter--end" onClick={enter}>
          כניסה אל המסע שלי
        </button>
      </section>
    </div>
  )
}
