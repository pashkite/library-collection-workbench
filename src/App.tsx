import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ErrorNotice } from './components/ErrorNotice'
import { LoadingScreen } from './components/LoadingScreen'
import { StatusFooter } from './game/components/StatusFooter'
import { TopNav } from './game/components/TopNav'
import { BookDetailPage } from './game/pages/BookDetailPage'
import { CollectionPage } from './game/pages/CollectionPage'
import { InventoryPage } from './game/pages/InventoryPage'
import { LobbyPage } from './game/pages/LobbyPage'
import { MissionsPage } from './game/pages/MissionsPage'
import { SearchPage } from './game/pages/SearchPage'
import { ShelvingPage } from './game/pages/ShelvingPage'
import { StatsSettingsPage } from './game/pages/StatsSettingsPage'
import { useGameStore } from './game/store/useGameStore'
import type { PageId } from './game/types'
import { AppDataContext } from './lib/AppDataContext'
import { bootstrapHoldings } from './lib/holdingsLoader'
import { getStoredDataInfo } from './lib/libraryDb'
import type { AppDataState, BootstrapProgress, DataMeta, StoredBookHolding } from './types/library'
import './game/styles/global.css'
import './index.css'

const ThreeScene = lazy(() =>
  import('./game/components/ThreeScene').then((m) => ({ default: m.ThreeScene })),
)
const HoldingsSearchPage = lazy(() =>
  import('./pages/HoldingsSearchPage').then((m) => ({ default: m.HoldingsSearchPage })),
)
const NewReleasesPage = lazy(() =>
  import('./pages/NewReleasesPage').then((m) => ({ default: m.NewReleasesPage })),
)
const PurchaseReviewPage = lazy(() =>
  import('./pages/PurchaseReviewPage').then((m) => ({ default: m.PurchaseReviewPage })),
)
const SelectionBasisPage = lazy(() =>
  import('./pages/SelectionBasisPage').then((m) => ({ default: m.SelectionBasisPage })),
)
const AladinDetailPage = lazy(() =>
  import('./pages/AladinDetailPage').then((m) => ({ default: m.AladinDetailPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const HelpPage = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })))

type BootstrapState =
  | { status: 'checking'; progress: BootstrapProgress; sampleBook?: StoredBookHolding }
  | { status: 'ready'; data: AppDataState }
  | {
      status: 'complete'
      data: AppDataState
      progress: BootstrapProgress
      sampleBook?: StoredBookHolding
    }
  | {
      status: 'error'
      title: string
      cause: string
      action: string
      canUsePreviousData: boolean
    }

const initialProgress: BootstrapProgress = {
  stage: '최신 데이터 확인 중...',
  percent: 0,
  processed: 0,
  total: 0,
  message: '소장목록을 준비하고 있습니다.',
}

const pathToPage: Record<string, PageId> = {
  '/': 'lobby',
  '/game/collection': 'collection',
  '/game/search': 'search',
  '/game/detail': 'detail',
  '/game/shelving': 'shelving',
  '/game/missions': 'missions',
  '/game/inventory': 'inventory',
  '/game/stats': 'stats',
}

function WorkPanel({ children, title }: { children: ReactNode; title: string }) {
  const navigate = useNavigate()
  const setPage = useGameStore((s) => s.setPage)
  return (
    <div className="page-enter work-panel-wrap">
      <div className="work-panel-bar glass-strong">
        <div>
          <p className="eyebrow">실무 도구 · Live Holdings</p>
          <h2>{title}</h2>
        </div>
        <button
          type="button"
          className="game-button ghost"
          onClick={() => {
            setPage('lobby')
            navigate('/')
          }}
        >
          로비로 돌아가기
        </button>
      </div>
      <div className="work-panel-body glass">{children}</div>
    </div>
  )
}

