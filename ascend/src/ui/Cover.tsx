import { memo } from 'react'
import { categoryById } from '../content'
import type { Book, Motif } from '../content/types'
import { coverStyle, coverSvg } from './coverArt'
import realCovers from '../content/coversManifest.json'

const real = realCovers as Record<string, boolean>
export const hasRealCover = (id: string) => !!real[id]
export const coverUrl = (id: string) => `covers/${id}.jpg`

export const bookHue = (b: Book) => categoryById[b.category].hue + b.shade * 7 - 7
export const bookMotif = (b: Book): Motif => categoryById[b.category].motif

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export const Cover = memo(function Cover({ book, size = 'md', className = '' }: { book: Book; size?: Size; className?: string }) {
  const showText = size !== 'xs'
  const style = coverStyle(book.id)
  if (real[book.id])
    return (
      <div className={`cover cover--${size} cover--photo ${className}`} style={{ ['--hue' as string]: bookHue(book) }}>
        <img className="cover__img" src={coverUrl(book.id)} alt={`${book.title}, ${book.author}`} loading="lazy" decoding="async" />
        <div className="cover__sheen" />
      </div>
    )
  // No real cover yet: a clean typographic jacket (no generated shapes).
  return (
    <div className={`cover cover--${size} cover--type cover--${style} ${className}`} style={{ ['--hue' as string]: bookHue(book) }}>
      {showText && (
        <div className="cover__type">
          <span className="cover__author">{book.author}</span>
          <span className="cover__rule" aria-hidden="true" />
          <span className="cover__title">{book.title}</span>
          <span className="cover__orig" lang="en" dir="ltr">
            {book.originalTitle.split(':')[0]}
          </span>
        </div>
      )}
      <div className="cover__sheen" />
    </div>
  )
})

export function Art({ seed, motif, hue, className = '', square }: { seed: string; motif: Motif; hue: number; className?: string; square?: boolean }) {
  return <div className={`art ${className}`} dangerouslySetInnerHTML={{ __html: coverSvg(seed, motif, hue, { square }) }} />
}

/** The book's own cover, blurred, as an atmospheric background. */
export function Backdrop({ book, className = '' }: { book: Book; className?: string }) {
  return real[book.id] ? (
    <img className={`backdrop ${className}`} src={coverUrl(book.id)} alt="" aria-hidden="true" />
  ) : (
    <div className={`backdrop backdrop--tone ${className}`} style={{ ['--hue' as string]: bookHue(book) }} aria-hidden="true" />
  )
}

/** A small fanned stack of book covers, for paths and areas. */
export function CoverFan({ books, className = '' }: { books: Book[]; className?: string }) {
  const list = [...books].sort((a, b) => Number(!!real[b.id]) - Number(!!real[a.id])).slice(0, 3)
  return (
    <span className={`stack ${className}`} aria-hidden="true">
      {list.map((b, i) => (
        <span key={b.id} className={`stack__book stack__book--${i}`}>
          <Cover book={b} size="sm" />
        </span>
      ))}
    </span>
  )
}
