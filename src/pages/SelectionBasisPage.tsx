import { Download, ExternalLink, Plus, Search, Upload } from 'lucide-react'
import { useState } from 'react'
import { ErrorNotice } from '../components/ErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { lookupAladinDetail } from '../lib/aladin'
import { downloadSelectionBasisExcel } from '../lib/excel'
import { parsePurchaseWorkbook } from '../lib/purchaseReview'
import type { SelectionBasis } from '../types/library'

function makeManualLinks(row: SelectionBasis) {
  const query = encodeURIComponent(`${row.title} ${row.author ?? ''}`.trim() || row.isbn)
  const isbn = encodeURIComponent(row.isbn)
  return [
    { label: '국립중앙도서관', url: `https://www.nl.go.kr/seoji/contents/S80100000000.do?schM=intgr_detail&isbn=${isbn}` },
    { label: '알라딘', url: `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=All&SearchWord=${isbn || query}` },
    { label: '세종도서', url: `https://sejong.nl.go.kr/search/search.do?kwd=${query}` },
    { label: '문학상 검색', url: `https://www.google.com/search?q=${query}%20%EB%AC%B8%ED%95%99%EC%83%81` },
  ]
}

function emptyRow(index: number): SelectionBasis {
  return {
    id: `basis-${Date.now()}-${index}`,
    isbn: '',
    title: '',
    author: '',
    publisher: '',
    recommendedBook: false,
    sejongBook: false,
    awardName: '',
    outOfPrint: false,
    authorReviewStatus: '확인 전',
    staffMemo: '',
  }
}

