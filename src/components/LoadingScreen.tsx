import { BookOpen, CheckCircle2, Database } from 'lucide-react'
import type { BootstrapProgress, StoredBookHolding } from '../types/library'

interface LoadingScreenProps {
  progress: BootstrapProgress
  sampleBook?: StoredBookHolding
  onComplete?: () => void
}

export function LoadingScreen({ progress, sampleBook, onComplete }: LoadingScreenProps) {
  const displayPercent = Math.max(0, Math.min(100, progress.percent))
  const complete = displayPercent >= 100
  const processedLabel = progress.processed.toLocaleString()
  const totalLabel = progress.total.toLocaleString()
  const waitingForFirstStoredRow = progress.total > 0 && progress.processed === 0 && !complete

  return (
    <main className="board-loading-shell" aria-busy={!complete}>
      <section className="board-loading-card" aria-label="소장목록 준비 상태">
        <header className="board-loading-header">
          <span className="board-loading-logo" aria-hidden="true">
            <BookOpen size={25} />
          </span>
          <div>
            <p>장서업무 갤러리</p>
            <h1>{complete ? '소장목록 준비가 완료되었습니다.' : '소장목록을 불러오고 있습니다.'}</h1>
          </div>
        </header>

        <div className="board-loading-notice" role="status" aria-live="polite">
          <div className="board-loading-meta">
            <strong>{progress.stage}</strong>
            <span>{displayPercent}%</span>
          </div>
          <div
            className="board-loading-track"
            role="progressbar"
            aria-label="준비 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={displayPercent}
          >
            <span style={{ width: `${displayPercent}%` }} />
          </div>
          <p>{progress.message}</p>
          {waitingForFirstStoredRow ? (
            <p className="muted">처음 여는 경우 파일 다운로드와 브라우저 저장에 시간이 걸릴 수 있습니다.</p>
          ) : null}
        </div>

        <dl className="board-loading-info">
          <div>
            <dt>
              <Database size={15} aria-hidden="true" /> 처리 건수
            </dt>
            <dd>{processedLabel} / {totalLabel}</dd>
          </div>
          <div>
            <dt>
              <BookOpen size={15} aria-hidden="true" /> 확인 중인 자료
            </dt>
            <dd>{sampleBook?.title ?? '소장자료 정보 확인 중'}</dd>
          </div>
        </dl>

        {complete && onComplete ? (
          <button type="button" className="primary-button board-loading-button" onClick={onComplete}>
            <CheckCircle2 size={17} aria-hidden="true" />
            장서업무 갤러리 열기
          </button>
        ) : null}
      </section>
    </main>
  )
}
