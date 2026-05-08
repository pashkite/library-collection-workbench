import { Activity, BookOpen, CheckCircle2, Database, Radio } from 'lucide-react'
import type { BootstrapProgress, StoredBookHolding } from '../types/library'

interface LoadingScreenProps {
  progress: BootstrapProgress
  sampleBook?: StoredBookHolding
  onComplete?: () => void
}

export function LoadingScreen({ progress, sampleBook, onComplete }: LoadingScreenProps) {
  const displayPercent = Math.max(0, Math.min(100, progress.percent))
  const complete = displayPercent >= 100
  const waitingForFirstStoredRow = progress.total > 0 && progress.processed === 0 && !complete
  const processedLabel = progress.processed.toLocaleString()
  const totalLabel = progress.total.toLocaleString()
  const storedProgress = progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0
  const signalCells = Array.from({ length: 96 }, (_, index) => index)
  const telemetry = [
    {
      icon: Database,
      label: 'INDEX',
      value: `${processedLabel} / ${totalLabel}`,
      amount: storedProgress,
    },
    {
      icon: Activity,
      label: 'STAGE',
      value: progress.stage || '준비 중',
      amount: displayPercent,
    },
    {
      icon: Radio,
      label: 'SIGNAL',
      value: complete ? '동기화 완료' : waitingForFirstStoredRow ? '초기 수신 대기' : '데이터 수신 중',
      amount: complete ? 100 : Math.max(18, Math.min(96, displayPercent + 14)),
    },
  ]

  return (
    <main className={`loading-shell${complete ? ' is-complete' : ''}`} aria-busy={!complete}>
      <div className="loading-noise" aria-hidden="true" />

      <section className="loading-stage" aria-label="소장목록 준비 상태">
        <div className="signal-visual" aria-hidden="true">
          <div className="signal-topline">
            <span>LIBRARY SIGNAL</span>
            <span>{complete ? 'LOCKED' : 'SCANNING'}</span>
          </div>
          <div className="signal-grid">
            {signalCells.map((cell) => (
              <span
                key={cell}
                className={cell % 11 === 0 ? 'is-hot' : cell % 5 === 0 ? 'is-mid' : undefined}
                style={{ animationDelay: `${(cell % 16) * 60}ms` }}
              />
            ))}
          </div>
          <div className="signal-core">
            <span>{displayPercent}</span>
            <small>%</small>
          </div>
          <div className="signal-scanline" />
          <div className="signal-caption">
            <span>HOLDINGS BOOT</span>
            <span>{processedLabel} ROWS</span>
          </div>
        </div>

        <section className="loading-panel">
          <div className="loading-header">
            <div className="loading-mark">
              <BookOpen size={26} aria-hidden="true" />
            </div>
            <div>
              <p className="eyebrow">도서관 장서 업무 보조 웹</p>
              <h1>소장목록을 읽어 들이는 중입니다.</h1>
              <p>대량 데이터도 멈춘 것처럼 보이지 않도록 처리 단계와 저장 건수를 실시간으로 표시합니다.</p>
            </div>
          </div>

          <div className="progress-block" role="status" aria-live="polite">
            <div className="progress-meta">
              <span>{progress.stage}</span>
              <strong>{displayPercent}%</strong>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="준비 진행률"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={displayPercent}
            >
              <div style={{ width: `${displayPercent}%` }} />
            </div>
            <p>
              처리 건수 {processedLabel} / {totalLabel}
            </p>
            {waitingForFirstStoredRow ? (
              <p className="muted">
                처음 여는 경우 파일 다운로드와 데이터 정리에 시간이 걸릴 수 있습니다. 저장이 시작되면 건수가 빠르게 올라갑니다.
              </p>
            ) : null}
            <p className="muted">{progress.message}</p>
          </div>

          <div className="loading-telemetry" aria-label="로딩 세부 상태">
            {telemetry.map((item) => {
              const Icon = item.icon
              return (
                <div className="telemetry-row" key={item.label}>
                  <div className="telemetry-label">
                    <Icon size={16} aria-hidden="true" />
                    <span>{item.label}</span>
                  </div>
                  <strong>{item.value}</strong>
                  <div className="telemetry-bar" aria-hidden="true">
                    <span style={{ width: `${item.amount}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <article className="book-card">
            <div className="book-card-icon">
              <BookOpen size={24} aria-hidden="true" />
            </div>
            <div>
              <p className="book-card-kicker">현재 샘플 도서</p>
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
      </section>
    </main>
  )
}