export function SelectionBasisPage() {
  const [rows, setRows] = useState<SelectionBasis[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [message, setMessage] = useState<string>()

  const handleFile = async (file?: File) => {
    if (!file) return
    setLoading(true)
    setError(undefined)
    setMessage(undefined)
    try {
      const candidates = await parsePurchaseWorkbook(file)
      setRows(
        candidates.map((candidate, index) => ({
          ...emptyRow(index),
          id: candidate.id,
          isbn: candidate.isbn,
          title: candidate.title,
          author: candidate.author,
          publisher: candidate.publisher,
        })),
      )
      setMessage(`${candidates.length.toLocaleString()}건을 선정 근거 확인표로 불러왔습니다.`)
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : '엑셀 파일을 읽지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const updateRow = <Key extends keyof SelectionBasis>(
    id: string,
    key: Key,
    value: SelectionBasis[Key],
  ) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)))
  }

  const enrichRow = async (id: string) => {
    const row = rows.find((item) => item.id === id)
    if (!row?.isbn) {
      setError('알라딘 조회에는 ISBN이 필요합니다.')
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      const detail = await lookupAladinDetail(row.isbn)
      setRows((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                title: item.title || detail.title,
                author: item.author || detail.author,
                publisher: item.publisher || detail.publisher,
                outOfPrint:
                  item.outOfPrint ||
                  Boolean(detail.stockStatus && /품절|절판|구판/.test(detail.stockStatus)),
                aladinDetail: detail,
              }
            : item,
        ),
      )
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : '알라딘 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const addRow = () => {
    setRows((current) => [...current, emptyRow(current.length + 1)])
  }

  const completedCount = rows.filter(
    (row) => row.recommendedBook || row.sejongBook || row.awardName || row.outOfPrint || row.staffMemo,
  ).length

  return (
    <div className="page-stack">
      <PageHeader
        title="도서 선정 근거 확인"
        description="구입 후보를 불러와 추천도서, 세종도서, 문학상, 절판 여부, 담당자 검토 메모를 한 표에서 정리합니다."
        actions={
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={addRow}>
              <Plus size={16} aria-hidden="true" />
              행 추가
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={rows.length === 0}
              onClick={() =>
                void downloadSelectionBasisExcel(
                  rows,
                  `선정근거_확인표_${new Date().toISOString().slice(0, 10)}.xlsx`,
                )
              }
            >
              <Download size={16} aria-hidden="true" />
              엑셀 다운로드
            </button>
          </div>
        }
      />

      <section className="panel upload-panel">
        <label className="file-drop compact-drop">
          <Upload size={22} aria-hidden="true" />
          <strong>{loading ? '처리 중...' : '구입 후보 엑셀 불러오기'}</strong>
          <span>구입 후보 검토와 같은 열 이름을 인식합니다. 민감한 신청자 정보는 포함하지 마세요.</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => {
              void handleFile(event.target.files?.[0])
              event.currentTarget.value = ''
            }}
          />
        </label>
      </section>

      {message ? <p className="status-message">{message}</p> : null}
      {error ? (
        <ErrorNotice
          title="선정 근거 처리 오류"
          cause={error}
          action="파일 열 이름, ISBN, 알라딘 TTB Key 저장 상태를 확인하세요."
        />
      ) : null}

      <section className="metric-grid compact">
        <article className="metric-card">
          <span>대상 도서</span>
          <strong>{rows.length.toLocaleString()}건</strong>
          <p>확인표에 올라온 후보</p>
        </article>
        <article className="metric-card">
          <span>근거 입력</span>
          <strong>{completedCount.toLocaleString()}건</strong>
          <p>하나 이상 근거 또는 메모 입력</p>
        </article>
        <article className="metric-card">
          <span>알라딘 보강</span>
          <strong>{rows.filter((row) => row.aladinDetail).length.toLocaleString()}건</strong>
          <p>판매 상태와 상세정보 확인</p>
        </article>
      </section>

      <section className="panel table-panel">
        <p className="table-hint">외부 링크는 수동 확인 보조용입니다. 최종 선정 근거는 담당자가 확인 후 기록하세요.</p>
        <div className="table-scroll">
          <table className="basis-table">
            <thead>
              <tr>
                <th>서지</th>
                <th>추천</th>
                <th>세종</th>
                <th>문학상</th>
                <th>절판</th>
                <th>저자 검토</th>
                <th>수동 확인</th>
                <th>알라딘</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="stacked-cell editable-cell">
                      <input value={row.title} placeholder="도서명" onChange={(event) => updateRow(row.id, 'title', event.target.value)} />
                      <input value={row.author ?? ''} placeholder="저자" onChange={(event) => updateRow(row.id, 'author', event.target.value)} />
                      <input value={row.publisher ?? ''} placeholder="출판사" onChange={(event) => updateRow(row.id, 'publisher', event.target.value)} />
                      <input value={row.isbn} placeholder="ISBN" onChange={(event) => updateRow(row.id, 'isbn', event.target.value)} />
                    </div>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(row.recommendedBook)}
                      onChange={(event) => updateRow(row.id, 'recommendedBook', event.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(row.sejongBook)}
                      onChange={(event) => updateRow(row.id, 'sejongBook', event.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      value={row.awardName ?? ''}
                      placeholder="상명"
                      onChange={(event) => updateRow(row.id, 'awardName', event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(row.outOfPrint)}
                      onChange={(event) => updateRow(row.id, 'outOfPrint', event.target.checked)}
                    />
                  </td>
                  <td>
                    <select
                      value={row.authorReviewStatus ?? '확인 전'}
                      onChange={(event) =>
                        updateRow(
                          row.id,
                          'authorReviewStatus',
                          event.target.value as SelectionBasis['authorReviewStatus'],
                        )
                      }
                    >
                      <option value="확인 전">확인 전</option>
                      <option value="확인 필요">확인 필요</option>
                      <option value="확인 완료">확인 완료</option>
                    </select>
                  </td>
                  <td>
                    <div className="link-list">
                      {makeManualLinks(row).map((link) => (
                        <a key={link.label} href={link.url} target="_blank" rel="noreferrer">
                          <ExternalLink size={13} aria-hidden="true" />
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button wide-button"
                      onClick={() => void enrichRow(row.id)}
                      disabled={loading || !row.isbn}
                    >
                      <Search size={16} aria-hidden="true" />
                      조회
                    </button>
                    {row.aladinDetail ? (
                      <p className="mini-note">
                        {row.aladinDetail.stockStatus || '상태 정보 없음'} · {row.aladinDetail.categoryName || '분야 없음'}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <textarea
                      value={row.staffMemo ?? ''}
                      placeholder="담당자 메모"
                      onChange={(event) => updateRow(row.id, 'staffMemo', event.target.value)}
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    <Upload size={18} aria-hidden="true" />
                    불러온 후보가 없습니다.
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
