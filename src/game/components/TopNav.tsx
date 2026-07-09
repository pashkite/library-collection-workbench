import { Bell, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ResourceBar } from './ResourceBar'
import { useGameStore } from '../store/useGameStore'
import type { PageId } from '../types'

const navItems: { id: PageId; label: string; path: string }[] = [
  { id: 'lobby', label: '로비', path: '/' },
  { id: 'collection', label: '도서 수집', path: '/game/collection' },
  { id: 'search', label: '도서 검색', path: '/game/search' },
  { id: 'detail', label: '도서 상세', path: '/game/detail' },
  { id: 'shelving', label: '서가 배치', path: '/game/shelving' },
  { id: 'missions', label: '업무/미션', path: '/game/missions' },
  { id: 'inventory', label: '인벤토리', path: '/game/inventory' },
  { id: 'stats', label: '통계/설정', path: '/game/stats' },
]

export function TopNav() {
  const page = useGameStore((s) => s.page)
  const setPage = useGameStore((s) => s.setPage)
  const resources = useGameStore((s) => s.resources)
  const setSearchQuery = useGameStore((s) => s.setSearchQuery)
  const navigate = useNavigate()

  const go = (id: PageId, path: string) => {
    setPage(id)
    navigate(path)
  }

  return (
    <header className="top-nav">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          LC
        </div>
        <div>
          <strong>Library Collection Workbench</strong>
          <span>마법 도서관 · 실무 장서 관리</span>
        </div>
      </div>

      <nav className="nav-links" aria-label="주요 메뉴">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={page === item.id ? 'active' : undefined}
            onClick={() => go(item.id, item.path)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="nav-right">
        <label className="nav-search">
          <Search size={15} aria-hidden="true" />
          <input
            placeholder="빠른 검색..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearchQuery((e.target as HTMLInputElement).value)
                go('search', '/game/search')
              }
            }}
          />
        </label>
        <ResourceBar />
        <button
          type="button"
          className="game-button ghost"
          aria-label="알림"
          style={{ minHeight: 38, padding: '0 10px' }}
        >
          <Bell size={16} />
        </button>
        <div className="profile-pill">
          <span className="avatar">Lv{resources.level}</span>
          <div>
            <strong style={{ fontSize: 12 }}>{resources.title}</strong>
            <small>
              EXP {resources.exp}/{resources.expMax}
            </small>
          </div>
        </div>
      </div>
    </header>
  )
}
