import { Download, RotateCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ErrorNotice } from '../components/ErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { useAppData } from '../lib/AppDataContext'
import { downloadHoldingsExcel } from '../lib/excel'
import { getAllHoldings, searchHoldings } from '../lib/libraryDb'
import type { HoldingSearchFilters, HoldingSearchResult } from '../types/library'

const initialFilters: HoldingSearchFilters = {
  title: '',
  author: '',
  publisher: '',
  isbn: '',
}

export function HoldingsSearchPage() {
  const { data } = useAppData()
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [result, setResult] = useState<HoldingSearchResult>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: 100,
  })
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string>()

  const totalPages = Math.max(1, Math.ceil(result.total / pageSize))
  const rangeLabel = useMemo(() => {
    if (result.total === 0) return '0건'
    const start = (page - 1) * pageSize + 1
    const end = Math.min(page * pageSize, result.total)
    return `${start.toLocaleString()}-${end.toLocaleString()} / ${result.total.toLocaleString()}건`
  }, [page, pageSize, result.total])

  useEffect(() => {
    let canceled = false
    queueMicrotask(() => {
      if (canceled) return
      setLoading(true)
      setError(undefined)
      void searchHoldings(filters, page, pageSize)
        .then((nextResult) => {
          if (!canceled) setResult(nextResult)
        })
        .catch((searchError) => {
          if (!canceled) {
            setError(
              searchError instanceof Error
                ? searchError.message
                : '소장도서 검색 중 오류가 발생했습니다.',
            )
          }
        })
        .finally(() => {
          if (!canceled) setLoading(false)
        })
    })
    return () => {
      canceled = true
    }
  }, [filters, page, pageSize])

  const updateFilter = (key: keyof HoldingSearchFilters, value: string) => {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const hasActiveFilter = Object.values(filters).some(Boolean)

  const resetFilters = () => {
    setPage(1)
    setFilters(initialFilters)
  }

  const exportAll = async () => {
    setExporting(true)
    try {
      const rows = await getAllHoldings()
      downloadHoldingsExcel(
        rows,
        `달성군립도서관_소장목록_${data.meta?.baseDate ?? 'unknown'}.xlsx`,
        data.meta,
      )
    } finally {
      setExporting(false)
    }
  }

  const exportCurrent = async () => {
    setExporting(true)
    try {
      const rows = await searchHoldings(filters, 1, Math.max(result.total, 1))
      downloadHoldingsExcel(
        rows.rows,
        `달성군립도서관_소장목록_검색결과_${data.meta?.baseDate ?? 'unknown'}.xlsx`,
        data.meta,
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="소장도서 조회"
        description="검색은 IndexedDB에 저장된 소장목록을 기준으로 수행합니다."
        actions={
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => void exportAll()}>
              <Download size={16} aria-hidden="true" />
              전체 엑셀
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void exportCurrent()}
              disabled={result.total === 0}
            >
              <Download size={16} aria-hidden="true" />
              검색 결과 엑셀
            </button>
          </div>
        }
      />

      <section className="panel">
        <div className="filter-header">
          <div>
            <strong>검색 조건</strong>
            <span>입력하면 저장된 소장목록에서 바로 검색합니다.</span>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={resetFilters}
            disabled={!hasActiveFilter}
          >
            <RotateCcw size={16} aria-hidden="true" />
            조건 초기화
          </button>
        </div>
        <div className="search-grid">
          <label>
            도서명
            <input value={filters.title} onChange={(event) => updateFilter('title', event.target.value)} />
          </label>
          <label>
            저자
            <input value={filters.author} onChange={(event) => updateFilter('author', event.target.value)} />
          </label>
          <label>
            출판사
            <input
              value={filters.publisher}
              onChange={(event) => updateFilter('publisher', event.target.value)}
            />
          </label>
          <label>
            ISBN
            <input value={filters.isbn} onChange={(event) => updateFilter('isbn', event.target.value)} />
          </label>
        </div>
      </section>

      {error ? (
        <ErrorNotice
          title="검색 오류"
          cause={error}
          action="검색 조건을 줄이거나 소장목록 캐시 상태를 확인하세요."
        />
      ) : null}

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div>
            <strong>{loading ? '검색 중...' : `총 ${result.total.toLocaleString()}건`}</strong>
            <span>{rangeLabel}</span>
            {exporting ? <span>엑셀 생성 중...</span> : null}
          </div>
          <label>
            보기
            <select
              value={pageSize}
              onChange={(event) => {
                setPage(1)
                setPageSize(Number(event.target.value))
              }}
            >
              <option value={50}>50건</option>
              <option value={100}>100건</option>
              <option value={200}>200건</option>
            </select>
          </label>
        </div>
        <p className="table-hint">표가 화면보다 넓으면 좌우로 스크롤해서 모든 열을 확인할 수 있습니다.</p>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>도서명</th>
                <th>저자</th>
                <th>출판사</th>
                <th>출판연도</th>
                <th>ISBN</th>
                <th>KDC</th>
                <th>청구기호</th>
                <th>배가명</th>
                <th>등록일</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.author}</td>
                  <td>{row.publisher}</td>
                  <td>{row.publicationYear}</td>
                  <td>{row.isbn}</td>
                  <td>{row.kdc}</td>
                  <td>{row.callNumber}</td>
                  <td>{row.shelfName}</td>
                  <td>{row.registeredAt}</td>
                </tr>
              ))}
              {!loading && result.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    <Search size={18} aria-hidden="true" />
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
            이전
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page >= totalPages}
          >
            다음
          </button>
        </div>
      </section>
    </div>
  )
}
