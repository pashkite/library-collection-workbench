import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { useState } from 'react'
import { ErrorNotice } from '../components/ErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { downloadReviewExcel } from '../lib/excel'
import { parsePurchaseWorkbook, reviewPurchaseCandidates } from '../lib/purchaseReview'
import type { PurchaseReviewResult } from '../types/library'

export function PurchaseReviewPage() {
  const [results, setResults] = useState<PurchaseReviewResult[]>([])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string>()
  const [fileName, setFileName] = useState<string>()

  const handleFile = async (file?: File) => {
    if (!file) return
    setProcessing(true)
    setError(undefined)
    setFileName(file.name)
    try {
      const lowerName = file.name.toLowerCase()
      if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
        throw new Error('XLSX 또는 XLS 파일만 업로드할 수 있습니다.')
      }
      const candidates = await parsePurchaseWorkbook(file)
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

  const duplicateCount = results.filter((row) => row.duplicateStatus === 'ISBN 중복').length

  return (
    <div className="page-stack">
      <PageHeader
        title="구입 후보 검토"
        description="엑셀 파일을 업로드하면 ISBN 완전 일치 기준으로 소장 중복을 확인합니다."
        actions={
          <button
            type="button"
            className="primary-button"
            disabled={results.length === 0}
            onClick={() =>
              downloadReviewExcel(
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
              도서명/서명/제목/자료명, 저자/저자명/지은이, 출판사/발행처/출판처,
              ISBN/국제표준도서번호, 가격/정가
            </span>
          </div>
          <a className="secondary-button" href={`${import.meta.env.BASE_URL}sample/sample_purchase_candidates.xlsx`}>
            <FileSpreadsheet size={16} aria-hidden="true" />
            샘플 파일
          </a>
        </div>
      </section>

      {error ? (
        <ErrorNotice
          title="엑셀 처리 오류"
          cause={error}
          action="파일 형식과 열 이름을 확인하세요. 수동 열 매핑 UI는 Phase 2 TODO입니다."
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
          <strong>{duplicateCount.toLocaleString()}건</strong>
          <p>소장목록 ISBN 완전 일치</p>
        </article>
        <article className="metric-card">
          <span>구입 검토</span>
          <strong>{(results.length - duplicateCount).toLocaleString()}건</strong>
          <p>담당자 추가 검토 필요</p>
        </article>
      </section>

      <section className="panel table-panel">
        <p className="table-hint">중복판정은 ISBN 완전 일치 기준입니다. 최종 구입 여부는 담당자가 확인하세요.</p>
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
                <th>기존 소장 도서명</th>
                <th>기존 소장 저자</th>
                <th>기존 소장 출판사</th>
                <th>기존 소장 ISBN</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.author}</td>
                  <td>{row.publisher}</td>
                  <td>{row.isbn}</td>
                  <td>{row.price?.toLocaleString() ?? ''}</td>
                  <td>
                    <span className={row.duplicateStatus === 'ISBN 중복' ? 'danger-chip' : 'ok-chip'}>
                      {row.duplicateStatus}
                    </span>
                  </td>
                  <td>{row.reviewResult}</td>
                  <td>{row.matchedHolding?.title ?? ''}</td>
                  <td>{row.matchedHolding?.author ?? ''}</td>
                  <td>{row.matchedHolding?.publisher ?? ''}</td>
                  <td>{row.matchedHolding?.isbn ?? ''}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
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
