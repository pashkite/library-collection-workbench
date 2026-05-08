import { BookOpen, Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ErrorNotice } from '../components/ErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { getCachedAladinDetail, lookupAladinDetail } from '../lib/aladin'
import { downloadReviewExcel } from '../lib/excel'
import {
  parsePurchaseWorkbook,
  parsePurchaseWorkbookWithMapping,
  readPurchaseWorkbookPreview,
  reviewPurchaseCandidates,
} from '../lib/purchaseReview'
import { getAladinKey } from '../lib/settingsStorage'
import type { PurchaseColumnMapping, PurchaseReviewResult, WorkbookPreview } from '../types/library'
import { normalizeIsbn } from '../utils/normalize'

type SortDirection = 'asc' | 'desc'
type SortKey =
  | 'title'
  | 'author'
  | 'publisher'
  | 'isbn'
  | 'price'
  | 'duplicateStatus'
  | 'reviewResult'
  | 'matchedTitle'
  | 'matchedPublicationYear'
  | 'matchedKdc'
  | 'note'

interface SortState {
  key: SortKey
  direction: SortDirection
}

interface ReviewProgress {
  stage: string
  processed: number
  total: number
  message?: string
}

type ReviewCoverState =
  | { status: 'loading' }
  | { status: 'loaded'; coverUrl: string; title: string }
  | { status: 'missing'; message: string }
  | { status: 'error'; message: string }

const mappingLabels: Array<{ key: keyof PurchaseColumnMapping; label: string; required?: boolean }> = [
  { key: 'title', label: '도서명', required: true },
  { key: 'author', label: '저자' },
  { key: 'publisher', label: '출판사' },
  { key: 'isbn', label: 'ISBN', required: true },
  { key: 'price', label: '가격' },
]

const sortableColumns: Array<{ key: SortKey; label: string }> = [
  { key: 'title', label: '도서명' },
  { key: 'author', label: '저자' },
  { key: 'publisher', label: '출판사' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'price', label: '가격' },
  { key: 'duplicateStatus', label: '중복판정' },
  { key: 'reviewResult', label: '검토결과' },
  { key: 'matchedTitle', label: '기존/유사 소장자료' },
  { key: 'matchedPublicationYear', label: '출판연도' },
  { key: 'matchedKdc', label: 'KDC' },
  { key: 'note', label: '비고' },
]

const textCollator = new Intl.Collator('ko-KR', {
  numeric: true,
  sensitivity: 'base',
})

function getPrimaryMatch(row: PurchaseReviewResult) {
  return row.matchedHolding ?? row.similarHoldings?.[0]
}

function getStatusRank(value: PurchaseReviewResult['duplicateStatus']) {
  if (value === 'ISBN 중복') return 0
  if (value === '유사 중복 의심') return 1
  return 2
}

function getReviewRank(value: PurchaseReviewResult['reviewResult']) {
  if (value === '기존 소장 확인') return 0
  if (value === '유사 자료 확인 필요') return 1
  return 2
}

function getSortValue(row: PurchaseReviewResult, key: SortKey): string | number {
  const primaryMatch = getPrimaryMatch(row)

  switch (key) {
    case 'price':
      return row.price ?? ''
    case 'duplicateStatus':
      return getStatusRank(row.duplicateStatus)
    case 'reviewResult':
      return getReviewRank(row.reviewResult)
    case 'matchedTitle':
      return primaryMatch?.title ?? ''
    case 'matchedPublicationYear':
      return primaryMatch?.publicationYear.match(/\d{4}/)?.[0] ?? ''
    case 'matchedKdc':
      return primaryMatch?.kdc ?? ''
    default:
      return row[key] ?? ''
  }
}

function compareRowsByKey(a: PurchaseReviewResult, b: PurchaseReviewResult, key: SortKey) {
  const aValue = getSortValue(a, key)
  const bValue = getSortValue(b, key)

  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return aValue - bValue
  }

  const aText = String(aValue)
  const bText = String(bValue)
  if (!aText && bText) return 1
  if (aText && !bText) return -1
  return textCollator.compare(aText, bText)
}

