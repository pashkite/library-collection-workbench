import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorNoticeProps {
  title: string
  cause: string
  action: string
  retryLabel?: string
  secondaryLabel?: string
  onRetry?: () => void | Promise<void>
  onSecondary?: () => void | Promise<void>
}

export function ErrorNotice({
  title,
  cause,
  action,
  retryLabel = '다시 시도',
  secondaryLabel,
  onRetry,
  onSecondary,
}: ErrorNoticeProps) {
  return (
    <section className="error-notice" role="alert">
      <div className="notice-icon">
        <AlertTriangle size={22} aria-hidden="true" />
      </div>
      <div>
        <h2>{title}</h2>
        <p>
          <strong>원인</strong> {cause}
        </p>
        <p>
          <strong>해결 방법</strong> {action}
        </p>
        <div className="button-row">
          {onRetry ? (
            <button type="button" className="primary-button" onClick={() => void onRetry()}>
              <RefreshCw size={16} aria-hidden="true" />
              {retryLabel}
            </button>
          ) : null}
          {secondaryLabel && onSecondary ? (
            <button type="button" className="secondary-button" onClick={() => void onSecondary()}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
