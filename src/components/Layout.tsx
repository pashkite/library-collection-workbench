import type { PropsWithChildren } from 'react'
import { useState } from 'react'
import { Bookmark, BookOpen, CircleHelp, ClipboardList, KeyRound, LayoutGrid, Library, List, Menu, Search, Settings, X } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAppData } from '../lib/AppDataContext'
import { kdcCollections } from '../lib/kdcCollections'

const tools = [
  { to: '/holdings', label: '상세 검색', icon: Search },
  { to: '/purchase-review', label: '구입후보 검토', icon: ClipboardList },
  { to: '/selection-basis', label: '선정근거', icon: Bookmark },
  { to: '/aladin', label: '알라딘 조회', icon: KeyRound },
  { to: '/settings', label: '설정', icon: Settings },
  { to: '/help', label: '도움말', icon: CircleHelp },
]

export function Layout({ children }: PropsWithChildren) {
  const { data } = useAppData()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isCollection = location.pathname === '/'
  const view = params.get('view') === 'list' ? 'list' : 'grid'
  const kdc = params.get('kdc') ?? ''
  const statusLabel = data.meta?.status === 'ready' ? '정상' : data.meta?.status === 'failed' ? '확인 필요' : data.meta?.status === 'sample' ? '샘플 데이터' : '확인 중'

  function collectionLink(key: string, value: string) {
    const next = isCollection ? new URLSearchParams(params) : new URLSearchParams()
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    return `/?${next.toString()}`
  }

  return <div className="workbench-shell">
    <aside id="workbench-sidebar" className={`workbench-sidebar${mobileNavOpen ? ' is-open' : ''}`}>
      <div className="workbench-sidebar-head"><Link className="workbench-brand" to="/" onClick={() => setMobileNavOpen(false)}><Library size={24} /><strong>Workbench</strong></Link><button className="workbench-sidebar-close" aria-label="메뉴 닫기" onClick={() => setMobileNavOpen(false)}><X size={20} /></button></div>
      <nav className="workbench-nav" aria-label="주요 업무 메뉴">
        <section><h2>보기 방식</h2>{[{id: 'grid', label: '격자 보기', icon: LayoutGrid}, {id: 'list', label: '목록 보기', icon: List}].map((item) => <Link key={item.id} className={isCollection && view === item.id ? 'active' : ''} to={collectionLink('view', item.id)} onClick={() => setMobileNavOpen(false)}><item.icon size={18} /><span>{item.label}</span></Link>)}</section>
        <section><h2>도서관</h2><Link to={`/?view=${view}`} className={isCollection && !kdc ? 'active' : ''} onClick={() => setMobileNavOpen(false)}><Library size={18} /><span>전체 소장도서</span><small>{data.totalCount.toLocaleString()}</small></Link><NavLink to="/new-releases" onClick={() => setMobileNavOpen(false)}><BookOpen size={18} /><span>신간도서</span></NavLink></section>
        <section><h2>KDC 분류</h2>{kdcCollections.map((item) => <Link key={item.id} to={collectionLink('kdc', item.id)} className={isCollection && kdc === item.id ? 'active' : ''} onClick={() => setMobileNavOpen(false)}><i className={`collection-category-dot cover-tone-${item.id}`} /><span>{item.id}00 {item.name}</span></Link>)}</section>
        <section><h2>업무 도구</h2>{tools.map((item) => <NavLink key={item.to} to={item.to} onClick={() => setMobileNavOpen(false)}><item.icon size={18} /><span>{item.label}</span></NavLink>)}</section>
      </nav>
      <div className="workbench-sidebar-foot"><strong>{data.meta?.libraryName ?? '공공도서관'}</strong><span><i className={data.meta?.status === 'failed' ? 'is-warning' : ''} />데이터 {statusLabel} · {data.meta?.baseDate ?? '-'}</span></div>
    </aside>
    {mobileNavOpen ? <button className="workbench-sidebar-scrim" aria-label="메뉴 닫기" onClick={() => setMobileNavOpen(false)} /> : null}
    <div className="workbench-main-shell">
      <header className="workbench-topbar">
        <button className="workbench-menu-button" aria-controls="workbench-sidebar" aria-expanded={mobileNavOpen} aria-label="메뉴 열기" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
        <form className="workbench-global-search" role="search" onSubmit={(event) => { event.preventDefault(); const next = new URLSearchParams(); if (query.trim()) next.set('q', query.trim()); if (isCollection && kdc) next.set('kdc', kdc); next.set('view', view); navigate(`/?${next.toString()}`) }}>
          <Search size={17} aria-hidden="true" /><input aria-label="소장도서 통합 검색" placeholder="도서명, 저자, 출판사, ISBN 검색" value={query} onChange={(event) => setQuery(event.target.value)} /><button type="submit">검색</button>
        </form>
        <Link className="workbench-review-link primary-button" to="/purchase-review"><ClipboardList size={16} /><span>구입후보 검토</span></Link>
      </header>
      {data.warning ? <div className="workbench-warning" role="status">{data.warning}</div> : null}
      <main className="workbench-main">{children}</main>
      <footer className="workbench-footer"><span>Library Collection Workbench</span><span>기준일 {data.meta?.baseDate ?? '-'} · {data.totalCount.toLocaleString()}권</span></footer>
    </div>
  </div>
}
