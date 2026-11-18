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
  return (
    <div className={`cover cover--${size} cover--${style} ${className}`} style={{ ['--hue' as string]: bookHue(book) }}>
      <div className="cover__art" dangerouslySetInnerHTML={{ __html: coverSvg(book.id, bookMotif(book), bookHue(book), { style }) }} />
      {showText && (
        <div className="cover__text">
          <span className="cover__author">{book.author}</span>
          <span className="cover__title">{book.title}</span>
        </div>
      )}
      <div className="cover__sheen" />
    </div>
  )
})

export function Art({ seed, motif, hue, className = '', square }: { seed: string; motif: Motif; hue: number; className?: string; square?: boolean }) {
  return <div className={`art ${className}`} dangerouslySetInnerHTML={{ __html: coverSvg(seed, motif, hue, { square }) }} />
}
