import type { PropsWithChildren } from 'react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BookMarked,
  BookOpen,
  ClipboardCheck,
  HelpCircle,
  Home,
  Library,
  Menu,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { useAppData } from '../lib/AppDataContext'

const navItems = [
  { to: '/', label: '홈', icon: Home, group: 'main' },
  { to: '/holdings', label: '소장도서 조회', icon: Search, group: 'work' },
  { to: '/new-releases', label: '신간도서 조회', icon: BookOpen, group: 'work' },
  { to: '/purchase-review', label: '구입 후보 검토', icon: ClipboardCheck, group: 'work' },
  { to: '/selection-basis', label: '도서 선정 근거 확인', icon: BookMarked, group: 'work' },
  { to: '/aladin', label: '알라딘 상세정보 조회', icon: Library, group: 'work' },
  { to: '/settings', label: '설정', icon: Settings, group: 'system' },
  { to: '/help', label: '도움말', icon: HelpCircle, group: 'system' },
]

export function Layout({ children }: PropsWithChildren) {
  const { data } = useAppData()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const mainItems = navItems.filter((item) => item.group === 'main')
  const workItems = navItems.filter((item) => item.group === 'work')
  const systemItems = navItems.filter((item) => item.group === 'system')

  const renderNav = (items: typeof navItems) =>
    items.map((item) => {
      const Icon = item.icon
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={() => setMobileNavOpen(false)}
        >
          <span className="nav-icon" aria-hidden="true">
            <Icon size={17} />
          </span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      )
    })

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileNavOpen ? ' nav-open' : ''}`}>
        <div className="brand">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              <Library size={20} />
            </span>
            <div>
              <strong>장서 업무 보조</strong>
              <span>종합자료실 Workbench</span>
            </div>
          </div>
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-controls="main-navigation"
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? '주요 메뉴 닫기' : '주요 메뉴 열기'}
            onClick={() => setMobileNavOpen((value) => !value)}
          >
            {mobileNavOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>

        <nav id="main-navigation" aria-label="주요 메뉴">
          <div className="nav-group">{renderNav(mainItems)}</div>
          <div className="nav-group">
            <p className="nav-group-label">업무</p>
            {renderNav(workItems)}
          </div>
          <div className="nav-group">
            <p className="nav-group-label">시스템</p>
            {renderNav(systemItems)}
          </div>
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-pill">Public Library</span>
          <p>소장 · 신간 · 구입 · 선정 업무를 한 화면에서</p>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-copy">
            <p className="topbar-kicker">{data.meta?.libraryName ?? '공공도서관'}</p>
            <strong>
              기준일 {data.meta?.baseDate ?? '-'}
              <span className="topbar-sep" aria-hidden="true">
                ·
              </span>
              {data.totalCount.toLocaleString()}권
            </strong>
          </div>
          {data.warning ? <span className="warning-chip">{data.warning}</span> : null}
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}
