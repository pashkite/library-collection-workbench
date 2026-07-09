import { useNavigate } from 'react-router-dom'
import { GameButton } from '../components/GameButton'
import { GameHeader } from '../components/GameHeader'
import { GlassPanel } from '../components/GlassPanel'
import { useGameStore } from '../store/useGameStore'

export function BookDetailPage() {
  const books = useGameStore((s) => s.books)
  const selectedBookId = useGameStore((s) => s.selectedBookId)
  const setPage = useGameStore((s) => s.setPage)
  const toggleBookStatus = useGameStore((s) => s.toggleBookStatus)
  const setToast = useGameStore((s) => s.setToast)
  const navigate = useNavigate()

  const book = books.find((b) => b.id === selectedBookId) ?? books[0]

  return (
    <div className="detail-layout page-enter">
      <GlassPanel className="detail-cover" style={{ padding: 16 }}>
        <div
          className="book-cover"
          style={{
            minHeight: 320,
            background: `linear-gradient(165deg, ${book.coverColor}, #0a0f1f)`,
            fontSize: 22,
            placeItems: 'center',
          }}
        >
          {book.title}
        </div>
      </GlassPanel>

      <GlassPanel style={{ padding: 20 }}>
        <GameHeader title="도서 상세" subtitle="선택된 장서의 서지·상태 정보를 확인합니다." />
        <h2 style={{ fontSize: 30, marginBottom: 6 }}>{book.title}</h2>
        {book.titleEn ? <p className="muted">{book.titleEn}</p> : null}
        <p style={{ marginTop: 10 }}>
          {book.author} · {book.publisher} · {book.year}
        </p>
        <p className="muted" style={{ marginTop: 6 }}>
          ISBN {book.isbn} · 분류 {book.category}
        </p>
        <p style={{ marginTop: 8, color: 'var(--gold)', fontWeight: 800 }}>
          {'★'.repeat(Math.round(book.rating))} {book.rating.toFixed(1)}
        </p>
        <p style={{ marginTop: 16, lineHeight: 1.7 }}>{book.description}</p>
        <div className="chip-row" style={{ marginTop: 14 }}>
          {book.tags.map((tag) => (
            <span key={tag} className="chip active">
              {tag}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
          <GameButton variant="gold" onClick={() => { setPage('shelving'); navigate('/game/shelving') }}>
            서가에 배치
          </GameButton>
          <GameButton variant="ghost" onClick={() => setToast('책 정보 수정 화면은 mock 단계입니다.')}>
            책 정보 수정
          </GameButton>
          <GameButton onClick={toggleBookStatus}>대출 상태 변경</GameButton>
        </div>
      </GlassPanel>

      <GlassPanel style={{ padding: 18 }} strong>
        <h3 style={{ marginBottom: 12 }}>도서 정보</h3>
        <div className="info-list">
          <div>
            <span>페이지</span>
            <strong>{book.pages}p</strong>
          </div>
          <div>
            <span>크기</span>
            <strong>{book.size}</strong>
          </div>
          <div>
            <span>언어</span>
            <strong>{book.language}</strong>
          </div>
          <div>
            <span>상태</span>
            <strong>{book.status}</strong>
          </div>
          <div>
            <span>구입일</span>
            <strong>{book.purchaseDate}</strong>
          </div>
          <div>
            <span>구입처</span>
            <strong>{book.purchaseFrom}</strong>
          </div>
          <div>
            <span>청구기호</span>
            <strong>{book.callNumber ?? '-'}</strong>
          </div>
        </div>
      </GlassPanel>
    </div>
  )
}
