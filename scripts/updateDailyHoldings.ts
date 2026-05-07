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

function firstCallNumber(doc: Data4LibraryDoc): Data4LibraryCallNumber | undefined {
  return callNumberEntries(doc)[0]
}

function readCallNumber(callNumber?: Data4LibraryCallNumber) {
  return readString(callNumber?.call_no || callNumber?.book_code)
}

function readShelfName(callNumber?: Data4LibraryCallNumber) {
  return readString(
    callNumber?.shelf_loc_name || callNumber?.separate_shelf_name || callNumber?.shelf_loc_code,
  )
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

function standardizeDoc(
  doc: Data4LibraryDoc,
  index: number,
  libCode: string,
  libraryName: string,
): StandardHolding {
  const callNumber = firstCallNumber(doc)
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

  const response = await fetch(url)
  if (!response.ok) throw new Error(`정보나루 API 호출 실패: HTTP ${response.status}`)
  return (await response.json()) as Data4LibraryResponse
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

  const rows = getDocs(first).map((doc, index) => standardizeDoc(doc, index, libCode, libraryName))
  let apiCallCount = 1

  for (let pageNo = 2; pageNo <= totalPages; pageNo += 1) {
    const payload = await fetchPage(authKey, libCode, pageNo, PAGE_SIZE, startDt, endDt)
    apiCallCount += 1
    const offset = rows.length
    rows.push(...getDocs(payload).map((doc, index) => standardizeDoc(doc, offset + index, libCode, libraryName)))
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

async function main() {
  const authKey = getEnv('DATA4LIBRARY_KEY', 'LIBRARY_NARU_AUTH_KEY')
  const libCode = CONFIG_LIB_CODE
  const libraryName = CONFIG_LIB_NAME || '공공도서관'

  if (!authKey) {
    throw new Error('정보나루 인증키(DATA4LIBRARY_KEY/LIBRARY_NARU_AUTH_KEY)가 없어 일일 수집을 실행할 수 없습니다.')
  }
  if (!libCode || libCode === 'sample') {
    throw new Error('도서관 코드(LIB_CODE/DALSEONG_LIBRARY_CODE)가 없거나 sample입니다. 실제 도서관 코드를 설정하세요.')
  }

  const previousRows = (await readJson<BookHolding[]>(LATEST_PATH)).map((row, index) =>
    normalizeExistingHolding(row, index),
  )
  const previousMeta = await readJson<DataMeta>(META_PATH)
  const previousByKey = new Map(previousRows.map((row) => [row.dedupeKey, row]))
  const { rows: dailyRows, expectedTotal, apiCallCount, startDt, endDt } = await fetchDailyRows(
    authKey,
    libCode,
    libraryName,
  )

  let duplicateSkippedCount = 0
  const additions: StandardHolding[] = []
  for (const row of dailyRows) {
    if (previousByKey.has(row.dedupeKey)) {
      duplicateSkippedCount += 1
      continue
    }
    previousByKey.set(row.dedupeKey, row)
    additions.push(row)
  }

  if (additions.length === 0) {
    console.log(
      `최근 ${DAILY_LOOKBACK_DAYS}일(${startDt}~${endDt}) 신규 소장자료가 없습니다. API 호출 ${apiCallCount}회.`,
    )
    return
  }

  const mergedRows = [...previousRows, ...additions]
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
    message: `최근 ${DAILY_LOOKBACK_DAYS}일(${startDt}~${endDt}) 등록자료 ${dailyRows.length}건 중 신규 ${additions.length}건을 병합했습니다.`,
  }

  await safeWrite(mergedRows, nextMeta)
  console.log(`신규 소장자료 ${additions.length}건을 병합했습니다. API 호출 ${apiCallCount}회.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
