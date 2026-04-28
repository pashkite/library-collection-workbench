import { Download, FileSpreadsheet, RefreshCw, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useAppData } from '../lib/AppDataContext'
import type { DataMeta } from '../types/library'

function formatStatus(status?: DataMeta['status']) {
  switch (status) {
    case 'ready':
      return '사용 가능'
    case 'updating':
      return '갱신 중'
    case 'failed':
      return '갱신 실패'
    case 'sample':
      return '샘플 데이터'
    default:
      return '-'
  }
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function HomePage() {
  const { data, refreshData } = useAppData()

  return (
    <div className="page-stack">
      <PageHeader
        title="도서관 장서 업무 보조 웹"
        description="소장목록 조회와 구입 후보 ISBN 중복 검토를 브라우저 저장소 기반으로 처리합니다."
        actions={
          <button type="button" className="secondary-button" onClick={() => void refreshData()}>
            <RefreshCw size={16} aria-hidden="true" />
            소장목록 다시 받기
          </button>
        }
      />

      <section className="metric-grid">
        <article className="metric-card">
          <span>데이터 기준일</span>
          <strong>{data.meta?.baseDate ?? '-'}</strong>
          <p>정보나루 또는 샘플 JSON 기준일</p>
        </article>
        <article className="metric-card">
          <span>저장된 도서</span>
          <strong>{data.totalCount.toLocaleString()}권</strong>
          <p>IndexedDB에 저장된 소장목록</p>
        </article>
        <article className="metric-card">
          <span>갱신 상태</span>
          <strong>{formatStatus(data.meta?.status)}</strong>
          <p>{formatDateTime(data.meta?.lastUpdatedAt)}</p>
        </article>
      </section>

      <section className="quick-grid">
        <Link to="/holdings" className="quick-link">
          <Search size={20} aria-hidden="true" />
          <strong>소장도서 조회</strong>
          <span>도서명, 저자, 출판사, ISBN으로 검색하고 엑셀로 내려받습니다.</span>
        </Link>
        <Link to="/purchase-review" className="quick-link">
          <FileSpreadsheet size={20} aria-hidden="true" />
          <strong>구입 후보 검토</strong>
          <span>XLSX/XLS 파일을 올려 ISBN 완전 일치 중복을 확인합니다.</span>
        </Link>
        <Link to="/settings" className="quick-link">
          <Download size={20} aria-hidden="true" />
          <strong>데이터 관리</strong>
          <span>기준일 확인, 캐시 삭제, JSON 백업, 알라딘 키를 관리합니다.</span>
        </Link>
      </section>

      <section className="panel caution-panel">
        <h2>업무 기준</h2>
        <p>
          공개 JSON과 엑셀 결과에는 신청자명, 회원번호, 전화번호, 내부 검토 메모, 예산 관련 메모,
          담당자 메모, 민원 관련 정보를 기본 포함하지 않습니다.
        </p>
        <p>검토 결과는 보조 자료이며 최종 구입 여부와 추천도서 선정 여부는 담당자가 판단합니다.</p>
      </section>
    </div>
  )
}
