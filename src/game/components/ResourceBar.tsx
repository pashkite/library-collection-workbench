import { useGameStore } from '../store/useGameStore'

export function ResourceBar() {
  const resources = useGameStore((s) => s.resources)

  return (
    <div className="resource-bar" aria-label="게임 재화">
      <span className="resource-chip gold">🪙 {resources.gold.toLocaleString()}</span>
      <span className="resource-chip gem">💎 {resources.gems.toLocaleString()}</span>
      <span className="resource-chip energy">
        ⚡ {resources.energy}/{resources.energyMax}
      </span>
    </div>
  )
}
