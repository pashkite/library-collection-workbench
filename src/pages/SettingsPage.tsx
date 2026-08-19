import {
  BookOpen,
  Building2,
  CalendarDays,
  Download,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../lib/AppDataContext'
import { downloadHoldingsExcel, downloadJsonBackup } from '../lib/excel'
import {
  clearHoldingsCache,
  getAllHoldings,
  getStoredDataInfo,
  resetAllData,
  searchHoldings,
} from '../lib/libraryDb'
import { getAladinKey, getStorageEstimate, setAladinKey } from '../lib/settingsStorage'
import type { DataMeta, StoredBookHolding } from '../types/library'
import './SettingsPage.css'

function formatBytes(value?: number) {
  if (!value) return '-'
  const mb = value / 1024 / 1024
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(1)} MB`
}

export function SettingsPage() {
  const { data, refreshData, updateMeta } = useAppData()
  const [meta, setMeta] = useState<DataMeta | undefined>(data.meta)
  const [count, setCount] = useState(data.totalCount)
  const [storageText, setStorageText] = useState('-')
  const [previewRows, setPreviewRows] = useState<StoredBookHolding[]>([])
  const [aladinKey, setAladinKeyState] = useState(getAladinKey())
  const [message, setMessage] = useState<string>()

  const reloadInfo = useCallback(async () => {
    const [stored, estimate, preview] = await Promise.all([
      getStoredDataInfo(),
      getStorageEstimate(),
      searchHoldings(
        {
          title: '',
          author: '',
          publisher: '',
          isbn: '',
          materialType: 'all',
          shelfName: '',
        },
        1,
        5,
      ),
    ])

    setMeta(stored.meta)
    setCount(stored.count)
    setPreviewRows(preview.rows)
    setStorageText(`${formatBytes(estimate?.usage)} / ${formatBytes(estimate?.quota)}`)
    updateMeta(stored.meta, stored.count)
  }, [updateMeta])

  useEffect(() => {
    let canceled = false
    queueMicrotask(() => {
      if (!canceled) void reloadInfo()
    })
    return () => {
      canceled = true
    }
  }, [reloadInfo])

  const clearCache = async () => {
    if (!confirm('소장목록 캐시를 삭제할까요? 다시 받기 전까지 검색과 중복 검토가 제한됩니다.')) return
    await clearHoldingsCache()
    setMessage('소장목록 캐시를 삭제했습니다.')
    await reloadInfo()
  }

  const resetData = async () => {
    if (!confirm('전체 데이터를 초기화할까요? 알라딘 키와 소장목록 캐시가 함께 삭제됩니다.')) return
    await resetAllData()
    setAladinKeyState('')
    setMessage('전체 데이터를 초기화했습니다.')
    await reloadInfo()
  }

  const backupJson = async () => {
    const rows = await getAllHoldings()
    downloadJsonBackup(rows, `holdings_backup_${meta?.baseDate ?? 'unknown'}.json`)
    setMessage('JSON 백업 파일을 생성했습니다.')
  }

  const backupExcel = async () => {
    const rows = await getAllHoldings()
    await downloadHoldingsExcel(rows, `holdings_backup_${meta?.baseDate ?? 'unknown'}.xlsx`, meta)
    setMessage('엑셀 백업 파일을 생성했습니다.')
  }

  return (
    <div className="settings-refined">
      <header className="settings-heading">
        <div>
          <h1>설정</h1>
          <p>장서 데이터 백업과 시스템 설정을 관리합니다.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void refreshData()}>
          <RefreshCw size={16} aria-hidden="true" />
          소장목록 다시 받기
        </button>
      </header>

      {message ? <p className="settings-message" role="status">{message}</p> : null}

      <section className="panel settings-overview" aria-labelledby="settings-overview-title">
        <div className="settings-card-heading">
          <h2 id="settings-overview-title">소장목록 현황</h2>
        </div>

        <div className="settings-metrics">
          <article>
            <span className="settings-metric-icon"><CalendarDays size={20} aria-hidden="true" /></span>
            <div>
              <span>저장된 소장목록 기준일</span>
              <strong>{meta?.baseDate ?? '-'}</strong>
              <small>{meta?.lastUpdatedAt ? '최근 갱신 데이터' : '기준일 정보 없음'}</small>
            </div>
          </article>
          <article>
            <span className="settings-metric-icon"><BookOpen size={20} aria-hidden="true" /></span>
            <div>
              <span>도서 건수</span>
              <strong>{count.toLocaleString()} <em>권</em></strong>
              <small>브라우저에 저장된 소장자료</small>
            </div>
          </article>
          <article>
            <span className="settings-metric-icon"><Building2 size={20} aria-hidden="true" /></span>
            <div>
              <span>도서관 코드</span>
              <strong>{meta?.libraryCode ?? '-'}</strong>
              <small>{meta?.libraryName ?? '도서관 정보 없음'}</small>
            </div>
          </article>
          <article>
            <span className="settings-metric-icon"><HardDrive size={20} aria-hidden="true" /></span>
            <div>
              <span>저장공간 사용량</span>
              <strong>{storageText}</strong>
              <small>현재 브라우저 저장공간 기준</small>
            </div>
          </article>
        </div>
      </section>

      <section className="settings-detail-grid">
        <article className="panel settings-data-card">
          <div className="settings-card-heading">
            <h2>백업 및 데이터 관리</h2>
            <p>현재 소장목록을 파일로 보관하거나 임시 데이터를 정리할 수 있습니다.</p>
          </div>

          <div className="settings-action-section">
            <strong className="settings-section-label">백업하기</strong>
            <div className="settings-backup-grid">
              <button type="button" className="settings-action-button" onClick={() => void backupJson()} disabled={count === 0}>
                <span className="settings-action-icon"><FileJson size={22} aria-hidden="true" /></span>
                <span>
                  <strong>JSON 백업</strong>
                  <small>원본 구조 그대로 저장</small>
                </span>
                <Download size={16} aria-hidden="true" />
              </button>
              <button type="button" className="settings-action-button" onClick={() => void backupExcel()} disabled={count === 0}>
                <span className="settings-action-icon"><FileSpreadsheet size={22} aria-hidden="true" /></span>
                <span>
                  <strong>엑셀 백업</strong>
                  <small>엑셀에서 바로 확인 가능</small>
                </span>
                <Download size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="settings-danger-section">
            <strong className="settings-section-label">위험 기능</strong>
            <p>삭제한 데이터는 복구하기 어려우니 필요한 경우 먼저 백업해 주세요.</p>
            <div className="settings-danger-grid">
              <button type="button" className="settings-danger-button" onClick={() => void clearCache()}>
                <Trash2 size={18} aria-hidden="true" />
                <span><strong>캐시 삭제</strong><small>검색 캐시와 임시 데이터 삭제</small></span>
              </button>
              <button type="button" className="settings-danger-button" onClick={() => void resetData()}>
                <RotateCcw size={18} aria-hidden="true" />
                <span><strong>전체 초기화</strong><small>소장 데이터와 설정 초기화</small></span>
              </button>
            </div>
          </div>
        </article>

        <article className="panel settings-key-card">
          <div className="settings-card-heading settings-key-heading">
            <span className="settings-key-icon"><KeyRound size={21} aria-hidden="true" /></span>
            <div>
              <h2>알라딘 TTB Key</h2>
              <p>알라딘 도서 정보 조회에 사용할 인증 키를 설정합니다.</p>
            </div>
          </div>

          <label className="settings-key-label">
            TTB Key
            <input
              value={aladinKey}
              type="password"
              placeholder="알라딘 TTB Key 입력"
              onChange={(event) => setAladinKeyState(event.target.value)}
            />
          </label>
          <p className="settings-key-note">키는 이 브라우저의 localStorage에만 저장됩니다.</p>
          <button
            type="button"
            className="primary-button settings-save-button"
            onClick={() => {
              setAladinKey(aladinKey)
              setMessage('알라딘 TTB Key를 저장했습니다.')
            }}
          >
            저장
          </button>
        </article>
      </section>

      <section className="panel settings-preview" aria-labelledby="settings-preview-title">
        <div className="settings-preview-head">
          <div>
            <h2 id="settings-preview-title">저장 데이터 미리보기</h2>
            <p>현재 브라우저에 저장된 소장목록의 앞 5건을 보여줍니다.</p>
          </div>
          <Link className="settings-text-link" to="/holdings">전체 데이터 보기</Link>
        </div>

        <div className="settings-table-wrap">
          <table className="settings-preview-table">
            <thead>
              <tr>
                <th>등록번호</th>
                <th>서명</th>
                <th>저자</th>
                <th>출판사</th>
                <th>발행연도</th>
                <th>청구기호</th>
                <th>등록일</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.length ? previewRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.registrationNumber || '-'}</td>
                  <td className="settings-title-cell">{row.title || '-'}</td>
                  <td>{row.author || '-'}</td>
                  <td>{row.publisher || '-'}</td>
                  <td>{row.publicationYear || '-'}</td>
                  <td>{row.callNumber || '-'}</td>
                  <td>{row.registeredAt || '-'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="settings-empty-row">저장된 소장목록이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
