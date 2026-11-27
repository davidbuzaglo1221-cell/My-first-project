import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { estimateSeconds, formatMinutes, lessonIndex } from '../content'
import { load, player, usePlayer, toggle } from '../engine/player'
import { useStore } from '../lib/store'
import { Cover } from './Cover'
import { IconCheck, IconForwardChevron, IconPause, IconPlay } from './Icons'
import { back } from '../lib/router'
import { openPlayer } from './uiState'

export function Ring({ value, size = 56, stroke = 3, children, className = '' }: { value: number; size?: number; stroke?: number; children?: ReactNode; className?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={`ring ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring__track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring__value"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
        />
      </svg>
      {children && <div className="ring__inner">{children}</div>}
    </div>
  )
}

export function Bar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`bar ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="bar__fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})` }} />
    </div>
  )
}

export function SectionHead({ title, action, onAction, sub }: { title: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="shead">
      <div>
        <h2 className="shead__title">{title}</h2>
        {sub && <p className="shead__sub">{sub}</p>}
      </div>
      {action && (
        <button className="link" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className={`seg__btn ${value === o.id ? 'is-on' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Start or resume a lesson and open the full player. */
export function startLesson(id: string, open = true) {
  const p = player.get()
  if (p.track?.id === id) {
    if (p.status !== 'playing') toggle()
  } else load(id, { autoplay: true })
  if (open) openPlayer()
}

export function LessonRow({ id, reason, showBook = true, index }: { id: string; reason?: string; showBook?: boolean; index?: number }) {
  const ref = lessonIndex[id]
  const prog = useStore((s) => s.progress[id])
  const cps = useStore((s) => s.cps)
  const p = usePlayer()
  if (!ref) return null
  const isCurrent = p.track?.id === id
  const playing = isCurrent && p.status === 'playing'
  const dur = estimateSeconds(ref.lesson, cps)
  const ratio = prog?.done ? 1 : prog && prog.dur ? prog.pos / prog.dur : 0
  return (
    <button className={`lrow ${isCurrent ? 'is-current' : ''}`} onClick={() => startLesson(id)} aria-label={`${playing ? 'השהה' : 'נגן'}: ${ref.lesson.title}`}>
      {index != null ? <span className={`lrow__num ${prog?.done ? 'is-done' : ''}`}>{prog?.done ? <IconCheck size={16} /> : index}</span> : <Cover book={ref.book} size="xs" />}
      <span className="lrow__body">
        <span className="lrow__title">{ref.lesson.title}</span>
        <span className="lrow__meta">
          {reason ?? (showBook ? ref.book.title : null)}
          {(reason || showBook) && <span className="sep" aria-hidden="true" />}
          {!reason && !showBook && ref.lesson.ideas?.length ? (
            <>
              {ref.lesson.ideas.length} רעיונות
              <span className="sep" aria-hidden="true" />
            </>
          ) : null}
          {prog?.done ? 'הושלם' : ratio > 0.02 ? `נותרו ${formatMinutes(dur * (1 - ratio))}` : formatMinutes(dur)}
        </span>
        {ratio > 0.02 && !prog?.done && <Bar value={ratio} className="lrow__bar" />}
      </span>
      <span className={`lrow__play ${playing ? 'is-playing' : ''}`} aria-hidden="true">
        {playing ? <Eq /> : <IconPlay size={14} />}
      </span>
    </button>
  )
}

export function Eq() {
  return (
    <span className="eq" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

export function PlayGlyph({ playing, size = 18 }: { playing: boolean; size?: number }) {
  return playing ? <IconPause size={size} /> : <IconPlay size={size} />
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [text, onDone])
  return (
    <div className="toast" role="status">
      {text}
    </div>
  )
}

export function Sheet({ open, onClose, children, label, className = '' }: { open: boolean; onClose: () => void; children: ReactNode; label: string; className?: string }) {
  const [mounted, setMounted] = useState(open)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) setMounted(true)
    else {
      const t = setTimeout(() => setMounted(false), 380)
      return () => clearTimeout(t)
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => ref.current?.focus(), 60)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, onClose])
  if (!mounted) return null
  return createPortal(
    <div className={`sheet-wrap ${open ? 'is-open' : ''}`}>
      <div className="sheet-scrim" onClick={onClose} />
      <div ref={ref} className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <div className="sheet__grip" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function BackButton({ fallback = '/' }: { fallback?: string }) {
  return (
    <button className="icon-btn back-btn" onClick={() => back(fallback)} aria-label="חזרה">
      <IconForwardChevron size={24} />
    </button>
  )
}
