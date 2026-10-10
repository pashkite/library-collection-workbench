import { BookOpen, ExternalLink, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { BookCoverState } from '../lib/useBookCovers'
import type { StoredBookHolding } from '../types/library'

export function BookDetailsDrawer({ book, cover, onClose, onImageError }: { book: StoredBookHolding; cover?: BookCoverState; onClose: () => void; onImageError: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])
  const fields = [
    ['저자', book.author], ['출판사', book.publisher], ['발행연도', book.publicationYear],
    ['ISBN', book.isbn], ['KDC', book.kdc], ['청구기호', book.callNumber],
    ['자료실', book.shelfName], ['등록번호', book.registrationNumber], ['등록일', book.registeredAt],
  ]
  return <dialog ref={dialog} className="book-details-drawer" aria-labelledby="book-detail-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="book-details-inner">
      <header><strong>도서 상세정보</strong><button autoFocus aria-label="상세정보 닫기" onClick={onClose}><X size={20} /></button></header>
      <section className="book-details-hero">
        <div className="book-details-cover">{cover?.status === 'loaded' ? <img src={cover.coverUrl} alt={`${book.title} 표지`} onError={onImageError} /> : <BookOpen size={36} />}</div>
        <div><span>{book.kdc || '미분류'}</span><h2 id="book-detail-title">{book.title || '제목 없음'}</h2><p>{book.author || '저자 미상'}</p></div>
      </section>
      <dl className="book-details-fields">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '정보 없음'}</dd></div>)}</dl>
      <p className="book-details-note">소장목록에 기록된 정보입니다. 대출 가능 여부는 도서관 자료 검색에서 확인해 주세요.</p>
      <footer>{book.isbn ? <Link className="primary-button" to={`/aladin?isbn=${encodeURIComponent(book.isbn)}`} onClick={onClose}>알라딘 상세 조회<ExternalLink size={15} /></Link> : null}<button className="secondary-button" onClick={onClose}>닫기</button></footer>
    </div>
  </dialog>
}
