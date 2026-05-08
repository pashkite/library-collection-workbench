import { BookOpen, CheckCircle2 } from 'lucide-react'
import type { BootstrapProgress, StoredBookHolding } from '../types/library'

interface LoadingScreenProps {
  progress: BootstrapProgress
  sampleBook?: StoredBookHolding
  onComplete?: () => void
}

export function LoadingScreen({ progress, sampleBook, onComplete }: LoadingScreenProps) {
  const complete = progress.percent >= 100
  const waitingForFirstStoredRow = progress.total > 0 && progress.processed === 0 && !complete

  return (
    <main className="loading-shell">
      <section className="loading-panel">
        <div className="loading-header">
          <BookOpen size={30} aria-hidden="true" />
          <div>
            <p className="eyebrow">도서관 장서 업무 보조 웹</p>
            <h1>소장목록을 준비하고 있습니다.</h1>
          </div>
        </div>

        <div className="progress-block">
          <div className="progress-meta">
            <span>{progress.stage}</span>
            <strong>{progress.percent}%</strong>
          </div>
          <div className="progress-track" aria-label="준비 진행률">
            <div style={{ width: `${progress.percent}%` }} />
          </div>
          <p>
            처리 건수 {progress.processed.toLocaleString()} / {progress.total.toLocaleString()}
          </p>
          {waitingForFirstStoredRow ? (
            <p className="muted">
              처음 여는 경우 파일 다운로드와 데이터 정리에 시간이 걸릴 수 있습니다. 저장이 시작되면 건수가 빠르게 올라갑니다.
            </p>
          ) : null}
          <p className="muted">{progress.message}</p>
        </div>

        <article className="book-card">
          <div className="book-card-icon">
            <BookOpen size={24} aria-hidden="true" />
          </div>
          <div>
            <h2>{sampleBook?.title ?? '샘플 소장자료'}</h2>
            <p>{sampleBook?.author ?? '소장자료를 불러오는 동안 표시되는 예시 카드입니다.'}</p>
            <p className="muted">{sampleBook?.publisher ?? '표지 이미지가 없는 경우 도서 기본정보만 표시합니다.'}</p>
          </div>
        </article>

        {complete && onComplete ? (
          <button type="button" className="primary-button wide-button" onClick={onComplete}>
            <CheckCircle2 size={18} aria-hidden="true" />
            홈으로 이동
          </button>
        ) : null}
      </section>
    </main>
  )
}
