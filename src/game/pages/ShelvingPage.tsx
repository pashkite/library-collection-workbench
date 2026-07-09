import { GameButton } from '../components/GameButton'
import { GameHeader } from '../components/GameHeader'
import { GlassPanel } from '../components/GlassPanel'
import { useGameStore } from '../store/useGameStore'

export function ShelvingPage() {
  const shelves = useGameStore((s) => s.shelves)
  const selectedShelfId = useGameStore((s) => s.selectedShelfId)
  const selectShelf = useGameStore((s) => s.selectShelf)
  const placeBookOnShelf = useGameStore((s) => s.placeBookOnShelf)
  const selected = shelves.find((s) => s.id === selectedShelfId) ?? shelves[0]
  const rate = Math.round((selected.occupied / selected.capacity) * 1000) / 10

  return (
    <div className="shelving-layout page-enter">
      <GlassPanel className="shelf-map" style={{ padding: 16 }}>
        <GameHeader title="서가 배치" subtitle="3D 서가 맵에서 배치 위치를 고르세요. 선택 서가는 보라 glow로 강조됩니다." />
        <div className="camera-controls">
          <GameButton variant="ghost">⟲ 회전</GameButton>
          <GameButton variant="ghost">＋ 확대</GameButton>
          <GameButton variant="ghost">－ 축소</GameButton>
          <GameButton variant="ghost">⌂ 리셋</GameButton>
        </div>
        <div className="shelf-map-inner" style={{ pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 70, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {shelves.map((shelf) => (
            <button
              key={shelf.id}
              type="button"
              className={`chip ${selectedShelfId === shelf.id ? 'active' : ''}`}
              onClick={() => selectShelf(shelf.id)}
            >
              {shelf.name}
            </button>
          ))}
        </div>
      </GlassPanel>

      <div className="stack">
        <GlassPanel style={{ padding: 18 }} strong>
          <h3 style={{ marginBottom: 12 }}>서가 정보</h3>
          <div className="info-list">
            <div>
              <span>서가명</span>
              <strong>{selected.name}</strong>
            </div>
            <div>
              <span>분류</span>
              <strong>{selected.category}</strong>
            </div>
            <div>
              <span>수용량</span>
              <strong>{selected.capacity}권</strong>
            </div>
            <div>
              <span>점유율</span>
              <strong>
                {selected.occupied}권 ({rate}%)
              </strong>
            </div>
            <div>
              <span>현재 위치</span>
              <strong>{selected.room}</strong>
            </div>
          </div>
          <div className="progress" style={{ margin: '12px 0 16px' }}>
            <span style={{ width: `${rate}%` }} />
          </div>
          <GameButton variant="gold" onClick={placeBookOnShelf}>
            도서 배치하기
          </GameButton>
        </GlassPanel>

        <GlassPanel style={{ padding: 16 }}>
          <h4 style={{ marginBottom: 10 }}>서가 목록</h4>
          <div className="stack">
            {shelves.map((shelf) => (
              <button
                key={shelf.id}
                type="button"
                className={`menu-card glass shelf-card ${selectedShelfId === shelf.id ? 'selected' : ''}`}
                onClick={() => selectShelf(shelf.id)}
              >
                <span className="icon">🗄️</span>
                <div style={{ textAlign: 'left' }}>
                  <strong>{shelf.name}</strong>
                  <p className="muted">{shelf.room}</p>
                </div>
                <span className="muted">{Math.round((shelf.occupied / shelf.capacity) * 100)}%</span>
              </button>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
