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
  { to: '/', label: '홈', icon: Home },
  { to: '/holdings', label: '소장도서 조회', icon: Search },
  { to: '/new-releases', label: '신간도서 조회', icon: BookOpen },
  { to: '/purchase-review', label: '구입 후보 검토', icon: ClipboardCheck },
  { to: '/selection-basis', label: '도서 선정 근거 확인', icon: BookMarked },
  { to: '/aladin', label: '알라딘 상세정보 조회', icon: Library },
  { to: '/settings', label: '설정', icon: Settings },
  { to: '/help', label: '도움말', icon: HelpCircle },
]

export function Layout({ children }: PropsWithChildren) {
  const { data } = useAppData()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileNavOpen ? ' nav-open' : ''}`}>
        <div className="brand">
          <div className="brand-lockup">
            <Library size={26} aria-hidden="true" />
            <div>
              <strong>장서 업무 보조</strong>
              <span>종합자료실</span>
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
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileNavOpen(false)}>
                <Icon size={17} aria-hidden="true" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div>
            <p>{data.meta?.libraryName ?? '공공도서관'}</p>
            <strong>
              기준일 {data.meta?.baseDate ?? '-'} · {data.totalCount.toLocaleString()}권
            </strong>
          </div>
          {data.warning ? <span className="warning-chip">{data.warning}</span> : null}
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}
