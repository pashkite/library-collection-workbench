import { Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react'
import { useState } from 'react'
import { ErrorNotice } from '../components/ErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { downloadReviewExcel } from '../lib/excel'
import {
  parsePurchaseWorkbook,
  parsePurchaseWorkbookWithMapping,
  readPurchaseWorkbookPreview,
  reviewPurchaseCandidates,
} from '../lib/purchaseReview'
import type { PurchaseColumnMapping, PurchaseReviewResult, WorkbookPreview } from '../types/library'

const mappingLabels: Array<{ key: keyof PurchaseColumnMapping; label: string; required?: boolean }> = [
  { key: 'title', label: '도서명', required: true },
  { key: 'author', label: '저자' },
  { key: 'publisher', label: '출판사' },
  { key: 'isbn', label: 'ISBN', required: true },
  { key: 'price', label: '가격' },
]

export function PurchaseReviewPage() {
  const [results, setResults] = useState<PurchaseReviewResult[]>([])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string>()
  const [fileName, setFileName] = useState<string>()
  const [currentFile, setCurrentFile] = useState<File>()
  const [preview, setPreview] = useState<WorkbookPreview>()
  const [mapping, setMapping] = useState<PurchaseColumnMapping>({})

  const reviewFile = async (file: File, nextMapping?: PurchaseColumnMapping) => {
    setProcessing(true)
    setError(undefined)
    try {
      const candidates = nextMapping
        ? await parsePurchaseWorkbookWithMapping(file, nextMapping)
        : await parsePurchaseWorkbook(file)
      const reviewed = await reviewPurchaseCandidates(candidates)
      setResults(reviewed)
    } catch (uploadError) {
      setResults([])
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
    try {
      const nextPreview = await readPurchaseWorkbookPreview(file)
      setPreview(nextPreview)
      setMapping(nextPreview.autoMapping)
      setProcessing(false)
      await reviewFile(file, nextPreview.autoMapping)
    } catch (previewError) {
      setProcessing(false)
      setResults([])
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
            onClick={() =>
              void downloadReviewExcel(
                results,
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
          <strong>{processing ? '검토 중...' : '구입 후보 엑셀 업로드'}</strong>
          <span>
            {fileName
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
      </section>

      <section className="panel table-panel">
        <p className="table-hint">중복판정은 보조 자료입니다. 유사 중복 의심 건은 담당자가 서지와 판사항을 확인하세요.</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>도서명</th>
                <th>저자</th>
                <th>출판사</th>
                <th>ISBN</th>
                <th>가격</th>
                <th>중복판정</th>
                <th>검토결과</th>
                <th>기존/유사 소장자료</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => {
                const primaryMatch = row.matchedHolding ?? row.similarHoldings?.[0]
                return (
                  <tr key={row.id}>
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
                    <td>{row.note}</td>
                  </tr>
                )
              })}
              {results.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-cell">
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
