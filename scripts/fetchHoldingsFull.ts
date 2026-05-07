import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BookHolding, DataMeta } from '../src/types/library.ts'

const API_URL = 'https://data4library.kr/api/itemSrch'
const PUBLIC_DATA_DIR = path.resolve('public/data')
const DEFAULT_CHECKPOINT_PATH = path.resolve('tools/data4library-full-fetch/checkpoint.json')
const DEFAULT_PAGE_SIZE = 200
const DEFAULT_TIMEOUT_MS = 60000
const DEFAULT_RETRIES = 4
const DEFAULT_CHECKPOINT_EVERY = 1

interface Data4LibraryCallNumber {
  call_no?: string
  book_code?: string
  shelf_loc_name?: string
  shelf_loc_code?: string
  separate_shelf_name?: string
  reg_date?: string
  [key: string]: unknown
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

interface Data4LibraryResponse {
  response?: {
    pageNo?: number
    pageSize?: number
    numFound?: number
    resultNum?: number
    docs?: { doc?: Data4LibraryDoc | Data4LibraryDoc[] } | Array<{ doc?: Data4LibraryDoc }>
  }
}

interface StandardHolding extends BookHolding {
  id: string
  dedupeKey: string
  libCode: string
  libraryName: string
  registrationNumber: string
}

interface CheckpointFile {
  version: 1
  libCode: string
  libraryName: string
  pageSize: number
  expectedTotal: number
  totalPages: number
  completedPage: number
  rows: StandardHolding[]
  savedAt: string
}

interface Options {
  pageSize: number
  timeoutMs: number
  retries: number
  checkpointEvery: number
  checkpointPath: string
  outputDir: string
  noResume: boolean
  limitPages?: number
}

function parseDotEnv(text: string) {
  const values = new Map<string, string>()
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue
    const [, key, rawValue] = match
    let value = rawValue.trim()
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1)
      if (quote === '"') {
        value = value
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
      }
    } else {
      const comment = value.match(/\s+#/)
      if (comment?.index !== undefined) value = value.slice(0, comment.index).trim()
    }
    values.set(key, value)
  }
  return values
}

