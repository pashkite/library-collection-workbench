import { BookOpen, Download, Image as ImageIcon, RotateCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ErrorNotice } from '../components/ErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { useAppData } from '../lib/AppDataContext'
import { getCachedAladinDetail, lookupAladinDetail } from '../lib/aladin'
import { downloadHoldingsExcel } from '../lib/excel'
import { getAllHoldings, getHoldingFacetOptions, getMaterialTypeLabel, searchHoldings } from '../lib/libraryDb'
import type { HoldingSearchFilters, HoldingSearchResult, StoredBookHolding } from '../types/library'
import { normalizeIsbn } from '../utils/normalize'

const initialFilters: HoldingSearchFilters = {
  title: '',
  author: '',
  publisher: '',
  isbn: '',
  materialType: 'book',
  shelfName: '',
}

type CoverState =
  | { status: 'loading' }
  | { status: 'loaded'; coverUrl: string; title: string }
  | { status: 'missing'; message: string }
  | { status: 'error'; message: string }

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
  const [coverLoading, setCoverLoading] = useState(false)
  const [coverMessage, setCoverMessage] = useState<string>()
  const [coverByIsbn, setCoverByIsbn] = useState<Record<string, CoverState>>({})
  const [facetOptions, setFacetOptions] = useState<{
    shelfNames: string[]
    bookCount: number
    nonbookCount: number
    missingShelfCount: number
  }>({ shelfNames: [], bookCount: 0, nonbookCount: 0, missingShelfCount: 0 })

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

  useEffect(() => {
    let canceled = false
    void getHoldingFacetOptions().then((options) => {
      if (!canceled) setFacetOptions(options)
    })
    return () => {
      canceled = true
    }
  }, [data.totalCount])

  useEffect(() => {
    const cachedCovers = Object.fromEntries(
      result.rows
        .map((row) => {
          const key = normalizeIsbn(row.isbn)
          const cached = key ? getCachedAladinDetail(key) : undefined
          return cached?.coverUrl ? [key, { status: 'loaded', coverUrl: cached.coverUrl, title: cached.title }] : undefined
        })
        .filter(Boolean) as Array<[string, CoverState]>,
    )
    if (Object.keys(cachedCovers).length > 0) {
      setCoverByIsbn((current) => ({ ...current, ...cachedCovers }))
    }
  }, [result.rows])

  const updateFilter = <Key extends keyof HoldingSearchFilters>(
    key: Key,
    value: HoldingSearchFilters[Key],
  ) => {
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
      await downloadHoldingsExcel(
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
      await downloadHoldingsExcel(
        rows.rows,
        `달성군립도서관_소장목록_검색결과_${data.meta?.baseDate ?? 'unknown'}.xlsx`,
        data.meta,
      )
    } finally {
      setExporting(false)
    }
  }

  const loadCover = async (row: StoredBookHolding) => {
    const key = normalizeIsbn(row.isbn)
    if (!key) return
    setCoverByIsbn((current) => ({ ...current, [key]: { status: 'loading' } }))
    try {
      const detail = await lookupAladinDetail(key)
      setCoverByIsbn((current) => ({
        ...current,
        [key]: detail.coverUrl
          ? { status: 'loaded', coverUrl: detail.coverUrl, title: detail.title || row.title }
          : { status: 'missing', message: '표지 없음' },
      }))
    } catch (coverError) {
      setCoverByIsbn((current) => ({
        ...current,
        [key]: {
          status: 'error',
          message: coverError instanceof Error ? coverError.message : '표지 조회 실패',
        },
      }))
    }
  }

  const loadVisibleCovers = async () => {
    const targets = result.rows
      .filter((row) => normalizeIsbn(row.isbn))
      .filter((row) => coverByIsbn[normalizeIsbn(row.isbn)]?.status !== 'loaded')
    if (targets.length === 0) {
      setCoverMessage('현재 페이지에서 새로 불러올 표지가 없습니다.')
      return
    }

    setCoverLoading(true)
    setCoverMessage(undefined)
    try {
      const batchSize = 6
      for (let index = 0; index < targets.length; index += batchSize) {
        const batch = targets.slice(index, index + batchSize)
        await Promise.allSettled(batch.map((row) => loadCover(row)))
      }
      setCoverMessage(`현재 페이지 표지 ${targets.length.toLocaleString()}건을 확인했습니다.`)
    } finally {
      setCoverLoading(false)
    }
  }

  const renderCover = (row: StoredBookHolding) => {
    const key = normalizeIsbn(row.isbn)
    const cover = key ? coverByIsbn[key] : undefined
    if (cover?.status === 'loaded') {
      return (
        <img
          className="cover-thumb"
          src={cover.coverUrl}
          alt={`${cover.title} 표지`}
          loading="lazy"
          onError={() =>
            setCoverByIsbn((current) => ({
              ...current,
              [key]: { status: 'error', message: '이미지 로딩 실패' },
            }))
          }
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
      <button type="button" className="cover-button" onClick={() => void loadCover(row)} title={cover?.message}>
        <BookOpen size={16} aria-hidden="true" />
        {cover?.status === 'error' ? '재시도' : '표지'}
      </button>
    )
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
            자료구분
            <select
              value={filters.materialType}
              onChange={(event) =>
                updateFilter('materialType', event.target.value as HoldingSearchFilters['materialType'])
              }
            >
              <option value="book">도서자료 기본</option>
              <option value="nonbook">비도서자료</option>
              <option value="all">전체</option>
            </select>
          </label>
          <label>
            자료실
            <select
              value={filters.shelfName}
              onChange={(event) => updateFilter('shelfName', event.target.value)}
              disabled={facetOptions.shelfNames.length === 0}
            >
              <option value="">
                {facetOptions.shelfNames.length === 0 ? '자료실 정보 없음' : '전체 자료실'}
              </option>
              {facetOptions.shelfNames.map((shelfName) => (
                <option key={shelfName} value={shelfName}>
                  {shelfName}
                </option>
              ))}
            </select>
          </label>
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
        {facetOptions.missingShelfCount > 0 ? (
          <p className="filter-note">
            현재 소장목록 {facetOptions.missingShelfCount.toLocaleString()}건에 자료실 값이 없어 자료실 필터가 제한됩니다.
            자료구분은 도서자료를 기본으로 보고, DVD/CD 등 비도서 단서가 있는 자료만 비도서자료로 분리합니다.
          </p>
        ) : null}
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
            {coverLoading ? <span>표지 조회 중...</span> : null}
            {coverMessage ? <span>{coverMessage}</span> : null}
          </div>
          <div className="table-toolbar-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadVisibleCovers()}
              disabled={coverLoading || result.rows.length === 0}
            >
              <ImageIcon size={16} aria-hidden="true" />
              현재 페이지 표지
            </button>
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
        </div>
        <p className="table-hint">표가 화면보다 넓으면 좌우로 스크롤해서 모든 열을 확인할 수 있습니다.</p>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>표지</th>
                <th>도서명</th>
                <th>저자</th>
                <th>출판사</th>
                <th>출판연도</th>
                <th>ISBN</th>
                <th>자료구분</th>
                <th>KDC</th>
                <th>청구기호</th>
                <th>배가명</th>
                <th>등록일</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td className="cover-cell">{renderCover(row)}</td>
                  <td>{row.title}</td>
                  <td>{row.author}</td>
                  <td>{row.publisher}</td>
                  <td>{row.publicationYear}</td>
                  <td>{row.isbn}</td>
                  <td>{getMaterialTypeLabel(row)}</td>
                  <td>{row.kdc}</td>
                  <td>{row.callNumber}</td>
                  <td>{row.shelfName}</td>
                  <td>{row.registeredAt}</td>
                </tr>
              ))}
              {!loading && result.rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-cell">
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
