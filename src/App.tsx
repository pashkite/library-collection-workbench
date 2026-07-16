import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorNotice } from './components/ErrorNotice'
import { Layout } from './components/Layout'
import { LoadingScreen } from './components/LoadingScreen'
import { AppDataContext } from './lib/AppDataContext'
import { bootstrapHoldings } from './lib/holdingsLoader'
import { getStoredDataInfo } from './lib/libraryDb'
import type { AppDataState, BootstrapProgress, DataMeta, StoredBookHolding } from './types/library'
import './index.css'
import './gallery.css'

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const HoldingsSearchPage = lazy(() =>
  import('./pages/HoldingsSearchPage').then((module) => ({ default: module.HoldingsSearchPage })),
)
const NewReleasesPage = lazy(() =>
  import('./pages/NewReleasesPage').then((module) => ({ default: module.NewReleasesPage })),
)
const PurchaseReviewPage = lazy(() =>
  import('./pages/PurchaseReviewPage').then((module) => ({ default: module.PurchaseReviewPage })),
)
const SelectionBasisPage = lazy(() =>
  import('./pages/SelectionBasisPage').then((module) => ({ default: module.SelectionBasisPage })),
)
const AladinDetailPage = lazy(() =>
  import('./pages/AladinDetailPage').then((module) => ({ default: module.AladinDetailPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)
const HelpPage = lazy(() => import('./pages/HelpPage').then((module) => ({ default: module.HelpPage })))

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

function RouteFallback() {
  return (
    <section className="panel route-loading" role="status" aria-live="polite">
      화면을 불러오는 중입니다.
    </section>
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
        <Layout>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/holdings" element={<HoldingsSearchPage />} />
              <Route path="/new-releases" element={<NewReleasesPage />} />
              <Route path="/purchase-review" element={<PurchaseReviewPage />} />
              <Route path="/selection-basis" element={<SelectionBasisPage />} />
              <Route path="/aladin" element={<AladinDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </HashRouter>
    </AppDataContext.Provider>
  )
}

export default App
