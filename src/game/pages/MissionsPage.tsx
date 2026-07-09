import { GameButton } from '../components/GameButton'
import { GameHeader } from '../components/GameHeader'
import { GlassPanel } from '../components/GlassPanel'
import { useGameStore } from '../store/useGameStore'
import type { MissionTab } from '../types'

const tabs: { id: MissionTab; label: string }[] = [
  { id: 'daily', label: '일일 업무' },
  { id: 'weekly', label: '주간 업무' },
  { id: 'event', label: '이벤트' },
]

export function MissionsPage() {
  const missions = useGameStore((s) => s.missions)
  const tab = useGameStore((s) => s.missionTab)
  const setTab = useGameStore((s) => s.setMissionTab)
  const completeMission = useGameStore((s) => s.completeMission)
  const resources = useGameStore((s) => s.resources)

  const list = missions.filter((m) => m.tab === tab)
  const completedCount = missions.filter((m) => m.completed).length
  const rewardProgress = Math.min(500, 350 + completedCount * 30)

  return (
    <div className="missions-layout page-enter">
      <GlassPanel style={{ padding: 18 }}>
        <GameHeader title="업무 / 미션" subtitle="일일·주간·이벤트 업무를 클리어하고 보상을 획득하세요." />
        <div className="tab-row" style={{ marginBottom: 14 }}>
          {tabs.map((t) => (
            <button key={t.id} type="button" className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="stack">
          {list.map((mission) => {
            const pct = Math.round((mission.current / mission.target) * 100)
            return (
              <article key={mission.id} className="mission-card glass">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong>{mission.title}</strong>
                  <span className="muted">
                    {mission.current}/{mission.target}
                  </span>
                </div>
                <div className="progress">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    보상 +{mission.rewardExp} EXP · +{mission.rewardGold}G
                  </span>
                  <GameButton
                    variant={mission.completed ? 'ghost' : 'gold'}
                    disabled={mission.completed}
                    onClick={() => completeMission(mission.id)}
                  >
                    {mission.completed ? '완료' : '진행중 / 완료하기'}
                  </GameButton>
                </div>
              </article>
            )
          })}
        </div>
      </GlassPanel>

      <GlassPanel style={{ padding: 18 }} strong>
        <h3 style={{ marginBottom: 12 }}>미션 보상</h3>
        <div style={{ fontSize: 56, textAlign: 'center', margin: '12px 0' }}>🧰</div>
        <p style={{ textAlign: 'center', fontWeight: 800, marginBottom: 8 }}>다음 보상까지</p>
        <div className="progress" style={{ marginBottom: 8 }}>
          <span style={{ width: `${(rewardProgress / 500) * 100}%` }} />
        </div>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 16 }}>
          {rewardProgress} / 500 EXP 포인트
        </p>
        <div className="level-bar glass" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800 }}>
            <span>사서 EXP</span>
            <span>
              {resources.exp}/{resources.expMax}
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${(resources.exp / resources.expMax) * 100}%` }} />
          </div>
        </div>
        <GameButton style={{ width: '100%' }}>보상 상자 열기</GameButton>
      </GlassPanel>
    </div>
  )
}
