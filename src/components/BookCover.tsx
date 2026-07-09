import { BookOpen } from 'lucide-react'
import type { BookCoverSource, BookCoverState } from '../lib/useBookCovers'
import { normalizeIsbn } from '../utils/normalize'

interface BookCoverProps<T extends BookCoverSource> {
  book: T
  cover?: BookCoverState
  size?: 'md' | 'lg'
  onLoad: (book: T) => void
  onImageError: (book: T) => void
}

export function BookCover<T extends BookCoverSource>({
  book,
  cover,
  size = 'md',
  onLoad,
  onImageError,
}: BookCoverProps<T>) {
  const key = normalizeIsbn(book.isbn)
  const sizeClass = `size-${size}`

  if (cover?.status === 'loaded') {
    return (
      <img
        className={`cover-thumb ${sizeClass}`}
        src={cover.coverUrl}
        alt={`${cover.title} 표지`}
        loading="lazy"
        onError={() => onImageError(book)}
      />
    )
  }

  if (cover?.status === 'loading') {
    return <span className={`cover-placeholder ${sizeClass}`}>조회 중</span>
  }

  if (!key) {
    return <span className={`cover-placeholder ${sizeClass}`}>ISBN 없음</span>
  }

  return (
    <button
      type="button"
      className={`cover-button ${sizeClass}`}
      onClick={() => onLoad(book)}
      title={cover?.message}
    >
      <BookOpen size={size === 'lg' ? 18 : 16} aria-hidden="true" />
      {cover?.status === 'error' ? '재시도' : '표지'}
    </button>
  )
}
