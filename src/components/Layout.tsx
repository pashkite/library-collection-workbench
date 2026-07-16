import type { PropsWithChildren } from 'react'
import { useState } from 'react'
import { Library, Menu, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAppData } from '../lib/AppDataContext'

const navItems = [
  { to: '/', label: '장서 홈' },
  { to: '/holdings', label: '소장도서' },
  { to: '/new-releases', label: '신간도서' },
  { to: '/purchase-review', label: '구입검토' },
  { to: '/selection-basis', label: '선정근거' },
  { to: '/aladin', label: '알라딘 조회' },
  { to: '/settings', label: '설정' },
  { to: '/help', label: '도움말' },
]

function getStatusLabel(status?: string) {
  switch (status) {
    case 'ready':
      return '데이터 정상'
    case 'updating':
      return '데이터 갱신 중'
    case 'failed':
      return '데이터 확인 필요'
    case 'sample':
      return '샘플 데이터'
    default:
      return '데이터 대기 중'
  }
}

export function Layout({ children }: PropsWithChildren) {
  const { data } = useAppData()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const libraryName = data.meta?.libraryName ?? '공공도서관'
  const statusLabel = getStatusLabel(data.meta?.status)
  const statusClass = data.meta?.status === 'failed' ? 'is-warning' : data.meta?.status === 'ready' ? 'is-ready' : ''

  return (
    <div className="gallery-app">
      <header className="gallery-site-header">
        <div className="gallery-utility-bar">
          <div className="site-width gallery-utility-inner">
            <span>도서관 장서 업무 보조</span>
            <span>
              {libraryName} · 기준일 {data.meta?.baseDate ?? '-'} · {data.totalCount.toLocaleString()}권
            </span>
          </div>
        </div>

        <div className="site-width gallery-brand-row">
          <Link className="gallery-logo" to="/" onClick={() => setMobileNavOpen(false)}>
            <span className="gallery-logo-mark" aria-hidden="true">
              <Library size={25} />
            </span>
            <span className="gallery-logo-copy">
              <strong>장서업무 갤러리</strong>
              <small>LIBRARY COLLECTION BOARD</small>
            </span>
          </Link>

          <div className={`gallery-data-status ${statusClass}`}>
            <span className="gallery-status-dot" aria-hidden="true" />
            <span>{statusLabel}</span>
          </div>

          <button
            type="button"
            className="gallery-menu-button"
            aria-expanded={mobileNavOpen}
            aria-controls="gallery-main-navigation"
            aria-label={mobileNavOpen ? '메뉴 닫기' : '메뉴 열기'}
            onClick={() => setMobileNavOpen((value) => !value)}
          >
            {mobileNavOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>

        <nav
          id="gallery-main-navigation"
          className={`gallery-main-navigation${mobileNavOpen ? ' is-open' : ''}`}
          aria-label="주요 업무 메뉴"
        >
          <div className="site-width gallery-nav-inner">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileNavOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      {data.warning ? (
        <div className="gallery-warning-bar" role="status">
          <div className="site-width">{data.warning}</div>
        </div>
      ) : null}

      <div className="site-width gallery-content-wrap">
        <main className="gallery-main">{children}</main>
      </div>

      <footer className="gallery-footer">
        <div className="site-width">
          <strong>장서업무 갤러리</strong>
          <span>소장 · 신간 · 구입 · 선정 업무를 위한 내부 업무 보조 화면</span>
        </div>
      </footer>
    </div>
  )
}
