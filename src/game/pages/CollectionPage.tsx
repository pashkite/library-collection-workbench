import { useNavigate } from 'react-router-dom'
import { categoryStats, collectionTarget } from '../data/mockData'
import { GameHeader } from '../components/GameHeader'
import { GlassPanel } from '../components/GlassPanel'
import { useGameStore } from '../store/useGameStore'
import type { BookCategory } from '../types'

const filters: BookCategory[] = ['전체', '문학', '역사', '자연과학', '기술', '예술', '언어', '철학']

export function CollectionPage() {
  const books = useGameStore((s) => s.books)
  const filter = useGameStore((s) => s.collectionFilter)
  const setFilter = useGameStore((s) => s.setCollectionFilter)
  const openBookDetail = useGameStore((s) => s.openBookDetail)
  const navigate = useNavigate()

  const collectedCount = 1248
  const rate = ((collectedCount / collectionTarget) * 100).toFixed(1)
  const visible = books.filter((b) => (filter === '전체' ? true : b.category === filter))

  return (
    <div className="collection-layout page-enter">
      <GlassPanel style={{ padding: 18 }}>
        <GameHeader title="도서 수집" subtitle="카드 그리드로 수집 도감을 탐색합니다." />
        <div className="chip-row" style={{ marginBottom: 14 }}>
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              className={`chip ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="book-grid">
          {visible.map((book) => (
            <button
              key={book.id}
              type="button"
              className="book-card glass"
              onClick={() => {
                openBookDetail(book.id)
                navigate('/game/detail')
              }}
            >
              <div
                className="book-cover"
                style={{ background: `linear-gradient(160deg, ${book.coverColor}, #0b1020)` }}
              >
                {book.title}
              </div>
              <div style={{ marginTop: 10, display: 'grid', gap: 4, textAlign: 'left' }}>
                <strong style={{ fontSize: 13 }}>{book.title}</strong>
                <span className="muted" style={{ fontSize: 12 }}>
                  {'★'.repeat(Math.round(book.rating))} {book.rating.toFixed(1)}
                </span>
                <span className={`badge ${book.collected ? 'ok' : 'muted'}`}>
                  {book.collected ? '수집 완료' : '미수집'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel style={{ padding: 18 }} strong>
        <h3 style={{ marginBottom: 8 }}>수집 현황</h3>
        <div className="donut" data-label={`${rate}%`} />
        <p style={{ textAlign: 'center', fontWeight: 800, marginBottom: 14 }}>
          {collectedCount.toLocaleString()} / {collectionTarget.toLocaleString()}
        </p>
        <p className="muted" style={{ marginBottom: 12 }}>
          분류별 비율
        </p>
        <div className="category-list">
          {categoryStats.map((c) => (
            <div key={c.name}>
              <span>{c.name}</span>
              <div className="bar">
                <span style={{ width: `${c.value * 4}%` }} />
              </div>
              <strong>{c.value}%</strong>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  )
}
