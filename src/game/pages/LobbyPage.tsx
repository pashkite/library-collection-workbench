import { useNavigate } from 'react-router-dom'
import { GameButton } from '../components/GameButton'
import { GlassPanel } from '../components/GlassPanel'
import { useGameStore } from '../store/useGameStore'
import { useAppData } from '../../lib/AppDataContext'

export function LobbyPage() {
  const resources = useGameStore((s) => s.resources)
  const setPage = useGameStore((s) => s.setPage)
  const { data } = useAppData()
  const navigate = useNavigate()
  const expPct = Math.round((resources.exp / resources.expMax) * 100)

  const goGame = (page: Parameters<typeof setPage>[0], path: string) => {
    setPage(page)
    navigate(path)
  }

  return (
    <div className="lobby-hero page-enter">
      <GlassPanel className="lobby-copy" strong>
        <p className="eyebrow">Main Lobby · Magical Library + Live Holdings</p>
        <h1>
          Library
          <span>Collection Workbench</span>
        </h1>
        <p className="muted" style={{ maxWidth: 540, fontSize: 15, lineHeight: 1.7 }}>
          지식의 보관과 관리, 당신의 도서관을 성장시키세요. 게임형 UI로 장서 업무를 보고,
          하단 실무 도크로 실제 소장목록·구입검토 기능에 바로 들어갈 수 있습니다.
        </p>

        <div className="level-bar glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, gap: 12, flexWrap: 'wrap' }}>
            <span>
              도서관 등급 Lv.{resources.level} {resources.title}
            </span>
            <span style={{ color: 'var(--gold)' }}>
              실데이터 {data.totalCount.toLocaleString()}권 · {data.meta?.baseDate ?? '-'}
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${expPct}%` }} />
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            EXP {resources.exp}/{resources.expMax}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <GameButton variant="gold" onClick={() => goGame('missions', '/game/missions')}>
            업무 시작하기
          </GameButton>
          <GameButton variant="ghost" onClick={() => navigate('/holdings')}>
            실무 소장검색 열기
          </GameButton>
          <GameButton variant="ghost" onClick={() => goGame('collection', '/game/collection')}>
            수집 현황 보기
          </GameButton>
        </div>
      </GlassPanel>

      <div className="lobby-side">
        {[
          { title: '수집 현황', desc: '장서 수집률과 분야 분포', action: () => goGame('collection', '/game/collection'), icon: '📚' },
          { title: '오늘의 업무', desc: '일일 미션과 보상 확인', action: () => goGame('missions', '/game/missions'), icon: '📋' },
          { title: '실무 소장검색', desc: `${data.totalCount.toLocaleString()}권 IndexedDB`, action: () => navigate('/holdings'), icon: '🔎' },
          { title: '구입 후보 검토', desc: '엑셀 중복 검토 실무 도구', action: () => navigate('/purchase-review'), icon: '✅' },
        ].map((item) => (
          <button key={item.title} type="button" className="menu-card glass" onClick={item.action}>
            <span className="icon">{item.icon}</span>
            <div style={{ textAlign: 'left' }}>
              <strong>{item.title}</strong>
              <p className="muted">{item.desc}</p>
            </div>
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}
