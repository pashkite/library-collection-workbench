import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getEnv, loadDotEnv } from './env.ts'
import type { BookHolding, DataMeta } from '../src/types/library.ts'

loadDotEnv()

const PUBLIC_DATA_DIR = path.resolve('public/data')
const LATEST_PATH = path.join(PUBLIC_DATA_DIR, 'holdings.latest.json')
const META_PATH = path.join(PUBLIC_DATA_DIR, 'holdings.meta.json')
const API_URL = 'https://data4library.kr/api/itemSrch'
const PAGE_SIZE = Number(getEnv('PAGE_SIZE') ?? 300)
const MAX_PAGES = Number(getEnv('MAX_PAGES') ?? 500)

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
}

interface Data4LibraryCallNumber {
  call_no?: string
  book_code?: string
  shelf_loc_name?: string
  shelf_loc_code?: string
  separate_shelf_name?: string
  reg_date?: string
}

interface Data4LibraryResponse {
  response?: {
    numFound?: number
    resultNum?: number
    docs?: { doc?: Data4LibraryDoc | Data4LibraryDoc[] }
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function sampleHoldings(count = 100): BookHolding[] {
  const categories = [
    ['813.7', '문학자료실'],
    ['005.1', '종합자료실'],
    ['331.5', '종합자료실'],
    ['598.1', '육아자료'],
    ['911', '향토자료'],
  ]

  return Array.from({ length: count }, (_, index) => {
    const sequence = index + 1
    const [kdc, shelfName] = categories[index % categories.length]
    return {
      title: `샘플 도서 ${String(sequence).padStart(3, '0')}`,
      author: `샘플 저자 ${((index % 12) + 1).toString().padStart(2, '0')}`,
      publisher: ['한빛샘', '열린자료', '달성북스', '공공출판'][index % 4],
      publicationYear: String(2020 + (index % 6)),
      isbn: `979119${String(1000000 + index).padStart(7, '0')}`,
      kdc,
      callNumber: `${kdc}-${String(index + 1).padStart(3, '0')}`,
      shelfName,
      registeredAt: `2026-04-${String((index % 24) + 1).padStart(2, '0')}`,
    }
  })
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
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
  return String(callNumber?.call_no || callNumber?.book_code || '').trim()
}

function readShelfName(callNumber?: Data4LibraryCallNumber) {
  return String(
    callNumber?.shelf_loc_name || callNumber?.separate_shelf_name || callNumber?.shelf_loc_code || '',
  ).trim()
}

function sanitizeDoc(doc: Data4LibraryDoc): BookHolding {
  const callNumber = firstCallNumber(doc)
  return {
    title: doc.bookname ?? '',
    author: doc.authors ?? '',
    publisher: doc.publisher ?? '',
    publicationYear: doc.publication_year ?? '',
    isbn: doc.isbn13 ?? '',
    kdc: doc.class_no ?? '',
    callNumber: readCallNumber(callNumber),
    shelfName: readShelfName(callNumber),
    registeredAt: callNumber?.reg_date ?? doc.reg_date ?? '',
  }
}

async function readPreviousMeta(): Promise<DataMeta | undefined> {
  try {
    return JSON.parse(await readFile(META_PATH, 'utf-8')) as DataMeta
  } catch {
    return undefined
  }
}

async function fetchPage(authKey: string, libCode: string, pageNo: number) {
  const url = new URL(API_URL)
  url.searchParams.set('authKey', authKey)
  url.searchParams.set('libCode', libCode)
  url.searchParams.set('type', 'ALL')
  url.searchParams.set('pageNo', String(pageNo))
  url.searchParams.set('pageSize', String(PAGE_SIZE))
  url.searchParams.set('format', 'json')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`정보나루 API 호출 실패: HTTP ${response.status}`)
  }
  return (await response.json()) as Data4LibraryResponse
}

async function fetchHoldingsFromData4Library(authKey: string, libCode: string) {
  const holdings: BookHolding[] = []
  let expectedTotal = 0

  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
    const payload = await fetchPage(authKey, libCode, pageNo)
    const response = payload.response
    const docs = asArray(response?.docs?.doc)

    if (pageNo === 1) expectedTotal = Number(response?.numFound ?? docs.length)
    holdings.push(...docs.map(sanitizeDoc))

    if (docs.length === 0 || holdings.length >= expectedTotal) break
  }

  return holdings
}

function validate(rows: BookHolding[]) {
  return {
    isbnMissingCount: rows.filter((row) => !row.isbn).length,
    kdcMissingCount: rows.filter((row) => !row.kdc).length,
    titleMissingCount: rows.filter((row) => !row.title).length,
  }
}

async function writeOutputs(rows: BookHolding[], meta: DataMeta) {
  await mkdir(PUBLIC_DATA_DIR, { recursive: true })
  await writeFile(LATEST_PATH, `${JSON.stringify(rows, null, 2)}\n`)
  await writeFile(META_PATH, `${JSON.stringify(meta, null, 2)}\n`)
}

async function main() {
  const authKey = getEnv('DATA4LIBRARY_KEY', 'LIBRARY_NARU_AUTH_KEY')
  const libCode = getEnv('LIB_CODE', 'DALSEONG_LIBRARY_CODE') ?? 'sample'
  const libraryName = getEnv('LIB_NAME', 'DALSEONG_LIBRARY_NAME', 'LIBRARY_NAME') ?? '달성군립도서관'
  const previousMeta = await readPreviousMeta()
  let rows: BookHolding[]
  let source: DataMeta['source'] = 'data4library'
  let status: DataMeta['status'] = 'ready'
  let message = '정보나루 API에서 갱신했습니다.'

  if (!authKey || libCode === 'sample') {
    rows = sampleHoldings(100)
    source = 'sample'
    status = 'sample'
    message =
      '정보나루 인증키(DATA4LIBRARY_KEY/LIBRARY_NARU_AUTH_KEY) 또는 도서관 코드(LIB_CODE/DALSEONG_LIBRARY_CODE)가 없어 샘플 데이터를 생성했습니다.'
  } else {
    try {
      rows = await fetchHoldingsFromData4Library(authKey, libCode)
      if (rows.length === 0) throw new Error('정보나루 API 응답에 도서 데이터가 없습니다.')
    } catch (error) {
      if (previousMeta) {
        console.error(error)
        console.error('갱신 실패: 기존 holdings.latest.json은 삭제하지 않습니다.')
        process.exitCode = 1
        return
      }
      rows = sampleHoldings(100)
      source = 'sample'
      status = 'sample'
      message =
        error instanceof Error
          ? `API 실패로 샘플 데이터를 생성했습니다. ${error.message}`
          : 'API 실패로 샘플 데이터를 생성했습니다.'
    }
  }

  const validation = validate(rows)
  const meta: DataMeta = {
    baseDate: today(),
    lastUpdatedAt: new Date().toISOString(),
    totalCount: rows.length,
    libraryCode: libCode,
    libraryName,
    status,
    addedCount: previousMeta ? Math.max(0, rows.length - previousMeta.totalCount) : rows.length,
    removedCount: previousMeta ? Math.max(0, previousMeta.totalCount - rows.length) : 0,
    ...validation,
    source,
    message,
  }

  await writeOutputs(rows, meta)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
