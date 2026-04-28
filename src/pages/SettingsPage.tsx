import { Database, Download, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useAppData } from '../lib/AppDataContext'
import { downloadJsonBackup } from '../lib/excel'
import { clearHoldingsCache, getAllHoldings, getStoredDataInfo, resetAllData } from '../lib/libraryDb'
import { getAladinKey, getStorageEstimate, setAladinKey } from '../lib/settingsStorage'
import type { DataMeta } from '../types/library'

function formatBytes(value?: number) {
  if (!value) return '-'
  const mb = value / 1024 / 1024
  return `${mb.toFixed(1)} MB`
}

export function SettingsPage() {
  const { data, refreshData, updateMeta } = useAppData()
  const [meta, setMeta] = useState<DataMeta | undefined>(data.meta)
  const [count, setCount] = useState(data.totalCount)
  const [storageText, setStorageText] = useState('-')
  const [aladinKey, setAladinKeyState] = useState(getAladinKey())
  const [message, setMessage] = useState<string>()

  const reloadInfo = useCallback(async () => {
    const [stored, estimate] = await Promise.all([getStoredDataInfo(), getStorageEstimate()])
    setMeta(stored.meta)
    setCount(stored.count)
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
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="설정"
        description="소장목록 저장 상태, 캐시, 알라딘 TTB Key를 관리합니다."
        actions={
          <button type="button" className="secondary-button" onClick={() => void refreshData()}>
            <RefreshCw size={16} aria-hidden="true" />
            소장목록 다시 받기
          </button>
        }
      />

      {message ? <p className="status-message">{message}</p> : null}

      <section className="settings-grid">
        <article className="panel">
          <div className="section-title">
            <Database size={18} aria-hidden="true" />
            <h2>소장목록 상태</h2>
          </div>
          <dl className="info-list">
            <div>
              <dt>저장된 소장목록 기준일</dt>
              <dd>{meta?.baseDate ?? '-'}</dd>
            </div>
            <div>
              <dt>정보나루 데이터 기준일</dt>
              <dd>{data.meta?.baseDate ?? '-'}</dd>
            </div>
            <div>
              <dt>저장된 도서 건수</dt>
              <dd>{count.toLocaleString()}권</dd>
            </div>
            <div>
              <dt>도서관 코드</dt>
              <dd>{meta?.libraryCode ?? '-'}</dd>
            </div>
            <div>
              <dt>저장공간 사용량</dt>
              <dd>{storageText}</dd>
            </div>
          </dl>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => void backupJson()} disabled={count === 0}>
              <Download size={16} aria-hidden="true" />
              JSON 백업
            </button>
            <button type="button" className="danger-button" onClick={() => void clearCache()}>
              <Trash2 size={16} aria-hidden="true" />
              캐시 삭제
            </button>
            <button type="button" className="danger-button" onClick={() => void resetData()}>
              <Trash2 size={16} aria-hidden="true" />
              전체 초기화
            </button>
          </div>
        </article>

        <article className="panel">
          <h2>알라딘 TTB Key</h2>
          <p className="muted">실제 알라딘 API 연동은 Phase 3 TODO입니다. 키는 브라우저 localStorage에만 저장합니다.</p>
          <label className="stacked-label">
            TTB Key
            <input
              value={aladinKey}
              type="password"
              placeholder="알라딘 TTB Key 입력"
              onChange={(event) => setAladinKeyState(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setAladinKey(aladinKey)
              setMessage('알라딘 TTB Key를 저장했습니다.')
            }}
          >
            저장
          </button>
        </article>
      </section>
    </div>
  )
}
