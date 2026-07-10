import {
  BarChart3,
  BookOpenCheck,
  Compass,
  Database,
  FileSearch,
  Grid3X3,
  LibraryBig,
  ListChecks,
  Menu,
  PackageOpen,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResourceBar } from './ResourceBar'
import { useGameStore } from '../store/useGameStore'
import type { PageId } from '../types'

type GameNavItem = {
  id: PageId
  label: string
  shortLabel: string
  description: string
  path: string
  icon: LucideIcon
}

type WorkNavItem = {
  label: string
  description: string
  path: string
  icon: LucideIcon
}

const gameNavItems: GameNavItem[] = [
  { id: 'lobby', label: '중앙 지휘실', shortLabel: '로비', description: '모든 업무 스테이션을 한눈에 봅니다.', path: '/', icon: Compass },
  { id: 'collection', label: '장서 수집실', shortLabel: '수집', description: '수집률과 분야별 장서 현황을 확인합니다.', path: '/game/collection', icon: LibraryBig },
  { id: 'search', label: '검색 기록실', shortLabel: '검색', description: '게임형 서지 검색과 도서 탐색 화면입니다.', path: '/game/search', icon: FileSearch },
  { id: 'detail', label: '도서 감정실', shortLabel: '상세', description: '선택한 도서의 상세 상태를 확인합니다.', path: '/game/detail', icon: BookOpenCheck },
  { id: 'shelving', label: '서가 배치실', shortLabel: '서가', description: '서가 위치와 수용량을 조정합니다.', path: '/game/shelving', icon: Grid3X3 },
  { id: 'missions', label: '오늘의 업무', shortLabel: '미션', description: '일일 업무와 진행 보상을 관리합니다.', path: '/game/missions', icon: ListChecks },
  { id: 'inventory', label: '업무 도구함', shortLabel: '도구', description: '수집한 도구와 업무 아이템을 봅니다.', path: '/game/inventory', icon: PackageOpen },
  { id: 'stats', label: '통계 관측실', shortLabel: '통계', description: '성과와 게임 환경 설정을 확인합니다.', path: '/game/stats', icon: BarChart3 },
]

const workNavItems: WorkNavItem[] = [
  { label: '실무 소장검색', description: '실제 소장목록을 제목·저자·ISBN으로 조회', path: '/holdings', icon: Database },
  { label: '신간 조회', description: '기간과 KDC 기준으로 신간 필터링', path: '/new-releases', icon: Sparkles },
  { label: '구입 후보 검토', description: '엑셀 업로드와 소장 중복 검토', path: '/purchase-review', icon: ListChecks },
  { label: '선정 근거', description: '선정 기준표와 확인 링크 관리', path: '/selection-basis', icon: ScrollText },
  { label: '알라딘 상세', description: 'ISBN 기반 외부 서지 보조 조회', path: '/aladin', icon: FileSearch },
  { label: '데이터 설정', description: '캐시·백업·API 키 관리', path: '/settings', icon: Settings },
]

export function TopNav() {
  const page = useGameStore((state) => state.page)
  const setPage = useGameStore((state) => state.setPage)
  const setSearchQuery = useGameStore((state) => state.setSearchQuery)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const current = useMemo(
    () => gameNavItems.find((item) => item.id === page) ?? gameNavItems[0],
    [page],
  )

  useEffect(() => {
    setMenuOpen(false)
  }, [page])

  const goGame = (item: GameNavItem) => {
    setPage(item.id)
    navigate(item.path)
    setMenuOpen(false)
  }

  const goWork = (path: string) => {
    setPage(path === '/settings' ? 'stats' : 'search')
    navigate(path)
    setMenuOpen(false)
  }

  const submitSearch = () => {
    const trimmed = query.trim()
    if (!trimmed) return
    setSearchQuery(trimmed)
    setPage('search')
    navigate('/game/search')
    setMenuOpen(false)
  }

  return (
    <>
      <header className="command-hud" aria-label="도서관 지휘 메뉴">
        <button
          type="button"
          className="hud-brand"
          onClick={() => goGame(gameNavItems[0])}
          aria-label="중앙 지휘실로 이동"
        >
          <span className="hud-brand-mark" aria-hidden="true">LC</span>
          <span className="hud-brand-copy">
            <strong>Collection Workbench</strong>
            <small>{current.label}</small>
          </span>
        </button>

        <nav className="hud-quick-nav" aria-label="빠른 게임 메뉴">
          {gameNavItems.slice(0, 6).map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={page === item.id ? 'is-active' : undefined}
                onClick={() => goGame(item)}
                title={item.label}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{item.shortLabel}</span>
              </button>
            )
          })}
        </nav>

        <div className="hud-actions">
          <form
            className="hud-search"
            onSubmit={(event) => {
              event.preventDefault()
              submitSearch()
            }}
          >
            <Search size={15} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="도서명 빠른 검색"
              aria-label="도서명 빠른 검색"
            />
            <kbd>Enter</kbd>
          </form>
          <ResourceBar />
          <button
            type="button"
            className="hud-menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="command-drawer"
            aria-label={menuOpen ? '전체 메뉴 닫기' : '전체 메뉴 열기'}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <button
          type="button"
          className="command-drawer-backdrop"
          aria-label="전체 메뉴 닫기"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside id="command-drawer" className={`command-drawer${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen}>
        <div className="command-drawer-head">
          <div>
            <p className="hud-kicker">ARCHIVE COMMAND</p>
            <h2>업무 스테이션</h2>
          </div>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기">
            <X size={20} />
          </button>
        </div>

        <section>
          <p className="drawer-section-title">게임형 장서 관리</p>
          <div className="drawer-game-grid">
            {gameNavItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className={page === item.id ? 'is-active' : undefined}
                  onClick={() => goGame(item)}
                >
                  <span className="drawer-icon"><Icon size={19} /></span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <p className="drawer-section-title">실데이터 실무 도구</p>
          <div className="drawer-work-list">
            {workNavItems.map((item) => {
              const Icon = item.icon
              return (
                <button key={item.path} type="button" onClick={() => goWork(item.path)}>
                  <Icon size={18} aria-hidden="true" />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
              )
            })}
          </div>
        </section>
      </aside>
    </>
  )
}
