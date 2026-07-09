import { tipMessages } from '../data/mockData'
import { useGameStore } from '../store/useGameStore'

export function StatusFooter() {
  const tipIndex = useGameStore((s) => s.tipIndex)
  const nextTip = useGameStore((s) => s.nextTip)

  return (
    <footer className="status-footer">
      <button type="button" className="game-button ghost" style={{ minHeight: 28, padding: '0 10px' }} onClick={nextTip}>
        TIP · {tipMessages[tipIndex]}
      </button>
      <div>
        <span className="status-dot" aria-hidden="true" />
        All systems operational
      </div>
    </footer>
  )
}
