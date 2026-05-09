import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCachedAladinDetail, lookupAladinDetail } from './aladin'
import { getAladinKey } from './settingsStorage'
import { normalizeIsbn } from '../utils/normalize'

export interface BookCoverSource {
  isbn: string
  title: string
}

export type BookCoverState =
  | { status: 'loading' }
  | { status: 'loaded'; coverUrl: string; title: string }
  | { status: 'missing'; message: string }
  | { status: 'error'; message: string }

interface UseBookCoversOptions {
  autoLoad?: boolean
  autoLoadLimit?: number
  batchSize?: number
}

function getUniqueCoverRows<T extends BookCoverSource>(rows: T[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = normalizeIsbn(row.isbn)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function useBookCovers<T extends BookCoverSource>(
  rows: T[],
  { autoLoad = true, autoLoadLimit = 100, batchSize = 6 }: UseBookCoversOptions = {},
) {
  const [coverLoading, setCoverLoading] = useState(false)
  const [coverMessage, setCoverMessage] = useState<string>()
  const [coverByIsbn, setCoverByIsbn] = useState<Record<string, BookCoverState>>({})

  const rowSignature = useMemo(
    () => rows.map((row) => normalizeIsbn(row.isbn)).filter(Boolean).join('|'),
    [rows],
  )

  const loadCover = useCallback(async (row: T) => {
    const key = normalizeIsbn(row.isbn)
    if (!key) return

    setCoverByIsbn((current) => ({ ...current, [key]: { status: 'loading' } }))
    try {
      const detail = await lookupAladinDetail(key)
      setCoverByIsbn((current) => ({
        ...current,
        [key]: detail.coverUrl
          ? { status: 'loaded', coverUrl: detail.coverUrl, title: detail.title || row.title }
          : { status: 'missing', message: '표지 없음' },
      }))
    } catch (coverError) {
      setCoverByIsbn((current) => ({
        ...current,
        [key]: {
          status: 'error',
          message: coverError instanceof Error ? coverError.message : '표지 조회 실패',
        },
      }))
    }
  }, [])

  const markCoverError = useCallback((row: T, message = '이미지 로딩 실패') => {
    const key = normalizeIsbn(row.isbn)
    if (!key) return
    setCoverByIsbn((current) => ({ ...current, [key]: { status: 'error', message } }))
  }, [])

  const getCover = useCallback(
    (row: T) => {
      const key = normalizeIsbn(row.isbn)
      return key ? coverByIsbn[key] : undefined
    },
    [coverByIsbn],
  )

  useEffect(() => {
    const cachedCovers: Record<string, BookCoverState> = {}
    for (const row of getUniqueCoverRows(rows)) {
      const key = normalizeIsbn(row.isbn)
      const cached = getCachedAladinDetail(key)
      if (cached?.coverUrl) {
        cachedCovers[key] = { status: 'loaded', coverUrl: cached.coverUrl, title: cached.title || row.title }
      }
    }

    if (Object.keys(cachedCovers).length > 0) {
      setCoverByIsbn((current) => ({ ...current, ...cachedCovers }))
    }
  }, [rowSignature, rows])

  useEffect(() => {
    if (!autoLoad || !getAladinKey()) {
      setCoverLoading(false)
      return
    }
    let canceled = false

    const targets = getUniqueCoverRows(rows)
      .filter((row) => {
        const key = normalizeIsbn(row.isbn)
        const cached = getCachedAladinDetail(key)
        return !cached?.coverUrl
      })
      .slice(0, autoLoadLimit)

    if (targets.length === 0) {
      setCoverLoading(false)
      return
    }

    setCoverLoading(true)
    setCoverMessage(undefined)

    async function loadTargets() {
      for (let index = 0; index < targets.length; index += batchSize) {
        if (canceled) return
        const batch = targets.slice(index, index + batchSize)
        await Promise.allSettled(batch.map((row) => loadCover(row)))
      }
      if (!canceled) setCoverMessage(`현재 페이지 표지 ${targets.length.toLocaleString()}건을 확인했습니다.`)
    }

    void loadTargets().finally(() => {
      if (!canceled) setCoverLoading(false)
    })

    return () => {
      canceled = true
    }
  }, [autoLoad, autoLoadLimit, batchSize, loadCover, rowSignature, rows])

  const loadVisibleCovers = useCallback(async () => {
    if (!getAladinKey()) {
      setCoverMessage('설정 화면에서 알라딘 TTB Key를 저장하면 표지를 가져올 수 있습니다.')
      return
    }

    const targets = getUniqueCoverRows(rows).filter((row) => {
      const cover = getCover(row)
      return cover?.status !== 'loaded' && cover?.status !== 'loading'
    })

    if (targets.length === 0) {
      setCoverMessage('현재 페이지에서 새로 불러올 표지가 없습니다.')
      return
    }

    setCoverLoading(true)
    setCoverMessage(undefined)
    try {
      for (let index = 0; index < targets.length; index += batchSize) {
        const batch = targets.slice(index, index + batchSize)
        await Promise.allSettled(batch.map((row) => loadCover(row)))
      }
      setCoverMessage(`현재 페이지 표지 ${targets.length.toLocaleString()}건을 확인했습니다.`)
    } finally {
      setCoverLoading(false)
    }
  }, [batchSize, getCover, loadCover, rows])

  return {
    coverByIsbn,
    coverLoading,
    coverMessage,
    getCover,
    loadCover,
    loadVisibleCovers,
    markCoverError,
  }
}
