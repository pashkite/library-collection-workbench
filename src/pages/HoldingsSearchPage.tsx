import {
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  Disc3,
  Download,
  Hash,
  Image as ImageIcon,
  Library,
  RotateCcw,
  Search,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BookCover } from '../components/BookCover'
import { ErrorNotice } from '../components/ErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { useAppData } from '../lib/AppDataContext'
import { downloadHoldingsExcel } from '../lib/excel'
import { getAllHoldings, getMaterialTypeLabel, searchHoldings } from '../lib/libraryDb'
import { getHoldingFacetOptions } from '../lib/libraryDbExtras'
import { useBookCovers } from '../lib/useBookCovers'
import type { HoldingSearchFilters, HoldingSearchResult, StoredBookHolding } from '../types/library'
import './HoldingsSearchPage.css'
import './ShelfMultiSelect.css'

const initialFilters: HoldingSearchFilters = {
  title: '',
  author: '',
  publisher: '',
  isbn: '',
  materialType: 'all',
  shelfName: '',
}

export function HoldingsSearchPage() {
  const { data } = useAppData()
  const [filters, setFilters] = useState(initialFilters)
  const [selectedShelfNames, setSelectedShelfNames] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [result, setResult] = useState<HoldingSearchResult>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: 50,
  })
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string>()
  const [facetOptions, setFacetOptions] = useState<{
    shelfNames: string[]
    bookCount: number
    nonbookCount: number
    missingShelfCount: number
  }>({ shelfNames: [], bookCount: 0, nonbookCount: 0, missingShelfCount: 0 })
  const [facetsLoading, setFacetsLoading] = useState(true)

  const totalPages = Math.max(1, Math.ceil(result.total / pageSize))
  const queryFilters = useMemo<HoldingSearchFilters>(
    () => ({ ...filters, shelfNames: selectedShelfNames }),
    [filters, selectedShelfNames],
  )
  const {
    coverLoading,
    coverMessage,
    getCover,
    loadCover,
    loadVisibleCovers,
    markCoverError,
  } = useBookCovers(result.rows, { autoLoadLimit: Math.min(pageSize, 50) })
  const rangeLabel = useMemo(() => {
    if (result.total === 0) return '0건'
    const start = (page - 1) * pageSize + 1
    const end = Math.min(page * pageSize, result.total)
    return `${start.toLocaleString()}-${end.toLocaleString()} / ${result.total.toLocaleString()}건`
  }, [page, pageSize, result.total])
  const shelfSelectionLabel = useMemo(() => {
    if (selectedShelfNames.length === 0) return '전체 자료실'
    if (selectedShelfNames.length === 1) return selectedShelfNames[0]
    if (selectedShelfNames.length === 2) return selectedShelfNames.join(', ')
    return `${selectedShelfNames[0]} 외 ${selectedShelfNames.length - 1}개`
  }, [selectedShelfNames])

  useEffect(() => {
    let canceled = false
    queueMicrotask(() => {
      if (canceled) return
      setLoading(true)
      setError(undefined)
      void searchHoldings(queryFilters, page, pageSize)
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
  }, [queryFilters, page, pageSize])

  useEffect(() => {
    let canceled = false
    setFacetsLoading(true)
    void getHoldingFacetOptions()
      .then((options) => {
        if (!canceled) setFacetOptions(options)
      })
      .finally(() => {
        if (!canceled) setFacetsLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [data.totalCount])

  useEffect(() => {
    const availableShelfNames = new Set(facetOptions.shelfNames)
    setSelectedShelfNames((current) => {
      const next = current.filter((shelfName) => availableShelfNames.has(shelfName))
      return next.length === current.length ? current : next
    })
  }, [facetOptions.shelfNames])

  const updateFilter = <Key extends keyof HoldingSearchFilters>(
    key: Key,
    value: HoldingSearchFilters[Key],
  ) => {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const toggleShelfName = (shelfName: string) => {
    setPage(1)
    setSelectedShelfNames((current) =>
      current.includes(shelfName)
        ? current.filter((selected) => selected !== shelfName)
        : [...current, shelfName],
    )
  }

  const clearShelfNames = () => {
    setPage(1)
    setSelectedShelfNames([])
  }

  const hasActiveFilter =
    selectedShelfNames.length > 0 ||
    (Object.keys(initialFilters) as Array<keyof HoldingSearchFilters>).some(
      (key) => filters[key] !== initialFilters[key],
    )

  const resetFilters = () => {
    setPage(1)
    setFilters(initialFilters)
    setSelectedShelfNames([])
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
      const rows = await searchHoldings(queryFilters, 1, Math.max(result.total, 1))
      await downloadHoldingsExcel(
        rows.rows,
        `달성군립도서관_소장목록_검색결과_${data.meta?.baseDate ?? 'unknown'}.xlsx`,
        data.meta,
      )
    } finally {
      setExporting(false)
    }
  }

  const renderCover = (row: StoredBookHolding, size: 'md' | 'lg' = 'md') => {
    return (
      <BookCover
        book={row}
        cover={getCover(row)}
        size={size}
        onLoad={(book) => void loadCover(book)}
        onImageError={(book) => markCoverError(book)}
      />
    )
  }

  const activeChips = useMemo(() => {
    const chips: string[] = []
    if (filters.materialType === 'book') chips.push('도서자료')
    if (filters.materialType === 'nonbook') chips.push('비도서자료')
    selectedShelfNames.forEach((shelfName) => chips.push(`자료실: ${shelfName}`))
    if (filters.title.trim()) chips.push(`서명: ${filters.title.trim()}`)
    if (filters.author.trim()) chips.push(`저자: ${filters.author.trim()}`)
    if (filters.publisher.trim()) chips.push(`출판사: ${filters.publisher.trim()}`)
    if (filters.isbn.trim()) chips.push(`ISBN: ${filters.isbn.trim()}`)
    return chips
  }, [filters, selectedShelfNames])

  return (
    <div className="page-stack holdings-page">
      <PageHeader
        title="소장도서 조회"
        description="저장된 소장목록에서 서명·저자·ISBN·여러 자료실 조건으로 바로 찾아보고, 필요한 목록만 엑셀로 내려받습니다."
        eyebrow="Catalog Search"
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

      <section className="holdings-stats" aria-label="소장 현황 요약">
        <article>
          <span>전체 소장</span>
          <strong>{data.totalCount.toLocaleString()}</strong>
          <small>IndexedDB 기준</small>
        </article>
        <article>
          <span>도서자료</span>
          <strong>{facetsLoading ? '…' : facetOptions.bookCount.toLocaleString()}</strong>
          <small>단행본 중심</small>
        </article>
        <article>
          <span>비도서자료</span>
          <strong>{facetsLoading ? '…' : facetOptions.nonbookCount.toLocaleString()}</strong>
          <small>DVD · 디지털 등</small>
        </article>
        <article className={hasActiveFilter ? 'is-active' : undefined}>
          <span>현재 검색</span>
          <strong>{loading ? '…' : result.total.toLocaleString()}</strong>
          <small>{hasActiveFilter ? '필터 적용됨' : '전체 보기'}</small>
        </article>
      </section>

      <section className="panel holdings-filter">
        <div className="filter-header">
          <div>
            <strong>검색 조건</strong>
            <span>입력하면 바로 반영됩니다. 조건을 조합해 좁혀보세요.</span>
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

        <div className="holdings-search-grid">
          <label className="field-card">
            <span className="field-label">
              <Library size={14} aria-hidden="true" />
              자료구분
            </span>
            <select
              value={filters.materialType}
              onChange={(event) =>
                updateFilter('materialType', event.target.value as HoldingSearchFilters['materialType'])
              }
            >
              <option value="all">전체</option>
              <option value="book">도서자료</option>
              <option value="nonbook">비도서자료</option>
            </select>
          </label>

          <div className="field-card shelf-filter-card">
            <span className="field-label">
              <Building2 size={14} aria-hidden="true" />
              자료실 (복수 선택)
            </span>
            {facetOptions.shelfNames.length > 0 ? (
              <details className="shelf-multi-select">
                <summary aria-label={`자료실 선택: ${shelfSelectionLabel}`}>
                  <span className="shelf-multi-value">{shelfSelectionLabel}</span>
                  {selectedShelfNames.length > 0 ? (
                    <span className="shelf-multi-count">{selectedShelfNames.length}개</span>
                  ) : null}
                  <ChevronDown size={16} aria-hidden="true" />
                </summary>
                <div className="shelf-multi-panel">
                  <div className="shelf-multi-header">
                    <strong>자료실 선택</strong>
                    <button
                      type="button"
                      className="shelf-clear-button"
                      onClick={clearShelfNames}
                      disabled={selectedShelfNames.length === 0}
                    >
                      전체 자료실
                    </button>
                  </div>
                  <div className="shelf-multi-options">
                    {facetOptions.shelfNames.map((shelfName) => (
                      <label key={shelfName} className="shelf-multi-option">
                        <input
                          type="checkbox"
                          checked={selectedShelfNames.includes(shelfName)}
                          onChange={() => toggleShelfName(shelfName)}
                        />
                        <span>{shelfName}</span>
                      </label>
                    ))}
                  </div>
                  <p id="shelf-multi-help">
                    여러 자료실을 선택하면 선택한 곳 중 하나라도 일치하는 자료를 모두 표시합니다.
                  </p>
                </div>
              </details>
            ) : (
              <div className="shelf-multi-empty">자료실 정보 없음</div>
            )}
          </div>

          <label className="field-card field-span-2">
            <span className="field-label">
              <BookOpen size={14} aria-hidden="true" />
              도서명
            </span>
            <input
              value={filters.title}
              onChange={(event) => updateFilter('title', event.target.value)}
              placeholder="서명 일부 입력"
            />
          </label>

          <label className="field-card">
            <span className="field-label">
              <UserRound size={14} aria-hidden="true" />
              저자
            </span>
            <input
              value={filters.author}
              onChange={(event) => updateFilter('author', event.target.value)}
              placeholder="저자명"
            />
          </label>

          <label className="field-card">
            <span className="field-label">
              <Building2 size={14} aria-hidden="true" />
              출판사
            </span>
            <input
              value={filters.publisher}
              onChange={(event) => updateFilter('publisher', event.target.value)}
              placeholder="출판사"
            />
          </label>

          <label className="field-card">
            <span className="field-label">
              <Hash size={14} aria-hidden="true" />
              ISBN
            </span>
            <input
              value={filters.isbn}
              onChange={(event) => updateFilter('isbn', event.target.value)}
              placeholder="ISBN"
            />
          </label>
        </div>

        {activeChips.length > 0 ? (
          <div className="active-filter-row" aria-label="적용된 검색 조건">
            {activeChips.map((chip) => (
              <span key={chip} className="filter-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        {facetOptions.missingShelfCount > 0 ? (
          <p className="filter-note">
            현재 소장목록 {facetOptions.missingShelfCount.toLocaleString()}건에 자료실 값이 없어 자료실
            필터가 제한됩니다. 자료구분은 DVD/CD, 디지털자료실, 영상자료 등 비도서 단서를 기준으로
            분리합니다.
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

      <section className="panel holdings-results">
        <div className="results-toolbar">
          <div className="results-summary">
            <p className="results-kicker">Search Results</p>
            <div className="results-title-row">
              <strong>{loading ? '검색 중...' : `총 ${result.total.toLocaleString()}건`}</strong>
              <span className="results-range">{rangeLabel}</span>
            </div>
            <div className="results-status">
              {exporting ? <span className="status-pill">엑셀 생성 중</span> : null}
              {coverLoading ? <span className="status-pill">표지 조회 중</span> : null}
              {coverMessage ? <span className="status-pill is-muted">{coverMessage}</span> : null}
            </div>
          </div>

          <div className="results-actions">
            <div className="view-toggle" role="group" aria-label="보기 방식">
              <button
                type="button"
                className={viewMode === 'cards' ? 'is-active' : undefined}
                onClick={() => setViewMode('cards')}
              >
                카드
              </button>
              <button
                type="button"
                className={viewMode === 'table' ? 'is-active' : undefined}
                onClick={() => setViewMode('table')}
              >
                표
              </button>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadVisibleCovers()}
              disabled={coverLoading || result.rows.length === 0}
            >
              <ImageIcon size={16} aria-hidden="true" />
              현재 페이지 표지
            </button>

            <label className="page-size-field">
              보기
              <select
                value={pageSize}
                onChange={(event) => {
                  setPage(1)
                  setPageSize(Number(event.target.value))
                }}
              >
                <option value={25}>25건</option>
                <option value={50}>50건</option>
                <option value={100}>100건</option>
                <option value={200}>200건</option>
              </select>
            </label>
          </div>
        </div>

        {viewMode === 'cards' ? (
          <div className={`holdings-card-list${loading ? ' is-loading' : ''}`}>
            {result.rows.map((row) => {
              const material = getMaterialTypeLabel(row)
              const isNonbook = material.includes('비도서')
              return (
                <article key={row.id} className="holding-card">
                  <div className="holding-cover">{renderCover(row, 'lg')}</div>
                  <div className="holding-body">
                    <div className="holding-top">
                      <div className="holding-heading">
                        <h3>{row.title || '제목 없음'}</h3>
                        <p>
                          {[row.author, row.publisher, row.publicationYear].filter(Boolean).join(' · ') ||
                            '서지정보 없음'}
                        </p>
                      </div>
                      <span className={`material-badge${isNonbook ? ' is-media' : ''}`}>
                        {isNonbook ? <Disc3 size={13} aria-hidden="true" /> : <BookOpen size={13} aria-hidden="true" />}
                        {material}
                      </span>
                    </div>

                    <div className="holding-meta-grid">
                      <div>
                        <span>ISBN</span>
                        <strong>{row.isbn || '-'}</strong>
                      </div>
                      <div>
                        <span>KDC</span>
                        <strong>{row.kdc || '-'}</strong>
                      </div>
                      <div>
                        <span>청구기호</span>
                        <strong>{row.callNumber || '-'}</strong>
                      </div>
                      <div>
                        <span>배가명</span>
                        <strong>{row.shelfName || '-'}</strong>
                      </div>
                      <div>
                        <span>
                          <CalendarDays size={12} aria-hidden="true" /> 등록일
                        </span>
                        <strong>{row.registeredAt || '-'}</strong>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}

            {!loading && result.rows.length === 0 ? (
              <div className="holdings-empty">
                <Search size={22} aria-hidden="true" />
                <strong>검색 결과가 없습니다</strong>
                <p>조건을 조금 넓히거나 다른 키워드로 다시 검색해 보세요.</p>
              </div>
            ) : null}

            {loading && result.rows.length === 0
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="holding-card is-skeleton" aria-hidden="true">
                    <div className="holding-cover skeleton-block" />
                    <div className="holding-body">
                      <div className="skeleton-line w-70" />
                      <div className="skeleton-line w-45" />
                      <div className="skeleton-line w-90" />
                    </div>
                  </div>
                ))
              : null}
          </div>
        ) : (
          <>
            <p className="table-hint">표가 화면보다 넓으면 좌우로 스크롤해서 모든 열을 확인할 수 있습니다.</p>
            <div className="table-scroll holdings-table-wrap">
              <table className="holdings-table">
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
                  {result.rows.map((row) => {
                    const material = getMaterialTypeLabel(row)
                    const isNonbook = material.includes('비도서')
                    return (
                      <tr key={row.id}>
                        <td className="cover-cell">{renderCover(row, 'md')}</td>
                        <td>
                          <div className="table-title-cell">
                            <strong>{row.title}</strong>
                            <span>
                              {[row.author, row.publicationYear].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                        </td>
                        <td>{row.author}</td>
                        <td>{row.publisher}</td>
                        <td>{row.publicationYear}</td>
                        <td className="mono-cell">{row.isbn}</td>
                        <td>
                          <span className={`material-badge compact${isNonbook ? ' is-media' : ''}`}>
                            {material}
                          </span>
                        </td>
                        <td>{row.kdc}</td>
                        <td>{row.callNumber}</td>
                        <td>{row.shelfName}</td>
                        <td>{row.registeredAt}</td>
                      </tr>
                    )
                  })}
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
          </>
        )}

        <div className="pagination holdings-pagination">
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