function getSortColumnLabel(key: SortKey) {
  return sortableColumns.find((column) => column.key === key)?.label ?? key
}

export function PurchaseReviewPage() {
  const [results, setResults] = useState<PurchaseReviewResult[]>([])
  const [sortState, setSortState] = useState<SortState>()
  const [reviewProgress, setReviewProgress] = useState<ReviewProgress>()
  const [coverByIsbn, setCoverByIsbn] = useState<Record<string, ReviewCoverState>>({})
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string>()
  const [fileName, setFileName] = useState<string>()
  const [currentFile, setCurrentFile] = useState<File>()
  const [preview, setPreview] = useState<WorkbookPreview>()
  const [mapping, setMapping] = useState<PurchaseColumnMapping>({})

  const loadReviewCover = async (row: PurchaseReviewResult) => {
    const key = normalizeIsbn(row.isbn)
    if (!key) return

    setCoverByIsbn((current) => ({ ...current, [key]: { status: 'loading' } }))
    try {
      const detail = await lookupAladinDetail(key)
      setCoverByIsbn((current) => ({
        ...current,
        [key]: detail.coverUrl
          ? { status: 'loaded', coverUrl: detail.coverUrl, title: detail.title || row.title }
          : { status: 'missing', message: '알라딘 표지 없음' },
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

  const loadReviewCovers = async (reviewedRows: PurchaseReviewResult[]) => {
    const uniqueRows = Array.from(
      new Map(
        reviewedRows
          .map((row) => [normalizeIsbn(row.isbn), row] as const)
          .filter(([key]) => Boolean(key)),
      ).values(),
    )

    if (uniqueRows.length === 0) {
      setReviewProgress({
        stage: '표지 이미지 확인 건너뜀',
        processed: 0,
        total: 0,
        message: 'ISBN이 있는 후보가 없어 표지를 조회하지 않았습니다.',
      })
      return
    }

    const cachedCovers: Record<string, ReviewCoverState> = {}
    const uncachedRows: PurchaseReviewResult[] = []

    for (const row of uniqueRows) {
      const key = normalizeIsbn(row.isbn)
      const cached = getCachedAladinDetail(key)
      if (cached?.coverUrl) {
        cachedCovers[key] = { status: 'loaded', coverUrl: cached.coverUrl, title: cached.title || row.title }
      } else {
        uncachedRows.push(row)
      }
    }

    if (Object.keys(cachedCovers).length > 0) {
      setCoverByIsbn((current) => ({ ...current, ...cachedCovers }))
    }

    if (uncachedRows.length === 0) {
      setReviewProgress({
        stage: '검토 완료',
        processed: uniqueRows.length,
        total: uniqueRows.length,
        message: '캐시된 알라딘 표지를 표시했습니다.',
      })
      return
    }

    if (!getAladinKey()) {
      setReviewProgress({
        stage: '검토 완료',
        processed: Object.keys(cachedCovers).length,
        total: uniqueRows.length,
        message: '알라딘 TTB Key를 저장하면 표지를 자동으로 가져옵니다.',
      })
      return
    }

    let processed = Object.keys(cachedCovers).length
    setReviewProgress({
      stage: '알라딘 표지 이미지 확인 중',
      processed,
      total: uniqueRows.length,
      message: 'ISBN 기준으로 표지를 가져오고 있습니다.',
    })

    const batchSize = 4
    for (let index = 0; index < uncachedRows.length; index += batchSize) {
      const batch = uncachedRows.slice(index, index + batchSize)
      await Promise.allSettled(batch.map((row) => loadReviewCover(row)))
      processed += batch.length
      setReviewProgress({
        stage: '알라딘 표지 이미지 확인 중',
        processed,
        total: uniqueRows.length,
        message: `${processed.toLocaleString()} / ${uniqueRows.length.toLocaleString()}건 확인`,
      })
    }

    setReviewProgress({
      stage: '검토 완료',
      processed: uniqueRows.length,
      total: uniqueRows.length,
      message: '중복 검토와 표지 확인을 마쳤습니다.',
    })
  }

  const reviewFile = async (file: File, nextMapping?: PurchaseColumnMapping) => {
    setProcessing(true)
    setError(undefined)
    setResults([])
    setSortState(undefined)
    setCoverByIsbn({})
    setReviewProgress({
      stage: '엑셀 행 읽는 중',
      processed: 0,
      total: 0,
      message: '업로드한 파일에서 후보 도서를 읽고 있습니다.',
    })
    try {
      const candidates = nextMapping
        ? await parsePurchaseWorkbookWithMapping(file, nextMapping)
        : await parsePurchaseWorkbook(file)
      setReviewProgress({
        stage: '소장목록 중복 검토 중',
        processed: 0,
        total: candidates.length,
        message: 'ISBN 완전 일치와 유사 서지를 비교하고 있습니다.',
      })
      const reviewed = await reviewPurchaseCandidates(candidates, (processed, total) => {
        setReviewProgress({
          stage: '소장목록 중복 검토 중',
          processed,
          total,
          message: `${processed.toLocaleString()} / ${total.toLocaleString()}건 검토`,
        })
      })
      setResults(reviewed)
      setSortState(undefined)
      await loadReviewCovers(reviewed)
    } catch (uploadError) {
      setResults([])
      setSortState(undefined)
      setCoverByIsbn({})
      setReviewProgress(undefined)
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : '구입 후보 엑셀을 처리하지 못했습니다.',
      )
    } finally {
      setProcessing(false)
    }
  }

  const handleFile = async (file?: File) => {
    if (!file) return
    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
      setError('XLSX 또는 XLS 파일만 업로드할 수 있습니다.')
      return
    }
    setFileName(file.name)
    setCurrentFile(file)
    setProcessing(true)
    setError(undefined)
    setReviewProgress({
      stage: '엑셀 구조 확인 중',
      processed: 0,
      total: 0,
      message: '자동 인식할 열과 미리보기 행을 찾고 있습니다.',
    })
    try {
      const nextPreview = await readPurchaseWorkbookPreview(file)
      setPreview(nextPreview)
      setMapping(nextPreview.autoMapping)
      setProcessing(false)
      await reviewFile(file, nextPreview.autoMapping)
    } catch (previewError) {
      setProcessing(false)
      setResults([])
      setCoverByIsbn({})
      setReviewProgress(undefined)
      setPreview(undefined)
      setError(
        previewError instanceof Error
          ? previewError.message
          : '엑셀 파일 구조를 읽지 못했습니다.',
      )
    }
  }

  const reprocessWithMapping = async () => {
    if (!currentFile) return
    await reviewFile(currentFile, mapping)
  }

  const exactDuplicateCount = results.filter((row) => row.duplicateStatus === 'ISBN 중복').length
  const similarCount = results.filter((row) => row.duplicateStatus === '유사 중복 의심').length
  const coverLoadedCount = results.filter((row) => coverByIsbn[normalizeIsbn(row.isbn)]?.status === 'loaded').length
  const progressPercent = reviewProgress?.total
    ? Math.round((reviewProgress.processed / reviewProgress.total) * 100)
    : processing
      ? 8
      : reviewProgress
        ? 100
        : 0
  const sortDescription = sortState
    ? `${getSortColumnLabel(sortState.key)} ${sortState.direction === 'asc' ? '오름차순' : '내림차순'}`
    : '업로드 순서'
  const sortedResults = useMemo(() => {
    if (!sortState) return results

    const direction = sortState.direction === 'asc' ? 1 : -1
    return [...results].sort((a, b) => compareRowsByKey(a, b, sortState.key) * direction)
  }, [results, sortState])

  const updateSort = (key: SortKey) => {
    setSortState((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  const getSortAria = (key: SortKey): 'none' | 'ascending' | 'descending' => {
    if (sortState?.key !== key) return 'none'
    return sortState.direction === 'asc' ? 'ascending' : 'descending'
  }

  const getNextSortLabel = (key: SortKey, label: string) => {
    const nextDirection = sortState?.key === key && sortState.direction === 'asc' ? '내림차순' : '오름차순'
    return `${label} ${nextDirection} 정렬`
  }

  const renderSortableHeader = (key: SortKey, label: string) => (
    <th key={key} className="sortable-header" aria-sort={getSortAria(key)}>
      <button
        type="button"
        className="sort-button"
        onClick={() => updateSort(key)}
        aria-label={getNextSortLabel(key, label)}
      >
        <span>{label}</span>
        <span className="sort-indicator" aria-hidden="true">
          {sortState?.key === key ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )

  const renderReviewCover = (row: PurchaseReviewResult) => {
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

    if (cover?.status === 'loading') return <span className="cover-placeholder">표지 조회</span>
    if (!key) return <span className="cover-placeholder">ISBN 없음</span>

    return (
      <button
        type="button"
        className="cover-button"
        onClick={() => void loadReviewCover(row)}
        title={cover?.message ?? '알라딘에서 표지를 다시 조회합니다.'}
      >
        <BookOpen size={16} aria-hidden="true" />
        {cover?.status === 'error' ? '재시도' : '표지'}
      </button>
    )
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="구입 후보 검토"
        description="엑셀 파일을 업로드하면 ISBN 완전 일치와 서명·저자·출판사 유사 중복을 함께 확인합니다."
        actions={
          <button
            type="button"
            className="primary-button"
            disabled={results.length === 0}
            title={
              results.length === 0
                ? '검토할 엑셀을 업로드하면 사용할 수 있습니다.'
                : '현재 목록 순서대로 엑셀을 저장합니다.'
            }
            onClick={() =>
              void downloadReviewExcel(
                sortedResults,
                `구입후보_검토결과_${new Date().toISOString().slice(0, 10)}.xlsx`,
              )
            }
          >
            <Download size={16} aria-hidden="true" />
            결과 엑셀
          </button>
        }
      />

      <section className="panel upload-panel">
        <label className="file-drop">
          <Upload size={22} aria-hidden="true" />
          <strong>{processing ? reviewProgress?.stage ?? '검토 중...' : '구입 후보 엑셀 업로드'}</strong>
          <span>
            {processing && reviewProgress
              ? reviewProgress.message
              : fileName
                ? `${fileName} 파일을 기준으로 검토합니다.`
                : 'XLSX, XLS 파일을 지원합니다. 개인정보 포함 파일은 업로드하지 마세요.'}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => {
              void handleFile(event.target.files?.[0])
              event.currentTarget.value = ''
            }}
          />
        </label>
        {reviewProgress ? (
          <div className="review-progress" role="status" aria-live="polite">
            <div className="progress-meta">
              <strong>{reviewProgress.stage}</strong>
              <span>{progressPercent}%</span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div style={{ width: `${progressPercent}%` }} />
            </div>
            <p>
              {reviewProgress.total > 0
                ? `${reviewProgress.processed.toLocaleString()} / ${reviewProgress.total.toLocaleString()}건`
                : reviewProgress.message}
            </p>
          </div>
        ) : null}
        <div className="recognition-note split-note">
          <div>
            <strong>자동 인식 열</strong>
            <span>
              알라딘 장바구니/마이리스트의 상품명, ISBN13, 저자/아티스트, 출판사/제작사를 포함해
              도서명·저자·출판사·ISBN·가격 열을 먼저 인식하고 필요하면 직접 바꿀 수 있습니다.
            </span>
          </div>
          <a className="secondary-button" href={`${import.meta.env.BASE_URL}sample/sample_purchase_candidates.xlsx`}>
            <FileSpreadsheet size={16} aria-hidden="true" />
            샘플 파일
          </a>
        </div>
      </section>

      {preview ? (
        <section className="panel">
          <div className="filter-header">
            <div>
              <strong>열 매핑</strong>
              <span>자동 인식이 틀렸다면 실제 엑셀 열 이름을 직접 지정한 뒤 다시 검토하세요.</span>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void reprocessWithMapping()}
              disabled={processing || !currentFile}
            >
              <RefreshCw size={16} aria-hidden="true" />
              선택한 열로 다시 검토
            </button>
          </div>
          <div className="mapping-grid">
            {mappingLabels.map((item) => (
              <label key={item.key}>
                {item.label}
                <select
                  value={mapping[item.key] ?? ''}
                  onChange={(event) =>
                    setMapping((current) => ({ ...current, [item.key]: event.target.value || undefined }))
                  }
                >
                  <option value="">사용 안 함{item.required ? ' / 미지정 가능' : ''}</option>
                  {preview.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="preview-table">
            {preview.sampleRows.map((row, index) => (
              <article key={`sample-${index}`}>
                {preview.headers.slice(0, 6).map((header) => (
                  <span key={header}>
                    <strong>{header}</strong>
                    {row[header]}
                  </span>
                ))}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {error ? (
        <ErrorNotice
          title="엑셀 처리 오류"
          cause={error}
          action="파일 형식과 열 이름을 확인한 뒤 열 매핑을 다시 지정하세요."
        />
      ) : null}

      <section className="metric-grid compact">
        <article className="metric-card">
          <span>검토 건수</span>
          <strong>{results.length.toLocaleString()}건</strong>
          <p>업로드 파일 기준</p>
        </article>
        <article className="metric-card">
          <span>ISBN 중복</span>
          <strong>{exactDuplicateCount.toLocaleString()}건</strong>
          <p>소장목록 ISBN 완전 일치</p>
        </article>
        <article className="metric-card">
          <span>유사 중복 의심</span>
          <strong>{similarCount.toLocaleString()}건</strong>
          <p>서명·저자·출판사 유사도 기준</p>
        </article>
        <article className="metric-card">
          <span>표지 표시</span>
          <strong>{coverLoadedCount.toLocaleString()}건</strong>
          <p>알라딘 ISBN 조회 기준</p>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div>
            <strong>검토 결과 목록</strong>
            <span aria-live="polite">
              현재 정렬: {sortDescription} · {sortedResults.length.toLocaleString()}건
            </span>
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={!sortState}
            onClick={() => setSortState(undefined)}
            title={sortState ? '처음 업로드된 순서로 되돌립니다.' : '이미 업로드 순서로 표시 중입니다.'}
          >
            <RefreshCw size={16} aria-hidden="true" />
            정렬 초기화
          </button>
        </div>
        <p className="table-hint">중복판정은 보조 자료입니다. 유사 중복 의심 건은 담당자가 서지와 판사항을 확인하세요.</p>
        <div className="table-scroll">
          <table className="purchase-review-table">
            <thead>
              <tr>
                <th>표지</th>
                {sortableColumns.map(({ key, label }) => renderSortableHeader(key, label))}
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((row) => {
                const primaryMatch = getPrimaryMatch(row)
                return (
                  <tr key={row.id}>
                    <td className="cover-cell">{renderReviewCover(row)}</td>
                    <td>{row.title}</td>
                    <td>{row.author}</td>
                    <td>{row.publisher}</td>
                    <td>{row.isbn}</td>
                    <td>{row.price?.toLocaleString() ?? ''}</td>
                    <td>
                      <span
                        className={
                          row.duplicateStatus === 'ISBN 중복'
                            ? 'danger-chip'
                            : row.duplicateStatus === '유사 중복 의심'
                              ? 'warning-chip'
                              : 'ok-chip'
                        }
                      >
                        {row.duplicateStatus}
                      </span>
                    </td>
                    <td>{row.reviewResult}</td>
                    <td>
                      {primaryMatch ? (
                        <div className="stacked-cell">
                          <strong>{primaryMatch.title}</strong>
                          <span>{primaryMatch.author}</span>
                          <span>{primaryMatch.publisher}</span>
                          <span>{primaryMatch.isbn}</span>
                        </div>
                      ) : (
                        ''
                      )}
                    </td>
                    <td>{primaryMatch?.publicationYear ?? ''}</td>
                    <td>{primaryMatch?.kdc ?? ''}</td>
                    <td>{row.note}</td>
                  </tr>
                )
              })}
              {results.length === 0 ? (
                <tr>
                  <td colSpan={12} className="empty-cell">
                    <FileSpreadsheet size={18} aria-hidden="true" />
                    업로드한 구입 후보가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
