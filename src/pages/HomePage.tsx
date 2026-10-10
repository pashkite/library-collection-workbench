import { BookOpen, Download, LayoutGrid, List, Search, X } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookDetailsDrawer } from '../components/BookDetailsDrawer'
import { useAppData } from '../lib/AppDataContext'
import { downloadHoldingsExcel } from '../lib/excel'
import { searchHoldings } from '../lib/libraryDb'
import { useBookCovers } from '../lib/useBookCovers'
import { kdcCollections } from '../lib/kdcCollections'
import type { HoldingSearchFilters, HoldingSearchResult, StoredBookHolding } from '../types/library'

const emptyResult: HoldingSearchResult = { rows: [], total: 0, page: 1, pageSize: 30 }

export function HomePage() {
  const { data } = useAppData()
  const [params, setParams] = useSearchParams()
  const query = useDeferredValue(params.get('q') ?? '')
  const kdc = params.get('kdc') ?? ''
  const view = params.get('view') === 'list' ? 'list' : 'grid'
  const requestedPage = Number(params.get('page'))
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1
  const [result, setResult] = useState(emptyResult)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState<StoredBookHolding>()
  const { getCover, markCoverError } = useBookCovers(result.rows, { autoLoadLimit: 30 })
  const category = kdcCollections.find((item) => item.id === kdc)

  useEffect(() => {
    let canceled = false
    setLoading(true)
    setError('')
    const filters: HoldingSearchFilters = {
      title: '', author: '', publisher: '', isbn: '', materialType: 'all', shelfName: '',
      keyword: query, kdcMajor: kdc,
    }
    void searchHoldings(filters, page, 30).then((next) => {
      if (!canceled) setResult(next)
    }).catch((reason: unknown) => {
      if (!canceled) setError(reason instanceof Error ? reason.message : '목록을 불러오지 못했습니다.')
    }).finally(() => { if (!canceled) setLoading(false) })
    return () => { canceled = true }
  }, [query, kdc, page, data.totalCount])

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  async function exportResults() {
    setExporting(true)
    try {
      const all = await searchHoldings({ title: '', author: '', publisher: '', isbn: '', materialType: 'all', shelfName: '', keyword: query, kdcMajor: kdc }, 1, Math.max(result.total, 1))
      await downloadHoldingsExcel(all.rows, `소장목록_${data.meta?.baseDate ?? '검색결과'}.xlsx`, data.meta)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '엑셀을 저장하지 못했습니다.')
    } finally { setExporting(false) }
  }

  function cover(book: StoredBookHolding) {
    const image = getCover(book)
    const colorIndex = Number(book.kdc.trim().charAt(0)) || 0
    return image?.status === 'loaded'
      ? <img className="collection-cover-image" src={image.coverUrl} alt={`${book.title} 표지`} loading="lazy" onError={() => markCoverError(book)} />
      : <div className={`collection-cover-fallback cover-tone-${colorIndex}`}><span>{book.kdc || 'COLLECTION'}</span><strong>{book.title || '제목 없음'}</strong><div><span>{book.author || '저자 미상'}</span><BookOpen size={20} aria-hidden="true" /></div></div>
  }

  return <div className="collection-page">
    <div className="collection-heading">
      <div><h1>{category ? `${category.name} 도서` : '전체 소장도서'}</h1><p>{loading ? '목록을 불러오는 중입니다.' : `${result.total.toLocaleString()}권의 자료${query ? ` · “${query}” 검색 결과` : '를 살펴보세요.'}`}</p></div>
      <div className="collection-heading-actions">
        <div className="collection-view-toggle" role="group" aria-label="보기 방식">
          <button aria-label="격자 보기" aria-pressed={view === 'grid'} onClick={() => updateParam('view', 'grid')}><LayoutGrid size={17} /></button>
          <button aria-label="목록 보기" aria-pressed={view === 'list'} onClick={() => updateParam('view', 'list')}><List size={17} /></button>
        </div>
        <button className="secondary-button" disabled={exporting || loading || result.total === 0} onClick={() => void exportResults()}><Download size={15} />{exporting ? '저장 중' : '엑셀 저장'}</button>
      </div>
    </div>
    {query || category ? <div className="collection-filters"><span>{category?.name ?? '전체 분류'}{query ? ` · ${query}` : ''}</span><Link to={`/?view=${view}`}><X size={13} />조건 해제</Link></div> : null}
    {error ? <div className="status-message is-error" role="alert">{error}</div> : null}
    {!loading && !error && result.total === 0 ? <div className="collection-empty"><Search size={32} /><h2>검색 결과가 없습니다</h2><p>다른 검색어를 입력하거나 분류 조건을 해제해 보세요.</p><Link to="/">전체 도서 보기</Link></div> : null}
    <div aria-busy={loading} className={`collection-${view}`}>
      {loading ? Array.from({length: 12}, (_, index) => <div key={index} className="collection-skeleton" aria-hidden="true" />) : view === 'grid' ? result.rows.map((book) => <article className="collection-book" key={book.id}>
        <button className="collection-cover" onClick={() => setSelected(book)} aria-label={`${book.title} 상세정보`}>{cover(book)}</button>
        <button className="collection-book-title" onClick={() => setSelected(book)}>{book.title || '제목 없음'}</button>
        <p>{book.author || '저자 미상'}</p><span className="collection-book-category">{book.kdc || '미분류'} · {book.publisher || '출판사 미상'}</span>
      </article>) : <div className="table-scroll"><table className="collection-table"><thead><tr><th>도서명</th><th>저자</th><th>출판사</th><th>KDC</th><th>청구기호</th></tr></thead><tbody>{result.rows.map((book) => <tr key={book.id}><td><button onClick={() => setSelected(book)}>{book.title || '제목 없음'}</button></td><td>{book.author || '-'}</td><td>{book.publisher || '-'}</td><td>{book.kdc || '-'}</td><td>{book.callNumber || '-'}</td></tr>)}</tbody></table></div>}
    </div>
    <div className="collection-bottom"><p>표지 이미지는 알라딘 연동 시 표시됩니다. 이미지가 없으면 서지정보로 표시합니다.</p><div className="pagination"><button disabled={loading || page <= 1} onClick={() => updateParam('page', String(page - 1))}>이전</button><span>{page} / {Math.max(1, Math.ceil(result.total / 30))}</span><button disabled={loading || page * 30 >= result.total} onClick={() => updateParam('page', String(page + 1))}>다음</button></div></div>
    {selected ? <BookDetailsDrawer book={selected} cover={getCover(selected)} onImageError={() => markCoverError(selected)} onClose={() => setSelected(undefined)} /> : null}
  </div>
}
