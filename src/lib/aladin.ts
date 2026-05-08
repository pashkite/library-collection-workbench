import type { AladinBookDetail } from '../types/library'
import { normalizeIsbn } from '../utils/normalize'
import { getAladinKey } from './settingsStorage'

const API_URL = 'https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx'
const CACHE_KEY = 'aladin-detail-cache-v2'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface AladinRawItem {
  isbn?: string
  isbn13?: string
  title?: string
  author?: string
  publisher?: string
  pubDate?: string
  priceStandard?: number
  cover?: string
  description?: string
  link?: string
  salesPoint?: number
  stockStatus?: string
  categoryName?: string
  customerReviewRank?: number
  subInfo?: {
    itemPage?: number
    toc?: string
    story?: string
  }
}

interface AladinRawResponse {
  item?: AladinRawItem[]
  errorCode?: number
  errorMessage?: string
}

type CacheShape = Record<string, AladinBookDetail>

function readCache(): CacheShape {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as CacheShape
  } catch {
    return {}
  }
}

function writeCache(cache: CacheShape) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

function normalizeRawItem(item: AladinRawItem): AladinBookDetail {
  return {
    isbn: normalizeIsbn(item.isbn13 || item.isbn),
    title: item.title ?? '',
    author: item.author ?? '',
    publisher: item.publisher ?? '',
    pubDate: item.pubDate,
    priceStandard: item.priceStandard,
    coverUrl: normalizeCoverUrl(item.cover),
    description: item.description || item.subInfo?.story,
    tableOfContents: item.subInfo?.toc,
    salesPoint: item.salesPoint,
    stockStatus: item.stockStatus,
    cachedAt: new Date().toISOString(),
    link: item.link,
    categoryName: item.categoryName,
    customerReviewRank: item.customerReviewRank,
    itemPage: item.subInfo?.itemPage,
  }
}

function normalizeCoverUrl(value?: string) {
  const coverUrl = value?.trim()
  if (!coverUrl) return undefined
  if (coverUrl.startsWith('//')) return `https:${coverUrl}`
  return coverUrl.replace(/^http:\/\/image\.aladin\.co\.kr\//i, 'https://image.aladin.co.kr/')
}

function requestJsonp(url: URL): Promise<AladinRawResponse> {
  return new Promise((resolve, reject) => {
    const callbackName = `aladinCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('알라딘 API 응답 시간이 초과되었습니다.'))
    }, 15000)

    function cleanup() {
      window.clearTimeout(timeout)
      script.remove()
      Reflect.deleteProperty(window, callbackName)
    }

    Object.defineProperty(window, callbackName, {
      configurable: true,
      value: (successOrData: boolean | AladinRawResponse, maybeData?: AladinRawResponse) => {
        cleanup()
        const payload = typeof successOrData === 'boolean' ? maybeData : successOrData
        if (!payload) {
          reject(new Error('알라딘 API 응답을 해석하지 못했습니다.'))
          return
        }
        resolve(payload)
      },
    })

    url.searchParams.set('callback', callbackName)
    script.src = url.toString()
    script.onerror = () => {
      cleanup()
      reject(new Error('알라딘 API 스크립트를 불러오지 못했습니다.'))
    }
    document.head.append(script)
  })
}

export async function lookupAladinDetail(isbn: string, forceRefresh = false) {
  const normalizedIsbn = normalizeIsbn(isbn)
  if (!normalizedIsbn) throw new Error('ISBN을 입력하세요.')
  const key = getAladinKey()
  if (!key) throw new Error('설정 화면에서 알라딘 TTB Key를 먼저 저장하세요.')

  const cache = readCache()
  const cached = cache[normalizedIsbn]
  const cachedAt = cached?.cachedAt ? Date.parse(cached.cachedAt) : 0
  if (!forceRefresh && cached?.coverUrl && Date.now() - cachedAt < CACHE_TTL_MS) return cached

  const url = new URL(API_URL)
  url.searchParams.set('ttbkey', key)
  url.searchParams.set('itemIdType', normalizedIsbn.length === 13 ? 'ISBN13' : 'ISBN')
  url.searchParams.set('ItemId', normalizedIsbn)
  url.searchParams.set('output', 'js')
  url.searchParams.set('Version', '20131101')
  url.searchParams.set('Cover', 'Big')
  url.searchParams.set('OptResult', 'Toc,Story,bestSellerRank,ratingInfo')

  const payload = await requestJsonp(url)
  if (payload.errorMessage) throw new Error(payload.errorMessage)
  const item = payload.item?.[0]
  if (!item) throw new Error('알라딘에서 해당 ISBN의 상세정보를 찾지 못했습니다.')

  const detail = normalizeRawItem(item)
  cache[normalizedIsbn] = detail
  writeCache(cache)
  return detail
}

export function getCachedAladinDetail(isbn: string) {
  const normalizedIsbn = normalizeIsbn(isbn)
  return readCache()[normalizedIsbn]
}

export function clearAladinCache() {
  localStorage.removeItem(CACHE_KEY)
}
