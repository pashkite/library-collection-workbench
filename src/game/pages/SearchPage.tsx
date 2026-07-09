import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameButton } from '../components/GameButton'
import { GameHeader } from '../components/GameHeader'
import { GlassPanel } from '../components/GlassPanel'
import { useGameStore } from '../store/useGameStore'

const fields = [
  { id: 'all', label: '전체' },
  { id: 'title', label: '제목' },
  { id: 'author', label: '저자' },
  { id: 'publisher', label: '출판사' },
  { id: 'isbn', label: 'ISBN' },
  { id: 'tag', label: '주제어' },
] as const

const PAGE_SIZE = 4

export function SearchPage() {
  const books = useGameStore((s) => s.books)
  const query = useGameStore((s) => s.searchQuery)
  const field = useGameStore((s) => s.searchField)
  const page = useGameStore((s) => s.searchPage)
  const setQuery = useGameStore((s) => s.setSearchQuery)
  const setField = useGameStore((s) => s.setSearchField)
  const setPage = useGameStore((s) => s.setSearchPage)
  const openBookDetail = useGameStore((s) => s.openBookDetail)
  const navigate = useNavigate()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return books
    return books.filter((b) => {
      if (field === 'title') return b.title.toLowerCase().includes(q) || (b.titleEn ?? '').toLowerCase().includes(q)
      if (field === 'author') return b.author.toLowerCase().includes(q)
      if (field === 'publisher') return b.publisher.toLowerCase().includes(q)
      if (field === 'isbn') return b.isbn.includes(q)
      if (field === 'tag') return b.tags.some((t) => t.toLowerCase().includes(q))
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.publisher.toLowerCase().includes(q) ||
        b.isbn.includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [books, query, field])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="search-layout page-enter">
      <GlassPanel style={{ padding: 16 }}>
        <GameHeader title="도서 검색" subtitle="필터와 키워드로 후보를 좁힙니다." />
        <div className="stack">
          {fields.map((f) => (
            <button key={f.id} type="button" className={`tab ${field === f.id ? 'active' : ''}`} onClick={() => setField(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel style={{ padding: 16 }}>
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="search-q">검색어</label>
          <input
            id="search-q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목, 저자, ISBN, 주제어..."
          />
        </div>

        <div className="result-list">
          {rows.map((book) => (
            <article key={book.id} className="result-item glass">
              <div className="book-cover" style={{ background: book.coverColor, minHeight: 72, aspectRatio: '3/4' }}>
                {book.title.slice(0, 4)}
              </div>
              <div>
                <strong>{book.title}</strong>
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {book.author} · {book.publisher} · {book.year}
                </p>
                <p className="muted" style={{ fontSize: 12 }}>
                  ISBN {book.isbn}
                </p>
                <span className="badge info" style={{ marginTop: 6 }}>
                  {book.status}
                </span>
              </div>
              <GameButton onClick={() => { openBookDetail(book.id); navigate('/game/detail') }}>상세 보기</GameButton>
            </article>
          ))}
          {rows.length === 0 ? <p className="muted">검색 결과가 없습니다.</p> : null}
        </div>

        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" className={p === safePage ? 'active' : undefined} onClick={() => setPage(p)}>
              {p}
            </button>
          ))}
        </div>
      </GlassPanel>
    </div>
  )
}
