import type { PropsWithChildren } from 'react'
import { useState, type ComponentType } from 'react'
import {
  Bookmark,
  BookOpen,
  CircleHelp,
  ClipboardList,
  Home,
  KeyRound,
  Library,
  Menu,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAppData } from '../lib/AppDataContext'

type NavItem = {
  to: string
  label: string
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
}

const navItems: NavItem[] = [
  { to: '/', label: '홈', icon: Home },
  { to: '/holdings', label: '소장목록 검색', icon: Search },
  { to: '/new-releases', label: '신간', icon: BookOpen },
  { to: '/purchase-review', label: '구입후보 검토', icon: ClipboardList },
  { to: '/selection-basis', label: '선정근거', icon: Bookmark },
  { to: '/aladin', label: '알라딘 조회', icon: KeyRound },
  { to: '/settings', label: '설정', icon: Settings },
  { to: '/help', label: '도움말', icon: CircleHelp },
]

function getStatusLabel(status?: string) {
  switch (status) {
    case 'ready':
      return '정상'
    case 'updating':
      return '갱신 중'
    case 'failed':
      return '확인 필요'
    case 'sample':
      return '샘플 데이터'
    default:
      return '대기 중'
  }
}

export function Layout({ children }: PropsWithChildren) {
  const { data } = useAppData()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const libraryName = data.meta?.libraryName ?? '공공도서관'
  const statusLabel = getStatusLabel(data.meta?.status)
  const statusClass = data.meta?.status === 'failed' ? 'is-warning' : data.meta?.status === 'ready' ? 'is-ready' : ''

  return (
    <div className="workbench-shell">
      <aside className={`workbench-sidebar${mobileNavOpen ? ' is-open' : ''}`}>
        <div className="workbench-sidebar-head">
          <Link className="workbench-brand" to="/" onClick={() => setMobileNavOpen(false)}>
            <span className="workbench-brand-mark" aria-hidden="true">
              <Library size={22} />
            </span>
            <strong>도서관 장서 워크벤치</strong>
          </Link>
          <button
            type="button"
            className="workbench-sidebar-close"
            aria-label="메뉴 닫기"
            onClick={() => setMobileNavOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="workbench-nav" aria-label="주요 업무 메뉴">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileNavOpen(false)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="workbench-sidebar-foot">
          <div className={`workbench-library-status ${statusClass}`}>
            <div>
              <strong>{libraryName}</strong>
              <span>{data.meta?.libraryCode ?? '도서관 코드 없음'}</span>
            </div>
            <span className="workbench-status-line">
              <i aria-hidden="true" />
              {statusLabel}
            </span>
          </div>
        </div>
      </aside>

      {mobileNavOpen ? (
        <button
          type="button"
          className="workbench-sidebar-scrim"
          aria-label="메뉴 닫기"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <div className="workbench-main-shell">
        <header className="workbench-mobile-header">
          <button
            type="button"
            className="workbench-menu-button"
            aria-expanded={mobileNavOpen}
            aria-label="메뉴 열기"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <Link className="workbench-mobile-brand" to="/">
            <Library size={20} aria-hidden="true" />
            <strong>장서 워크벤치</strong>
          </Link>
          <span className={`workbench-mobile-status ${statusClass}`} aria-label={`데이터 상태 ${statusLabel}`} />
        </header>

        {data.warning ? <div className="workbench-warning" role="status">{data.warning}</div> : null}

        <main className="workbench-main">{children}</main>

        <footer className="workbench-footer">
          <span>Library Collection Workbench</span>
          <span>기준일 {data.meta?.baseDate ?? '-'} · {data.totalCount.toLocaleString()}권</span>
        </footer>
      </div>
    </div>
  )
}
