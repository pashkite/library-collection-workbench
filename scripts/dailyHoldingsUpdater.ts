import { mkdir, readFile, rename, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { getEnv, loadDotEnv } from './env.ts'
import type { BookHolding, DataMeta } from '../src/types/library.ts'

loadDotEnv()

const PUBLIC_DATA_DIR = path.resolve('public/data')
const LATEST_PATH = path.join(PUBLIC_DATA_DIR, 'holdings.latest.json')
const META_PATH = path.join(PUBLIC_DATA_DIR, 'holdings.meta.json')
const TMP_LATEST_PATH = path.join(PUBLIC_DATA_DIR, 'holdings.latest.tmp.json')
const TMP_META_PATH = path.join(PUBLIC_DATA_DIR, 'holdings.meta.tmp.json')
const API_URL = 'https://data4library.kr/api/itemSrch'
const PAGE_SIZE = Number(getEnv('PAGE_SIZE') ?? 300)
const DAILY_LOOKBACK_DAYS = Number(getEnv('DAILY_LOOKBACK_DAYS') ?? 7)
const API_CALL_LIMIT = Number(getEnv('API_CALL_LIMIT') ?? 450)
const REQUEST_TIMEOUT_MS = Number(getEnv('REQUEST_TIMEOUT_MS') ?? 75_000)
const MAX_FETCH_ATTEMPTS = Number(getEnv('MAX_FETCH_ATTEMPTS') ?? 4)
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000]
const RETRYABLE_HTTP_STATUSES = new Set([429, 500, 502, 503, 504])
const CONFIG_LIB_CODE = getEnv('LIB_CODE', 'DALSEONG_LIBRARY_CODE') ?? ''
const CONFIG_LIB_NAME = getEnv('LIB_NAME', 'DALSEONG_LIBRARY_NAME', 'LIBRARY_NAME') ?? ''
const DEDUPE_STRATEGY =
  'registrationNumber > isbn+callNumber+registeredAt+title > isbn+title+author+publisher > text fallback'

interface StandardHolding extends BookHolding {
  id: string
  dedupeKey: string
  libCode: string
  libraryName: string
  registrationNumber: string
}

interface Data4LibraryDoc {
  bookname?: string
  authors?: string
  publisher?: string
  publication_year?: string
  isbn13?: string
  class_no?: string
  reg_date?: string
  callNumbers?:
    | { callNumber?: Data4LibraryCallNumber | Data4LibraryCallNumber[] }
    | Array<{ callNumber?: Data4LibraryCallNumber | Data4LibraryCallNumber[] }>
  [key: string]: unknown
}

interface Data4LibraryCallNumber {
  call_no?: string
  book_code?: string
  shelf_loc_name?: string
  shelf_loc_code?: string
  separate_shelf_name?: string
  reg_date?: string
  [key: string]: unknown
}

interface Data4LibraryResponse {
  response?: {
    numFound?: number
    resultNum?: number
    docs?: { doc?: Data4LibraryDoc | Data4LibraryDoc[] } | Array<{ doc?: Data4LibraryDoc }>
  }
}

function todayInKorea(): string {
  const now = new Date()
  const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return korea.toISOString().slice(0, 10)
}

