import { BookOpen, ExternalLink, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ErrorNotice } from '../components/ErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { clearAladinCache, lookupAladinDetail } from '../lib/aladin'
import type { AladinBookDetail } from '../types/library'

function formatPrice(value?: number) {
  if (value === undefined) return '-'
  return `${value.toLocaleString()}원`
}

export function AladinDetailPage() {
  const [isbn, setIsbn] = useState('')
  const [detail, setDetail] = useState<AladinBookDetail>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [message, setMessage] = useState<string>()

  const searchDetail = async (forceRefresh = false) => {
    setLoading(true)
    setError(undefined)
    setMessage(undefined)
    try {
      const nextDetail = await lookupAladinDetail(isbn, forceRefresh)
      setDetail(nextDetail)
      setMessage(forceRefresh ? '알라딘에서 최신 정보를 다시 불러왔습니다.' : '상세정보를 불러왔습니다.')
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : '알라딘 상세정보를 조회하지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }

  const clearCache = () => {
    clearAladinCache()
    setMessage('알라딘 조회 캐시를 삭제했습니다.')
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="알라딘 상세정보 조회"
        description="ISBN으로 표지, 책소개, 목차, 정가, 판매 상태를 조회하고 7일 동안 캐시합니다."
        actions={
          <button type="button" className="danger-button" onClick={clearCache}>
            <Trash2 size={16} aria-hidden="true" />
            조회 캐시 삭제
          </button>
        }
      />

      <section className="panel">
        <div className="search-grid aladin-search-grid">
          <label>
            ISBN
            <input
              value={isbn}
              inputMode="numeric"
              placeholder="ISBN 10 또는 13"
              onChange={(event) => setIsbn(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void searchDetail()
              }}
            />
          </label>
          <div className="button-row align-end">
            <button type="button" className="primary-button" onClick={() => void searchDetail()} disabled={loading}>
              <Search size={16} aria-hidden="true" />
              조회
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void searchDetail(true)}
              disabled={loading || !detail}
            >
              <RefreshCw size={16} aria-hidden="true" />
              새로고침
            </button>
          </div>
        </div>
      </section>

      {message ? <p className="status-message">{message}</p> : null}
      {error ? (
        <ErrorNotice
          title="알라딘 조회 오류"
          cause={error}
          action="ISBN, 네트워크 상태, GitHub Secret 또는 설정 화면의 알라딘 키 저장 상태를 확인하세요. 브라우저에서 외부 스크립트 호출이 차단되면 조회가 실패할 수 있습니다."
        />
      ) : null}

      {detail ? (
        <section className="panel detail-panel">
          <div className="cover-box">
            {detail.coverUrl ? (
              <img src={detail.coverUrl} alt={`${detail.title} 표지`} />
            ) : (
              <BookOpen size={42} aria-hidden="true" />
            )}
          </div>
          <div className="detail-body">
            <div className="detail-title-row">
              <div>
                <h2>{detail.title}</h2>
                <p className="muted">{detail.author}</p>
              </div>
              {detail.link ? (
                <a className="secondary-button" href={detail.link} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} aria-hidden="true" />
                  알라딘
                </a>
              ) : null}
            </div>
            <dl className="info-list compact-info">
              <div>
                <dt>출판사</dt>
                <dd>{detail.publisher || '-'}</dd>
              </div>
              <div>
                <dt>출간일</dt>
                <dd>{detail.pubDate || '-'}</dd>
              </div>
              <div>
                <dt>정가</dt>
                <dd>{formatPrice(detail.priceStandard)}</dd>
              </div>
              <div>
                <dt>판매 상태</dt>
                <dd>{detail.stockStatus || '-'}</dd>
              </div>
              <div>
                <dt>분야</dt>
                <dd>{detail.categoryName || '-'}</dd>
              </div>
              <div>
                <dt>쪽수</dt>
                <dd>{detail.itemPage?.toLocaleString() ?? '-'}</dd>
              </div>
            </dl>
            <div className="detail-text-grid">
              <article>
                <h3>책소개</h3>
                <p>{detail.description || '제공된 책소개가 없습니다.'}</p>
              </article>
              <article>
                <h3>목차</h3>
                <p>{detail.tableOfContents || '제공된 목차가 없습니다.'}</p>
              </article>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
