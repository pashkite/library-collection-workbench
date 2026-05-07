import { Download, RotateCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ErrorNotice } from '../components/ErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { downloadHoldingsExcel } from '../lib/excel'
import { getHoldingFacetOptions, getMaterialTypeLabel, searchNewReleases } from '../lib/libraryDb'
import { useAppData } from '../lib/AppDataContext'
import type { NewReleaseFilters, NewReleaseSearchResult } from '../types/library'

const kdcMajorItems = [
  { code: '0', name: '총류' },
  { code: '1', name: '철학' },
  { code: '2', name: '종교' },
  { code: '3', name: '사회과학' },
  { code: '4', name: '자연과학' },
  { code: '5', name: '기술과학' },
  { code: '6', name: '예술' },
  { code: '7', name: '언어' },
  { code: '8', name: '문학' },
  { code: '9', name: '역사' },
]

const initialFilters: NewReleaseFilters = {
  title: '',
  author: '',
  publisher: '',
  isbn: '',
  materialType: 'book',
  shelfName: '',
  datePreset: '90',
  kdcMajor: '',
  publicationYearFrom: '',
  includeUndated: true,
}

export function NewReleasesPage() {
  const { data } = useAppData()
  const [filters, setFilters] = useState<NewReleaseFilters>(initialFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [result, setResult] = useState<NewReleaseSearchResult>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: 100,
    undatedCount: 0,
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
      void searchNewReleases(filters, page, pageSize, data.meta?.baseDate)
        .then((nextResult) => {
          if (!canceled) setResult(nextResult)
        })
        .catch((searchError) => {
          if (!canceled) {
            setError(
              searchError instanceof Error
                ? searchError.message
                : '신간도서 조회 중 오류가 발생했습니다.',
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
  }, [data.meta?.baseDate, filters, page, pageSize])

  useEffect(() => {
    let canceled = false
    void getHoldingFacetOptions().then((options) => {
      if (!canceled) setFacetOptions(options)
    })
    return () => {
      canceled = true
    }
  }, [data.totalCount])

  const updateFilter = <Key extends keyof NewReleaseFilters>(
    key: Key,
    value: NewReleaseFilters[Key],
  ) => {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const exportCurrent = async () => {
    setExporting(true)
    try {
      const rows = await searchNewReleases(
        filters,
        1,
        Math.max(result.total, 1),
        data.meta?.baseDate,
      )
      await downloadHoldingsExcel(
        rows.rows,
        `신간도서_조회결과_${data.meta?.baseDate ?? 'unknown'}.xlsx`,
        data.meta,
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="신간도서 조회"
        description="등록일, 발행연도, KDC 대분류, 서지 조건으로 최근 소장자료를 좁혀 봅니다."
        actions={
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => setFilters(initialFilters)}>
              <RotateCcw size={16} aria-hidden="true" />
              조건 초기화
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void exportCurrent()}
              disabled={result.total === 0}
            >
              <Download size={16} aria-hidden="true" />
              결과 엑셀
            </button>
          </div>
        }
      />

      <section className="panel">
        <div className="filter-header">
          <div>
            <strong>조회 조건</strong>
            <span>등록일이 없는 자료는 옵션에 따라 포함하고, 발행연도로 한 번 더 좁힐 수 있습니다.</span>
          </div>
          {exporting ? <span className="warning-chip">엑셀 생성 중...</span> : null}
        </div>
        <div className="search-grid extended">
          <label>
            자료구분
            <select
              value={filters.materialType}
              onChange={(event) =>
                updateFilter('materialType', event.target.value as NewReleaseFilters['materialType'])
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
            기간
            <select
              value={filters.datePreset}
              onChange={(event) =>
                updateFilter('datePreset', event.target.value as NewReleaseFilters['datePreset'])
              }
            >
              <option value="30">최근 30일</option>
              <option value="60">최근 60일</option>
              <option value="90">최근 90일</option>
              <option value="180">최근 6개월</option>
              <option value="365">최근 1년</option>
              <option value="all">전체</option>
            </select>
          </label>
          <label>
            KDC 대분류
            <select value={filters.kdcMajor} onChange={(event) => updateFilter('kdcMajor', event.target.value)}>
              <option value="">전체</option>
              {kdcMajorItems.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            발행연도 이후
            <input
              value={filters.publicationYearFrom}
              inputMode="numeric"
              placeholder="예: 2025"
              onChange={(event) => updateFilter('publicationYearFrom', event.target.value)}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={filters.includeUndated}
              onChange={(event) => updateFilter('includeUndated', event.target.checked)}
            />
            등록일 없는 자료 포함
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
      </section>

      {facetOptions.missingShelfCount > 0 ? (
        <p className="status-message">
          현재 소장목록 {facetOptions.missingShelfCount.toLocaleString()}건에 자료실 값이 없습니다.
          자료구분은 도서자료를 기본값으로 두고 DVD/CD 등 단서가 있는 자료만 비도서자료로 분리합니다.
        </p>
      ) : null}

      {result.undatedCount > 0 ? (
        <p className="status-message">
          현재 조건 결과 중 등록일이 비어 있는 자료가 {result.undatedCount.toLocaleString()}건 있습니다.
          정보나루 응답에 등록일이 없는 경우 발행연도와 KDC로 보조 판단하세요.
        </p>
      ) : null}

      {error ? (
        <ErrorNotice
          title="조회 오류"
          cause={error}
          action="조건을 줄이거나 소장목록 캐시 상태를 확인하세요."
        />
      ) : null}

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div>
            <strong>{loading ? '조회 중...' : `총 ${result.total.toLocaleString()}건`}</strong>
            <span>{rangeLabel}</span>
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
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>도서명</th>
                <th>저자</th>
                <th>출판사</th>
                <th>발행연도</th>
                <th>ISBN</th>
                <th>자료구분</th>
                <th>KDC</th>
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
                  <td>{getMaterialTypeLabel(row)}</td>
                  <td>{row.kdc}</td>
                  <td>{row.shelfName}</td>
                  <td>{row.registeredAt || '-'}</td>
                </tr>
              ))}
              {!loading && result.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    <Search size={18} aria-hidden="true" />
                    조회 결과가 없습니다.
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
