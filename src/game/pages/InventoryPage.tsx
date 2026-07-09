import { GameButton } from '../components/GameButton'
import { GameHeader } from '../components/GameHeader'
import { GlassPanel } from '../components/GlassPanel'
import { useGameStore } from '../store/useGameStore'
import type { InventoryTab } from '../types'

const tabs: { id: InventoryTab; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'consumable', label: '소모품' },
  { id: 'decor', label: '장식' },
  { id: 'material', label: '재료' },
  { id: 'other', label: '기타' },
]

export function InventoryPage() {
  const items = useGameStore((s) => s.items)
  const tab = useGameStore((s) => s.inventoryTab)
  const selectedItemId = useGameStore((s) => s.selectedItemId)
  const setTab = useGameStore((s) => s.setInventoryTab)
  const selectItem = useGameStore((s) => s.selectItem)
  const useItem = useGameStore((s) => s.useItem)

  const list = items.filter((i) => (tab === 'all' ? true : i.tab === tab))
  const selected = items.find((i) => i.id === selectedItemId) ?? items[0]

  return (
    <div className="inventory-layout page-enter">
      <GlassPanel style={{ padding: 18 }}>
        <GameHeader title="인벤토리" subtitle="아이템을 선택하고 사용하거나 장식에 배치하세요." />
        <div className="tab-row" style={{ marginBottom: 14 }}>
          {tabs.map((t) => (
            <button key={t.id} type="button" className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="item-grid">
          {list.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`item-card glass rarity-${item.rarity} ${selectedItemId === item.id ? 'selected' : ''}`}
              onClick={() => selectItem(item.id)}
            >
              <div className="emoji">{item.icon}</div>
              <strong style={{ fontSize: 12 }}>{item.name}</strong>
              <span className="muted" style={{ fontSize: 11 }}>
                x{item.quantity}
              </span>
            </button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel style={{ padding: 18 }} strong>
        <div style={{ fontSize: 48, textAlign: 'center' }}>{selected.icon}</div>
        <h3 style={{ textAlign: 'center', margin: '8px 0' }}>{selected.name}</h3>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 12 }}>
          희귀도: {selected.rarity}
        </p>
        <p style={{ lineHeight: 1.6, marginBottom: 12 }}>{selected.description}</p>
        <div className="info-list" style={{ marginBottom: 16 }}>
          <div>
            <span>보유 수량</span>
            <strong>{selected.quantity}</strong>
          </div>
          <div>
            <span>효과</span>
            <strong>{selected.effect ?? '-'}</strong>
          </div>
        </div>
        <GameButton variant="gold" style={{ width: '100%' }} disabled={selected.quantity <= 0} onClick={() => useItem(selected.id)}>
          사용하기
        </GameButton>
      </GlassPanel>
    </div>
  )
}
