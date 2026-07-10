import { ArrowRight, Database, ListChecks, MousePointer2, Search, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/useGameStore'
import { useAppData } from '../../lib/AppDataContext'

const stationHelp = [
  { key: '01', label: '서가', detail: '장서 수집 현황' },
  { key: '02', label: '책상', detail: '도서 검색' },
  { key: '03', label: '게시판', detail: '오늘의 업무' },
]

export function LobbyPage() {
  const resources = useGameStore((state) => state.resources)
  const setPage = useGameStore((state) => state.setPage)
  const missions = useGameStore((state) => state.missions)
  const { data } = useAppData()
  const navigate = useNavigate()

  const completedMissions = missions.filter((mission) => mission.completed).length
  const expPercent = Math.min(100, Math.round((resources.exp / resources.expMax) * 100))

  const goGame = (page: Parameters<typeof setPage>[0], path: string) => {
    setPage(page)
    navigate(path)
  }

  const goHoldings = () => {
    setPage('search')
    navigate('/holdings')
  }

  return (
    <div className="lobby-command page-enter">
      <section className="lobby-brief" aria-labelledby="lobby-title">
        <p className="hud-kicker">DALSEONG ARCHIVE · LIVE HOLDINGS</p>
        <h1 id="lobby-title">
          장서관리
          <span>지휘실</span>
        </h1>
        <p className="lobby-lead">
          서가와 업무 스테이션을 직접 클릭해 이동하세요. 실무 도구는 실제 소장 데이터와 연결됩니다.
        </p>

        <div className="interaction-hint">
          <MousePointer2 size={18} aria-hidden="true" />
          <span><strong>3D 오브젝트 클릭</strong> · 마우스를 움직이면 시점이 반응합니다.</span>
        </div>

        <div className="lobby-primary-actions">
          <button type="button" className="command-primary" onClick={goHoldings}>
            <Search size={17} />
            실무 소장검색
            <ArrowRight size={16} />
          </button>
          <button type="button" className="command-secondary" onClick={() => goGame('missions', '/game/missions')}>
            <ListChecks size={17} />
            오늘의 업무
          </button>
        </div>
      </section>

      <aside className="lobby-telemetry" aria-label="장서관리 현황">
        <div className="telemetry-status">
          <span className="live-pulse" aria-hidden="true" />
          <span>LIVE DATA CONNECTED</span>
          <small>{data.meta?.baseDate ?? '기준일 확인 중'}</small>
        </div>

        <div className="telemetry-grid">
          <article>
            <Database size={17} aria-hidden="true" />
            <span>소장 데이터</span>
            <strong>{data.totalCount.toLocaleString()}권</strong>
          </article>
          <article>
            <ListChecks size={17} aria-hidden="true" />
            <span>오늘의 업무</span>
            <strong>{completedMissions}/{missions.length}</strong>
          </article>
          <article>
            <Sparkles size={17} aria-hidden="true" />
            <span>사서 등급</span>
            <strong>Lv.{resources.level}</strong>
          </article>
        </div>

        <div className="rank-progress" aria-label={`경험치 ${expPercent}%`}>
          <div>
            <span>{resources.title}</span>
            <strong>{resources.exp.toLocaleString()} / {resources.expMax.toLocaleString()} EXP</strong>
          </div>
          <div className="rank-track"><span style={{ width: `${expPercent}%` }} /></div>
        </div>

        <div className="station-legend" aria-label="3D 스테이션 안내">
          {stationHelp.map((item) => (
            <div key={item.key}>
              <span>{item.key}</span>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
      </aside>

      <div className="mobile-station-grid" aria-label="모바일 업무 스테이션">
        <button type="button" onClick={() => goGame('collection', '/game/collection')}>
          <LibraryStationIcon kind="collection" />
          <span><strong>장서 수집실</strong><small>수집률과 분야 현황</small></span>
        </button>
        <button type="button" onClick={() => goGame('search', '/game/search')}>
          <LibraryStationIcon kind="search" />
          <span><strong>검색 기록실</strong><small>도서 탐색과 검색</small></span>
        </button>
        <button type="button" onClick={() => goGame('missions', '/game/missions')}>
          <LibraryStationIcon kind="mission" />
          <span><strong>오늘의 업무</strong><small>미션과 진행 보상</small></span>
        </button>
      </div>
    </div>
  )
}

function LibraryStationIcon({ kind }: { kind: 'collection' | 'search' | 'mission' }) {
  if (kind === 'search') return <Search size={19} aria-hidden="true" />
  if (kind === 'mission') return <ListChecks size={19} aria-hidden="true" />
  return <Database size={19} aria-hidden="true" />
}