function addDays(dateText: string, days: number): string {
  const date = new Date(`${dateText}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeCompact(value: unknown): string {
  return normalizeText(value).replace(/[\s\-_:./]/g, '')
}

function normalizeIsbn(value: unknown): string {
  return String(value ?? '').replace(/[^0-9Xx]/g, '').toUpperCase()
}

function readString(value: unknown): string {
  return String(value ?? '').trim()
}

function callNumberEntries(doc: Data4LibraryDoc): Data4LibraryCallNumber[] {
  return asArray(doc.callNumbers)
    .flatMap((entry) => asArray(entry?.callNumber))
    .filter((value): value is Data4LibraryCallNumber => Boolean(value && typeof value === 'object'))
}

function readCallNumber(callNumber?: Data4LibraryCallNumber) {
  return readString(callNumber?.call_no || callNumber?.book_code)
}

function isMeaningfulSeparateShelfName(value: string) {
  return /(신간|자료실|서가|코너|비치|향토|특화|다문화|만화)/.test(normalizeText(value))
}

function readShelfName(callNumber?: Data4LibraryCallNumber) {
  const separateShelfName = readString(callNumber?.separate_shelf_name)
  const shelfLocationName = readString(callNumber?.shelf_loc_name)
  const shelfLocationCode = readString(callNumber?.shelf_loc_code)
  const hasMeaningfulSeparateShelf = isMeaningfulSeparateShelfName(separateShelfName)

  if (!hasMeaningfulSeparateShelf) {
    return shelfLocationName || shelfLocationCode || separateShelfName
  }
  if (!shelfLocationName) return separateShelfName
  if (normalizeCompact(separateShelfName).includes(normalizeCompact(shelfLocationName))) {
    return separateShelfName
  }
  return `${separateShelfName} ${shelfLocationName}`.replace(/\s+/g, ' ').trim()
}

function shelfNameQuality(value: string) {
  const normalized = normalizeText(value)
  if (!normalized) return 0
  if (normalized.includes('신간')) return 6
  if (/(자료실|서가|도서관|코너|비치예정)/.test(normalized)) return 5
  if (/^\[[^\]]+\]/.test(value)) return 4
  if (/^[a-z]{1,4}\d+$/i.test(value) || /^[가-힣]{1,2}$/.test(value)) return 1
  if (normalized === '적용안함') return 1
  return 2
}

function chooseShelfName(existingShelfName: string, incomingShelfName: string) {
  if (!incomingShelfName) return existingShelfName
  const existingQuality = shelfNameQuality(existingShelfName)
  const incomingQuality = shelfNameQuality(incomingShelfName)

  // 현재 API가 구체적인 자료실명을 제공하면 실제 이동도 반영합니다.
  if (incomingQuality >= 4) return incomingShelfName
  // 코드나 한 글자 별치값이 기존의 구체적인 자료실명을 덮지 못하게 합니다.
  if (existingQuality >= 4) return existingShelfName
  return incomingQuality >= existingQuality ? incomingShelfName : existingShelfName
}

function findRegistrationNumber(doc: Data4LibraryDoc, callNumber?: Data4LibraryCallNumber): string {
  const candidates = [
    'registrationNumber',
    'regNo',
    'reg_no',
    'accessionNo',
    'accession_no',
    'controlNo',
    '등록번호',
  ]

  for (const source of [doc, callNumber]) {
    if (!source) continue
    for (const key of candidates) {
      const value = source[key]
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim()
      }
    }
  }

  return ''
}

function makeDedupeKey(row: {
  libCode: string
  title: string
  author: string
  publisher: string
  publicationYear: string
  isbn: string
  callNumber: string
  registeredAt: string
  registrationNumber: string
}): string {
  const normalizedTitle = normalizeCompact(row.title)
  const normalizedAuthor = normalizeCompact(row.author)
  const normalizedPublisher = normalizeCompact(row.publisher)
  const normalizedCallNumber = normalizeCompact(row.callNumber)
  const normalizedIsbn = normalizeIsbn(row.isbn)

  if (row.registrationNumber) {
    return `reg:${row.libCode}:${row.registrationNumber}`
  }

  if (normalizedIsbn && normalizedCallNumber) {
    return `holding:${row.libCode}:${normalizedIsbn}:${normalizedCallNumber}:${row.registeredAt}:${normalizedTitle}`
  }

  if (normalizedIsbn) {
    return `book:${row.libCode}:${normalizedIsbn}:${normalizedTitle}:${normalizedAuthor}:${normalizedPublisher}`
  }

  return `text:${row.libCode}:${normalizedTitle}:${normalizedAuthor}:${normalizedPublisher}:${row.publicationYear}:${normalizedCallNumber}`
}

function standardizeCallNumber(
  doc: Data4LibraryDoc,
  callNumber: Data4LibraryCallNumber | undefined,
  index: number,
  libCode: string,
  libraryName: string,
): StandardHolding {
  const registrationNumber = findRegistrationNumber(doc, callNumber)
  const base = {
    libCode,
    libraryName,
    title: readString(doc.bookname),
    author: readString(doc.authors),
    publisher: readString(doc.publisher),
    publicationYear: readString(doc.publication_year),
    isbn: readString(doc.isbn13),
    kdc: readString(doc.class_no),
    callNumber: readCallNumber(callNumber),
    shelfName: readShelfName(callNumber),
    registeredAt: readString(callNumber?.reg_date || doc.reg_date),
    registrationNumber,
  }
  const dedupeKey = makeDedupeKey(base)

  return {
    id: `${dedupeKey}:${index}`,
    dedupeKey,
    ...base,
  }
}

function standardizeDocs(
  docs: Data4LibraryDoc[],
  startIndex: number,
  libCode: string,
  libraryName: string,
): StandardHolding[] {
  const rows: StandardHolding[] = []

  for (const doc of docs) {
    const callNumbers = callNumberEntries(doc)
    const entries: Array<Data4LibraryCallNumber | undefined> =
      callNumbers.length > 0 ? callNumbers : [undefined]

    for (const callNumber of entries) {
      rows.push(
        standardizeCallNumber(
          doc,
          callNumber,
          startIndex + rows.length,
          libCode,
          libraryName,
        ),
      )
    }
  }

  return rows
}

function normalizeExistingHolding(row: BookHolding, index: number, meta?: DataMeta): StandardHolding {
  const base = {
    libCode: row.libCode || meta?.libraryCode || CONFIG_LIB_CODE,
    libraryName: row.libraryName || meta?.libraryName || CONFIG_LIB_NAME,
    title: row.title ?? '',
    author: row.author ?? '',
    publisher: row.publisher ?? '',
    publicationYear: row.publicationYear ?? '',
    isbn: row.isbn ?? '',
    kdc: row.kdc ?? '',
    callNumber: row.callNumber ?? '',
    shelfName: row.shelfName ?? '',
    registeredAt: row.registeredAt ?? '',
    registrationNumber: row.registrationNumber ?? '',
  }
  const dedupeKey = row.dedupeKey || makeDedupeKey(base)

  return {
    id: row.id || `${dedupeKey}:${index}`,
    dedupeKey,
    ...base,
  }
}

function holdingContentChanged(left: StandardHolding, right: StandardHolding) {
  return (
    left.libraryName !== right.libraryName ||
    left.title !== right.title ||
    left.author !== right.author ||
    left.publisher !== right.publisher ||
    left.publicationYear !== right.publicationYear ||
    left.isbn !== right.isbn ||
    left.kdc !== right.kdc ||
    left.callNumber !== right.callNumber ||
    left.shelfName !== right.shelfName ||
    left.registeredAt !== right.registeredAt ||
    left.registrationNumber !== right.registrationNumber
  )
}

function refreshExistingHolding(
  existing: StandardHolding,
  incoming: StandardHolding,
): StandardHolding {
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    dedupeKey: existing.dedupeKey,
    callNumber: incoming.callNumber || existing.callNumber,
    shelfName: chooseShelfName(existing.shelfName, incoming.shelfName),
    registeredAt: incoming.registeredAt || existing.registeredAt,
    registrationNumber: incoming.registrationNumber || existing.registrationNumber,
  }
}

function getDocs(payload: Data4LibraryResponse): Data4LibraryDoc[] {
  const docs = payload.response?.docs
  if (Array.isArray(docs)) return docs.flatMap((entry) => asArray(entry.doc))
  return asArray(docs?.doc)
}

async function fetchPage(
  authKey: string,
  libCode: string,
  pageNo: number,
  pageSize: number,
  startDt: string,
  endDt: string,
): Promise<Data4LibraryResponse> {
  const url = new URL(API_URL)
  url.searchParams.set('authKey', authKey)
  url.searchParams.set('libCode', libCode)
  url.searchParams.set('startDt', startDt)
  url.searchParams.set('endDt', endDt)
  url.searchParams.set('pageNo', String(pageNo))
  url.searchParams.set('pageSize', String(pageSize))
  url.searchParams.set('format', 'json')

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    let status: number | undefined

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      status = response.status

      if (response.ok) {
        return (await response.json()) as Data4LibraryResponse
      }

      lastError = new Error(`정보나루 API 호출 실패: HTTP ${response.status}`)
      if (!RETRYABLE_HTTP_STATUSES.has(response.status)) throw lastError
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const isNetworkOrTimeoutError =
        error instanceof TypeError ||
        lastError.name === 'TimeoutError' ||
        lastError.name === 'AbortError'

      if (status === undefined && !isNetworkOrTimeoutError) throw lastError
    }

    if (attempt >= MAX_FETCH_ATTEMPTS) throw lastError

    const delayMs = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]
    console.warn(
      `정보나루 API 요청 실패(page=${pageNo}, range=${startDt}~${endDt}, attempt=${attempt}/${MAX_FETCH_ATTEMPTS}): ${lastError.message}. ${delayMs / 1_000}초 후 재시도합니다.`,
    )
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  throw lastError ?? new Error('정보나루 API 호출에 실패했습니다.')
}

async function fetchDailyRows(authKey: string, libCode: string, libraryName: string) {
  const endDt = todayInKorea()
  const startDt = addDays(endDt, -(DAILY_LOOKBACK_DAYS - 1))
  const first = await fetchPage(authKey, libCode, 1, PAGE_SIZE, startDt, endDt)
  const expectedTotal = Number(first.response?.numFound ?? getDocs(first).length)
  const totalPages = Math.max(1, Math.ceil(expectedTotal / PAGE_SIZE))

  if (totalPages > API_CALL_LIMIT) {
    throw new Error(
      `예상 API 호출 수 ${totalPages}회가 제한 ${API_CALL_LIMIT}회를 초과하여 일일 수집을 중단합니다.`,
    )
  }

  const rows = standardizeDocs(getDocs(first), 0, libCode, libraryName)
  let apiCallCount = 1

  for (let pageNo = 2; pageNo <= totalPages; pageNo += 1) {
    const payload = await fetchPage(authKey, libCode, pageNo, PAGE_SIZE, startDt, endDt)
    apiCallCount += 1
    rows.push(...standardizeDocs(getDocs(payload), rows.length, libCode, libraryName))
  }

  return { rows, expectedTotal, apiCallCount, startDt, endDt }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf-8')) as T
}

function validateRows(rows: StandardHolding[]) {
  if (rows.length === 0) throw new Error('저장할 소장자료가 없습니다.')
  const titleMissingCount = rows.filter((row) => !row.title).length
  if (titleMissingCount === rows.length) {
    throw new Error('모든 행에 도서명이 없어 JSON 저장을 중단합니다.')
  }

  return {
    isbnMissingCount: rows.filter((row) => !row.isbn).length,
    kdcMissingCount: rows.filter((row) => !row.kdc).length,
    titleMissingCount,
    callNumberMissingCount: rows.filter((row) => !row.callNumber).length,
    registeredAtMissingCount: rows.filter((row) => !row.registeredAt).length,
  }
}

async function safeWrite(rows: StandardHolding[], meta: DataMeta) {
  const validation = validateRows(rows)
  const nextMeta = { ...meta, ...validation }

  await writeFile(TMP_LATEST_PATH, `${JSON.stringify(rows, null, 2)}\n`)
  await writeFile(TMP_META_PATH, `${JSON.stringify(nextMeta, null, 2)}\n`)

  validateRows(await readJson<StandardHolding[]>(TMP_LATEST_PATH))
  await readJson<DataMeta>(TMP_META_PATH)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(PUBLIC_DATA_DIR, 'backup', stamp)
  await mkdir(backupDir, { recursive: true })
  await copyFile(LATEST_PATH, path.join(backupDir, 'holdings.latest.json')).catch(() => undefined)
  await copyFile(META_PATH, path.join(backupDir, 'holdings.meta.json')).catch(() => undefined)
  await rename(TMP_LATEST_PATH, LATEST_PATH)
  await rename(TMP_META_PATH, META_PATH)
}

export async function runDailyHoldingsUpdate() {
  const authKey = getEnv('DATA4LIBRARY_KEY', 'LIBRARY_NARU_AUTH_KEY')
  const libCode = CONFIG_LIB_CODE
  const libraryName = CONFIG_LIB_NAME || '공공도서관'

  if (!authKey) {
    throw new Error(
      '정보나루 인증키(DATA4LIBRARY_KEY/LIBRARY_NARU_AUTH_KEY)가 없어 일일 수집을 실행할 수 없습니다.',
    )
  }
  if (!libCode || libCode === 'sample') {
    throw new Error(
      '도서관 코드(LIB_CODE/DALSEONG_LIBRARY_CODE)가 없거나 sample입니다. 실제 도서관 코드를 설정하세요.',
    )
  }

  const previousRows = (await readJson<BookHolding[]>(LATEST_PATH)).map((row, index) =>
    normalizeExistingHolding(row, index),
  )
  const previousMeta = await readJson<DataMeta>(META_PATH)
  const mergedByKey = new Map(previousRows.map((row) => [row.dedupeKey, row]))
  const { rows: dailyRows, expectedTotal, apiCallCount, startDt, endDt } =
    await fetchDailyRows(authKey, libCode, libraryName)

  let duplicateSkippedCount = 0
  let refreshedCount = 0
  const additions: StandardHolding[] = []

  for (const row of dailyRows) {
    const existing = mergedByKey.get(row.dedupeKey)

    if (existing) {
      duplicateSkippedCount += 1
      const refreshed = refreshExistingHolding(existing, row)
      if (holdingContentChanged(existing, refreshed)) {
        mergedByKey.set(row.dedupeKey, refreshed)
        refreshedCount += 1
      }
      continue
    }

    mergedByKey.set(row.dedupeKey, row)
    additions.push(row)
  }

  if (additions.length === 0 && refreshedCount === 0) {
    console.log(
      `최근 ${DAILY_LOOKBACK_DAYS}일(${startDt}~${endDt}) 신규·변경 소장자료가 없습니다. API 호출 ${apiCallCount}회.`,
    )
    return
  }

  const mergedRows = [...mergedByKey.values()]
  const now = new Date().toISOString()
  const lastRegistrationNumber =
    [...dailyRows].reverse().find((row) => row.registrationNumber)?.registrationNumber ?? ''
  const nextMeta: DataMeta = {
    ...previousMeta,
    baseDate: endDt,
    lastUpdatedAt: now,
    dailyCheckAt: now,
    totalCount: mergedRows.length,
    libraryCode: libCode,
    libraryName,
    status: 'ready',
    source: 'data4library',
    syncMode: 'daily',
    lastFullSyncAt: previousMeta.lastFullSyncAt ?? previousMeta.lastUpdatedAt ?? now,
    lastDailySyncAt: now,
    dailyLookbackDays: DAILY_LOOKBACK_DAYS,
    addedCount: additions.length,
    removedCount: 0,
    duplicateSkippedCount,
    apiCallCount,
    expectedTotalFromApi: expectedTotal,
    collectedCountBeforeDedupe: previousRows.length + dailyRows.length,
    collectedCountAfterDedupe: mergedRows.length,
    registrationNumberAvailable: dailyRows.some((row) => row.registrationNumber),
    lastRegistrationNumber,
    dedupeStrategy: DEDUPE_STRATEGY,
    message: `최근 ${DAILY_LOOKBACK_DAYS}일(${startDt}~${endDt}) 등록자료 ${dailyRows.length}건 중 신규 ${additions.length}건, 기존 정보 갱신 ${refreshedCount}건을 반영했습니다.`,
  }

  await safeWrite(mergedRows, nextMeta)
  console.log(
    `신규 ${additions.length}건, 기존 정보 갱신 ${refreshedCount}건을 반영했습니다. API 호출 ${apiCallCount}회.`,
  )
}