async function loadDotEnv() {
  try {
    const envText = await readFile(path.resolve('.env'), 'utf-8')
    for (const [key, value] of parseDotEnv(envText)) {
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

function getEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return undefined
}

function parseNumber(value: string | undefined, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function readArgs(): Options {
  const args = process.argv.slice(2)
  const options: Options = {
    pageSize: parseNumber(process.env.FULL_FETCH_PAGE_SIZE ?? process.env.PAGE_SIZE, DEFAULT_PAGE_SIZE),
    timeoutMs: parseNumber(process.env.FULL_FETCH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    retries: parseNumber(process.env.FULL_FETCH_RETRIES, DEFAULT_RETRIES),
    checkpointEvery: parseNumber(process.env.FULL_FETCH_CHECKPOINT_EVERY, DEFAULT_CHECKPOINT_EVERY),
    checkpointPath: process.env.FULL_FETCH_CHECKPOINT_PATH || DEFAULT_CHECKPOINT_PATH,
    outputDir: process.env.FULL_FETCH_OUTPUT_DIR || PUBLIC_DATA_DIR,
    noResume: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]
    if (arg === '--no-resume') {
      options.noResume = true
    } else if (arg === '--page-size' && next) {
      options.pageSize = parseNumber(next, options.pageSize)
      index += 1
    } else if (arg === '--timeout-ms' && next) {
      options.timeoutMs = parseNumber(next, options.timeoutMs)
      index += 1
    } else if (arg === '--checkpoint' && next) {
      options.checkpointPath = path.resolve(next)
      index += 1
    } else if (arg === '--output-dir' && next) {
      options.outputDir = path.resolve(next)
      index += 1
    } else if (arg === '--limit-pages' && next) {
      options.limitPages = parseNumber(next, 0)
      index += 1
    }
  }

  options.pageSize = Math.min(250, Math.max(1, Math.floor(options.pageSize)))
  options.retries = Math.max(1, Math.floor(options.retries))
  options.checkpointEvery = Math.max(1, Math.floor(options.checkpointEvery))
  return options
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
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

function extractDocs(payload: Data4LibraryResponse): Data4LibraryDoc[] {
  const docs = payload.response?.docs
  if (Array.isArray(docs)) return docs.flatMap((entry) => asArray(entry.doc))
  return asArray(docs?.doc)
}

function findRegistrationNumber(
  doc: Data4LibraryDoc,
  callNumber?: Data4LibraryCallNumber,
): string {
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

function makeDedupeKey(row: Omit<StandardHolding, 'id' | 'dedupeKey'>): string {
  const title = normalizeCompact(row.title)
  const author = normalizeCompact(row.author)
  const publisher = normalizeCompact(row.publisher)
  const isbn = normalizeIsbn(row.isbn)
  const callNumber = normalizeCompact(row.callNumber)

  if (row.registrationNumber) return `reg:${row.libCode}:${row.registrationNumber}`
  if (isbn && callNumber) {
    return `holding:${row.libCode}:${isbn}:${callNumber}:${row.registeredAt}:${title}`
  }
  if (isbn) return `book:${row.libCode}:${isbn}:${title}:${author}:${publisher}`
  return `text:${row.libCode}:${title}:${author}:${publisher}:${row.publicationYear}:${callNumber}`
}

function standardizeDoc(
  doc: Data4LibraryDoc,
  index: number,
  libCode: string,
  libraryName: string,
): StandardHolding {
  const callNumber = firstCallNumber(doc)
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
    registrationNumber: findRegistrationNumber(doc, callNumber),
  }
  const dedupeKey = makeDedupeKey(base)
  return { id: `${dedupeKey}:${index}`, dedupeKey, ...base }
}

async function requestPage(
  authKey: string,
  libCode: string,
  pageNo: number,
  pageSize: number,
  options: Options,
): Promise<Data4LibraryResponse> {
  const url = new URL(API_URL)
  url.searchParams.set('authKey', authKey)
  url.searchParams.set('libCode', libCode)
  url.searchParams.set('type', 'ALL')
  url.searchParams.set('pageNo', String(pageNo))
  url.searchParams.set('pageSize', String(pageSize))
  url.searchParams.set('format', 'json')

  let lastError: unknown
  for (let attempt = 1; attempt <= options.retries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return (await response.json()) as Data4LibraryResponse
    } catch (error) {
      lastError = error
      const waitMs = Math.min(30000, 1000 * 2 ** (attempt - 1))
      console.warn(
        `page ${pageNo} failed (${attempt}/${options.retries}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      if (attempt < options.retries) await sleep(waitMs)
    } finally {
      clearTimeout(timeout)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function nextSmallerDivisor(pageSize: number) {
  for (let candidate = Math.floor(pageSize / 2); candidate >= 1; candidate -= 1) {
    if (pageSize % candidate === 0) return candidate
  }
  return 1
}

async function requestPageDocs(
  authKey: string,
  libCode: string,
  pageNo: number,
  pageSize: number,
  options: Options,
): Promise<Data4LibraryDoc[]> {
  try {
    return extractDocs(await requestPage(authKey, libCode, pageNo, pageSize, options))
  } catch (error) {
    const smallerPageSize = nextSmallerDivisor(pageSize)
    if (smallerPageSize >= pageSize) throw error

    const subPageCount = pageSize / smallerPageSize
    const firstSubPage = ((pageNo - 1) * pageSize) / smallerPageSize + 1
    console.warn(
      `page ${pageNo} at pageSize ${pageSize} failed; retrying as ${subPageCount} smaller page(s) at pageSize ${smallerPageSize}`,
    )

    const docs: Data4LibraryDoc[] = []
    for (let index = 0; index < subPageCount; index += 1) {
      docs.push(
        ...(await requestPageDocs(
          authKey,
          libCode,
          firstSubPage + index,
          smallerPageSize,
          options,
        )),
      )
    }
    return docs
  }
}

async function readCheckpoint(filePath: string): Promise<CheckpointFile | undefined> {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8')) as CheckpointFile
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.tmp`
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
  await rename(tmpPath, filePath)
}

async function writeCheckpoint(filePath: string, checkpoint: CheckpointFile) {
  await writeJsonAtomic(filePath, { ...checkpoint, savedAt: new Date().toISOString() })
}

function dedupeRows(rows: StandardHolding[]) {
  const byKey = new Map<string, StandardHolding>()
  let skipped = 0
  for (const row of rows) {
    if (byKey.has(row.dedupeKey)) {
      skipped += 1
      continue
    }
    byKey.set(row.dedupeKey, row)
  }
  return { rows: [...byKey.values()], skipped }
}

function validationCounts(rows: StandardHolding[]) {
  return {
    isbnMissingCount: rows.filter((row) => !row.isbn).length,
    kdcMissingCount: rows.filter((row) => !row.kdc).length,
    titleMissingCount: rows.filter((row) => !row.title).length,
    callNumberMissingCount: rows.filter((row) => !row.callNumber).length,
    registeredAtMissingCount: rows.filter((row) => !row.registeredAt).length,
  }
}

async function writeOutputs(rows: StandardHolding[], meta: DataMeta, outputDir: string) {
  await mkdir(outputDir, { recursive: true })
  const latestPath = path.join(outputDir, 'holdings.latest.json')
  const metaPath = path.join(outputDir, 'holdings.meta.json')

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(outputDir, 'backup', stamp)
  await mkdir(backupDir, { recursive: true })
  await copyFile(latestPath, path.join(backupDir, 'holdings.latest.json')).catch(() => undefined)
  await copyFile(metaPath, path.join(backupDir, 'holdings.meta.json')).catch(() => undefined)

  await writeJsonAtomic(latestPath, rows)
  await writeJsonAtomic(metaPath, meta)
}

async function main() {
  await loadDotEnv()
  const options = readArgs()
  const authKey = getEnv('DATA4LIBRARY_KEY', 'LIBRARY_NARU_AUTH_KEY')
  const libCode = getEnv('LIB_CODE', 'DALSEONG_LIBRARY_CODE')
  const libraryName = getEnv('LIB_NAME', 'DALSEONG_LIBRARY_NAME', 'LIBRARY_NAME') ?? '달성군립도서관'
  if (!authKey) throw new Error('DATA4LIBRARY_KEY 또는 LIBRARY_NARU_AUTH_KEY가 없습니다.')
  if (!libCode) throw new Error('LIB_CODE 또는 DALSEONG_LIBRARY_CODE가 없습니다.')

  let checkpoint = !options.noResume ? await readCheckpoint(options.checkpointPath) : undefined
  if (
    checkpoint &&
    (checkpoint.libCode !== libCode || checkpoint.pageSize !== options.pageSize)
  ) {
    console.log('기존 checkpoint가 현재 설정과 달라 새로 시작합니다.')
    checkpoint = undefined
  }

  let rows = checkpoint?.rows ?? []
  let completedPage = checkpoint?.completedPage ?? 0
  let expectedTotal = checkpoint?.expectedTotal ?? 0
  let totalPages = checkpoint?.totalPages ?? 0

  if (!checkpoint) {
    const first = await requestPage(authKey, libCode, 1, options.pageSize, options)
    const firstDocs = extractDocs(first)
    expectedTotal = Number(first.response?.numFound ?? firstDocs.length)
    totalPages = Math.max(1, Math.ceil(expectedTotal / options.pageSize))
    rows = firstDocs.map((doc, index) => standardizeDoc(doc, index, libCode, libraryName))
    completedPage = 1
    await writeCheckpoint(options.checkpointPath, {
      version: 1,
      libCode,
      libraryName,
      pageSize: options.pageSize,
      expectedTotal,
      totalPages,
      completedPage,
      rows,
      savedAt: new Date().toISOString(),
    })
  }

  const stopPage = options.limitPages
    ? Math.min(totalPages, completedPage + options.limitPages)
    : totalPages
  console.log(
    `수집 시작: ${completedPage}/${totalPages}쪽 완료, 예상 ${expectedTotal.toLocaleString()}건, pageSize ${options.pageSize}`,
  )

  for (let pageNo = completedPage + 1; pageNo <= stopPage; pageNo += 1) {
    const pageDocs = await requestPageDocs(authKey, libCode, pageNo, options.pageSize, options)
    const offset = rows.length
    rows.push(
      ...pageDocs.map((doc, index) => standardizeDoc(doc, offset + index, libCode, libraryName)),
    )
    completedPage = pageNo
    console.log(
      `${pageNo}/${totalPages}쪽, ${rows.length.toLocaleString()}/${expectedTotal.toLocaleString()}건`,
    )
    if (pageNo % options.checkpointEvery === 0 || pageNo === stopPage) {
      await writeCheckpoint(options.checkpointPath, {
        version: 1,
        libCode,
        libraryName,
        pageSize: options.pageSize,
        expectedTotal,
        totalPages,
        completedPage,
        rows,
        savedAt: new Date().toISOString(),
      })
    }
  }

  if (completedPage < totalPages) {
    console.log(`중간 저장 완료: ${completedPage}/${totalPages}쪽. 같은 명령을 다시 실행하면 이어받습니다.`)
    return
  }

  const deduped = dedupeRows(rows)
  const now = new Date().toISOString()
  const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const meta: DataMeta = {
    baseDate: todayKst,
    lastUpdatedAt: now,
    totalCount: deduped.rows.length,
    libraryCode: libCode,
    libraryName,
    status: 'ready',
    source: 'data4library',
    syncMode: 'full',
    lastFullSyncAt: now,
    lastDailySyncAt: null,
    addedCount: deduped.rows.length,
    removedCount: 0,
    duplicateSkippedCount: deduped.skipped,
    apiCallCount: completedPage,
    expectedTotalFromApi: expectedTotal,
    collectedCountBeforeDedupe: rows.length,
    collectedCountAfterDedupe: deduped.rows.length,
    dedupeStrategy:
      'registrationNumber > isbn+callNumber+registeredAt+title > isbn+title+author+publisher > text fallback',
    message: `CLI 전체 수집기로 ${rows.length.toLocaleString()}건을 수집하고 중복 ${deduped.skipped.toLocaleString()}건을 제외했습니다.`,
    ...validationCounts(deduped.rows),
  }

  await writeOutputs(deduped.rows, meta, options.outputDir)
  await rm(options.checkpointPath, { force: true })
  console.log(
    `완료: ${deduped.rows.length.toLocaleString()}건 저장, 중복 제외 ${deduped.skipped.toLocaleString()}건`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