function GamePage() {
  const page = useGameStore((s) => s.page)
  const setPage = useGameStore((s) => s.setPage)
  const location = useLocation()

  useEffect(() => {
    const matched = pathToPage[location.pathname]
    if (matched && matched !== page) setPage(matched)
  }, [location.pathname, page, setPage])

  switch (page) {
    case 'lobby':
      return <LobbyPage />
    case 'collection':
      return <CollectionPage />
    case 'search':
      return <SearchPage />
    case 'detail':
      return <BookDetailPage />
    case 'shelving':
      return <ShelvingPage />
    case 'missions':
      return <MissionsPage />
    case 'inventory':
      return <InventoryPage />
    case 'stats':
      return <StatsSettingsPage />
    default:
      return <LobbyPage />
  }
}

function GameShell({ children }: { children: ReactNode }) {
  const toast = useGameStore((s) => s.toast)
  const setToast = useGameStore((s) => s.setToast)
  const page = useGameStore((s) => s.page)
  const navigate = useNavigate()

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(t)
  }, [toast, setToast])

  return (
    <div className="app-shell game-app" data-page={page}>
      <Suspense fallback={null}>
        <ThreeScene />
      </Suspense>
      <div className="ui-layer">
        <TopNav />
        <main className="page-viewport">{children}</main>
        <StatusFooter />
        <div className="work-dock glass-strong" aria-label="실무 바로가기">
          <button type="button" className="game-button ghost" onClick={() => navigate('/holdings')}>
            실무 소장검색
          </button>
          <button type="button" className="game-button ghost" onClick={() => navigate('/new-releases')}>
            신간
          </button>
          <button type="button" className="game-button ghost" onClick={() => navigate('/purchase-review')}>
            구입검토
          </button>
          <button type="button" className="game-button ghost" onClick={() => navigate('/selection-basis')}>
            선정근거
          </button>
          <button type="button" className="game-button ghost" onClick={() => navigate('/aladin')}>
            알라딘
          </button>
          <button type="button" className="game-button ghost" onClick={() => navigate('/settings')}>
            실무설정
          </button>
        </div>
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}

