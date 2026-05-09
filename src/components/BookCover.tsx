import { BookOpen } from 'lucide-react'
import type { BookCoverSource, BookCoverState } from '../lib/useBookCovers'
import { normalizeIsbn } from '../utils/normalize'

interface BookCoverProps<T extends BookCoverSource> {
  book: T
  cover?: BookCoverState
  onLoad: (book: T) => void
  onImageError: (book: T) => void
}

export function BookCover<T extends BookCoverSource>({ book, cover, onLoad, onImageError }: BookCoverProps<T>) {
  const key = normalizeIsbn(book.isbn)

  if (cover?.status === 'loaded') {
    return (
      <img
        className="cover-thumb"
        src={cover.coverUrl}
        alt={`${cover.title} 표지`}
        loading="lazy"
        onError={() => onImageError(book)}
      />
    )
  }

  if (cover?.status === 'loading') {
    return <span className="cover-placeholder">조회 중</span>
  }

  if (!key) {
    return <span className="cover-placeholder">ISBN 없음</span>
  }

  return (
    <button type="button" className="cover-button" onClick={() => onLoad(book)} title={cover?.message}>
      <BookOpen size={16} aria-hidden="true" />
      {cover?.status === 'error' ? '재시도' : '표지'}
    </button>
  )
}
