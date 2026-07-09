import { monthlyNewBooks } from '../data/mockData'
import { GameButton } from '../components/GameButton'
import { GameHeader } from '../components/GameHeader'
import { GlassPanel } from '../components/GlassPanel'
import { useGameStore } from '../store/useGameStore'

export function StatsSettingsPage() {
  const resources = useGameStore((s) => s.resources)
  const books = useGameStore((s) => s.books)
  const shelves = useGameStore((s) => s.shelves)
  const missions = useGameStore((s) => s.missions)
  const settings = useGameStore((s) => s.settings)
  const updateSettings = useGameStore((s) => s.updateSettings)
  const saveSettings = useGameStore((s) => s.saveSettings)

  const maxVal = Math.max(...monthlyNewBooks.map((d) => d.value))
  const points = monthlyNewBooks
    .map((d, i) => {
      const x = (i / (monthlyNewBooks.length - 1)) * 100
      const y = 100 - (d.value / maxVal) * 80 - 10
      return `${x},${y}`
    })
    .join(' ')

  const completedMissions = missions.filter((m) => m.completed).length

  return (
    <div className="stats-layout page-enter">
      <GlassPanel style={{ padding: 18 }}>
        <GameHeader title="통계" subtitle="도서관 성장 지표와 최근 입수 추이" />
        <div className="grid-2" style={{ marginBottom: 14 }}>
          <article className="stat-card glass">
            <p className="muted">도서관 레벨</p>
            <strong style={{ fontSize: 28 }}>Lv. {resources.level}</strong>
          </article>
          <article className="stat-card glass">
            <p className="muted">보유 도서</p>
            <strong style={{ fontSize: 28 }}>{books.filter((b) => b.collected).length}</strong>
          </article>
          <article className="stat-card glass">
            <p className="muted">총 서가 수</p>
            <strong style={{ fontSize: 28 }}>{shelves.length}</strong>
          </article>
          <article className="stat-card glass">
            <p className="muted">완료 업무</p>
            <strong style={{ fontSize: 28 }}>{completedMissions}</strong>
          </article>
        </div>

        <div className="level-bar glass" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span>다음 레벨까지</span>
            <span>
              {resources.exp} / {resources.expMax} EXP
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${(resources.exp / resources.expMax) * 100}%` }} />
          </div>
        </div>

        <h4 style={{ marginBottom: 8 }}>일별 신규 도서 수</h4>
        <div className="line-chart glass">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline fill="none" stroke="#8b6cff" strokeWidth="1.5" points={points} />
            <polyline fill="rgba(76,201,240,0.15)" stroke="none" points={`0,100 ${points} 100,100`} />
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }} className="muted">
          {monthlyNewBooks.map((d) => (
            <span key={d.day} style={{ fontSize: 11 }}>
              {d.day}
            </span>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel style={{ padding: 18 }} strong>
        <GameHeader title="설정" subtitle="오디오, 알림, 품질 옵션" />
        {(
          [
            ['bgm', '배경 음악'],
            ['sfx', '효과음'],
            ['notifications', '알림'],
            ['vibration', '화면 진동'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="toggle-row">
            <span>{label}</span>
            <button
              type="button"
              className={`switch ${settings[key] ? 'on' : ''}`}
              onClick={() => updateSettings({ [key]: !settings[key] })}
              aria-label={label}
            >
              <span />
            </button>
          </div>
        ))}

        <div className="field" style={{ marginTop: 14 }}>
          <label>언어</label>
          <select value={settings.language} onChange={(e) => updateSettings({ language: e.target.value as 'ko' | 'en' })}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>화질</label>
          <select
            value={settings.quality}
            onChange={(e) => updateSettings({ quality: e.target.value as 'low' | 'medium' | 'high' })}
          >
            <option value="low">낮음</option>
            <option value="medium">중간</option>
            <option value="high">높음</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <GameButton variant="ghost" style={{ flex: 1 }}>
            계정 관리
          </GameButton>
          <GameButton variant="gold" style={{ flex: 1 }} onClick={saveSettings}>
            저장하기
          </GameButton>
        </div>
      </GlassPanel>
    </div>
  )
}