function App() {
  const [state, setState] = useState<BootstrapState>({
    status: 'checking',
    progress: initialProgress,
  })

  const loadAppData = useCallback(async () => {
    setState({ status: 'checking', progress: initialProgress })

    try {
      const result = await bootstrapHoldings((progress) => {
        setState((current) => ({
          status: 'checking',
          progress,
          sampleBook: current.status === 'checking' ? current.sampleBook : undefined,
        }))
      })

      const data = await getStoredDataInfo()
      const appData: AppDataState = {
        meta: data.meta ?? result.meta,
        totalCount: data.count,
        warning: result.warning,
      }

      if (result.updated) {
        setState({
          status: 'complete',
          data: appData,
          progress: {
            stage: '사용 준비를 마무리하고 있습니다...',
            percent: 100,
            processed: data.count,
            total: data.count,
            message: '준비가 완료되었습니다. 최신 소장목록을 사용할 수 있습니다.',
          },
          sampleBook: result.sampleBook,
        })
        return
      }

      setState({ status: 'ready', data: appData })
    } catch (error) {
      const stored = await getStoredDataInfo()
      setState({
        status: 'error',
        title: '소장목록을 준비하지 못했습니다.',
        cause: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        action: '네트워크 연결과 public/data/holdings.latest.json 파일을 확인한 뒤 다시 시도하세요.',
        canUsePreviousData: Boolean(stored.meta && stored.count > 0),
      })
    }
  }, [])

  useEffect(() => {
    let canceled = false
    queueMicrotask(() => {
      if (!canceled) void loadAppData()
    })
    return () => {
      canceled = true
    }
  }, [loadAppData])

  const updateMeta = useCallback((meta?: DataMeta, totalCount?: number, warning?: string) => {
    setState((current) => {
      if (current.status !== 'ready' && current.status !== 'complete') return current
      return {
        status: 'ready',
        data: {
          meta,
          totalCount: totalCount ?? current.data.totalCount,
          warning,
        },
      }
    })
  }, [])

  const contextValue = useMemo(
    () => ({
      data:
        state.status === 'ready' || state.status === 'complete'
          ? state.data
          : ({ meta: undefined, totalCount: 0 } satisfies AppDataState),
      refreshData: loadAppData,
      updateMeta,
    }),
    [loadAppData, state, updateMeta],
  )

  if (state.status === 'checking') {
    return <LoadingScreen progress={state.progress} sampleBook={state.sampleBook} />
  }

  if (state.status === 'complete') {
    return (
      <LoadingScreen
        progress={state.progress}
        sampleBook={state.sampleBook}
        onComplete={() => setState({ status: 'ready', data: state.data })}
      />
    )
  }

  if (state.status === 'error') {
    return (
      <main className="standalone">
        <ErrorNotice
          title={state.title}
          cause={state.cause}
          action={state.action}
          retryLabel="다시 시도"
          onRetry={loadAppData}
          secondaryLabel={state.canUsePreviousData ? '이전 데이터 사용' : undefined}
          onSecondary={
            state.canUsePreviousData
              ? async () => {
                  const stored = await getStoredDataInfo()
                  setState({
                    status: 'ready',
                    data: {
                      meta: stored.meta,
                      totalCount: stored.count,
                      warning: '정적 JSON을 읽지 못해 브라우저에 저장된 이전 데이터를 사용합니다.',
                    },
                  })
                }
              : undefined
          }
        />
      </main>
    )
  }

  return (
    <AppDataContext.Provider value={contextValue}>
      <HashRouter>
        <Routes>
          <Route
            path="/"
            element={
              <GameShell>
                <GamePage />
              </GameShell>
            }
          />
          <Route
            path="/game/:section"
            element={
              <GameShell>
                <GamePage />
              </GameShell>
            }
          />
          <Route
            path="/holdings"
            element={
              <GameShell>
                <WorkPanel title="소장도서 조회 (실데이터)">
                  <Suspense fallback={<p className="muted">실무 화면 로딩 중...</p>}>
                    <HoldingsSearchPage />
                  </Suspense>
                </WorkPanel>
              </GameShell>
            }
          />
          <Route
            path="/new-releases"
            element={
              <GameShell>
                <WorkPanel title="신간도서 조회">
                  <Suspense fallback={<p className="muted">로딩 중...</p>}>
                    <NewReleasesPage />
                  </Suspense>
                </WorkPanel>
              </GameShell>
            }
          />
          <Route
            path="/purchase-review"
            element={
              <GameShell>
                <WorkPanel title="구입 후보 검토">
                  <Suspense fallback={<p className="muted">로딩 중...</p>}>
                    <PurchaseReviewPage />
                  </Suspense>
                </WorkPanel>
              </GameShell>
            }
          />
          <Route
            path="/selection-basis"
            element={
              <GameShell>
                <WorkPanel title="도서 선정 근거 확인">
                  <Suspense fallback={<p className="muted">로딩 중...</p>}>
                    <SelectionBasisPage />
                  </Suspense>
                </WorkPanel>
              </GameShell>
            }
          />
          <Route
            path="/aladin"
            element={
              <GameShell>
                <WorkPanel title="알라딘 상세정보">
                  <Suspense fallback={<p className="muted">로딩 중...</p>}>
                    <AladinDetailPage />
                  </Suspense>
                </WorkPanel>
              </GameShell>
            }
          />
          <Route
            path="/settings"
            element={
              <GameShell>
                <WorkPanel title="실무 설정">
                  <Suspense fallback={<p className="muted">로딩 중...</p>}>
                    <SettingsPage />
                  </Suspense>
                </WorkPanel>
              </GameShell>
            }
          />
          <Route
            path="/help"
            element={
              <GameShell>
                <WorkPanel title="도움말">
                  <Suspense fallback={<p className="muted">로딩 중...</p>}>
                    <HelpPage />
                  </Suspense>
                </WorkPanel>
              </GameShell>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppDataContext.Provider>
  )
}

export default App
