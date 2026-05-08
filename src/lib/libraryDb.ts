import { openDB, type DBSchema } from 'idb'
import type {
  DataMeta,
  HoldingSearchFilters,
  HoldingSearchResult,
  NewReleaseFilters,
  NewReleaseSearchResult,
  PurchaseCandidate,
  StoredBookHolding,
} from '../types/library'
import { normalizeCompact, normalizeIsbn, normalizeKdc, normalizeText } from '../utils/normalize'

interface KeyValueRecord {
  key: string
  value: unknown
}

interface LibraryWorkDb extends DBSchema {
  holdings: {
    key: string
    value: StoredBookHolding
    indexes: {
      'by-title': string
      'by-author': string
      'by-publisher': string
      'by-isbn': string
      'by-kdc': string
    }
  }
  meta: {
    key: string
    value: KeyValueRecord
  }
}

const DB_NAME = 'library-collection-workbench'
const DB_VERSION = 1
const META_KEY = 'holdings-meta'
const STORE_CHUNK_SIZE = 1000

export async function getDb() {
  return openDB<LibraryWorkDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('holdings')) {
        const store = db.createObjectStore('holdings', { keyPath: 'id' })
        store.createIndex('by-title', 'normalizedTitle')
        store.createIndex('by-author', 'normalizedAuthor')
        store.createIndex('by-publisher', 'normalizedPublisher')
        store.createIndex('by-isbn', 'normalizedIsbn')
        store.createIndex('by-kdc', 'normalizedKdc')
      }

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
    },
  })
}

export async function replaceHoldings(
  rows: StoredBookHolding[],
  meta: DataMeta,
  onProgress?: (processed: number, total: number) => void,
) {
  const db = await getDb()
  const resetTransaction = db.transaction(['holdings', 'meta'], 'readwrite')
  await resetTransaction.objectStore('holdings').clear()
  await resetTransaction.objectStore('meta').delete(META_KEY)
  await resetTransaction.done

  for (let index = 0; index < rows.length; index += STORE_CHUNK_SIZE) {
    const transaction = db.transaction('holdings', 'readwrite')
    const store = transaction.objectStore('holdings')
    const chunk = rows.slice(index, index + STORE_CHUNK_SIZE)

    for (const row of chunk) {
      store.put(row)
    }

    await transaction.done
    const processed = Math.min(index + chunk.length, rows.length)
    onProgress?.(processed, rows.length)
  }

  const metaTransaction = db.transaction('meta', 'readwrite')
  await metaTransaction.objectStore('meta').put({ key: META_KEY, value: meta })
  await metaTransaction.done
}

export async function getStoredMeta(): Promise<DataMeta | undefined> {
  const db = await getDb()
  const record = await db.get('meta', META_KEY)
  return record?.value as DataMeta | undefined
}

export async function getHoldingsCount(): Promise<number> {
  const db = await getDb()
  return db.count('holdings')
}

export async function getStoredDataInfo() {
  const [meta, count] = await Promise.all([getStoredMeta(), getHoldingsCount()])
  return { meta, count }
}

export async function getSampleHolding(): Promise<StoredBookHolding | undefined> {
  const db = await getDb()
  const cursor = await db.transaction('holdings').store.openCursor()
  return cursor?.value
}

export async function searchHoldings(
  filters: HoldingSearchFilters,
  page: number,
  pageSize: number,
): Promise<HoldingSearchResult> {
  const normalizedFilters = {
    title: normalizeText(filters.title),
    author: normalizeText(filters.author),
    publisher: normalizeText(filters.publisher),
    isbn: normalizeIsbn(filters.isbn),
  }
  const offset = (page - 1) * pageSize
  const rows: StoredBookHolding[] = []
  let total = 0
  const db = await getDb()
  const hasTextFilters = Boolean(
    normalizedFilters.title ||
      normalizedFilters.author ||
      normalizedFilters.publisher ||
      normalizedFilters.isbn ||
      filters.shelfName,
  )

  if (!hasTextFilters && filters.materialType === 'all') {
    total = await db.count('holdings')
    const store = db.transaction('holdings').store
    let cursor = await store.openCursor()
    if (cursor && offset > 0) cursor = await cursor.advance(offset)

    while (cursor && rows.length < pageSize) {
      rows.push(cursor.value)
      cursor = await cursor.continue()
    }

    return { rows, total, page, pageSize }
  }

  const store = db.transaction('holdings').store
  let cursor = await store.openCursor()

  while (cursor) {
    const row = cursor.value
    const matched =
      matchesCollectionFilters(row, filters) &&
      (!normalizedFilters.title || row.normalizedTitle.includes(normalizedFilters.title)) &&
      (!normalizedFilters.author || row.normalizedAuthor.includes(normalizedFilters.author)) &&
      (!normalizedFilters.publisher ||
        row.normalizedPublisher.includes(normalizedFilters.publisher)) &&
      (!normalizedFilters.isbn || row.normalizedIsbn.includes(normalizedFilters.isbn))

    if (matched) {
      if (total >= offset && rows.length < pageSize) rows.push(row)
      total += 1
    }
    cursor = await cursor.continue()
  }

  return { rows, total, page, pageSize }
}

function parseDateValue(value: string): number | undefined {
  const normalized = value.trim().replace(/[./]/g, '-')
  const compact = normalized.replace(/-/g, '')
  const iso =
    /^\d{8}$/.test(compact)
      ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
      : normalized
  const time = Date.parse(`${iso}T00:00:00.000Z`)
  return Number.isNaN(time) ? undefined : time
}

function kdcFromHolding(row: StoredBookHolding): string {
  const direct = normalizeKdc(row.kdc)
  if (direct) return direct
  const match = row.callNumber.match(/\d{1,3}(?:\.\d+)?/)
  return normalizeKdc(match?.[0])
}

function publicationYear(row: StoredBookHolding): number | undefined {
  const match = row.publicationYear.match(/\d{4}/)
  if (!match) return undefined
  const value = Number(match[0])
  return Number.isFinite(value) ? value : undefined
}

export function getMaterialType(
  row: Pick<StoredBookHolding, 'title' | 'author' | 'publisher' | 'callNumber' | 'shelfName' | 'kdc'>,
) {
  const shelfAndCall = normalizeText(`${row.shelfName} ${row.callNumber}`)
  const title = normalizeText(row.title)
  const author = normalizeText(row.author)
  const publisher = normalizeText(row.publisher)
  const kdc = normalizeKdc(row.kdc)
  const mediaLocationOrPublisher =
    /(디지털자료실|비도서|오디오북|녹음|영상|전자자료|dvd|cd-rom|multimedia|blu-ray|블루레이)/i.test(
      `${shelfAndCall} ${publisher}`,
    )
  const mediaTitleMarker = /(\[dvd\]|\(dvd\)|: ?dvd|\[blu-ray\]|\(blu-ray\)|\[cd\]|\(cd\))/i.test(
    title,
  )
  const movieRecord = /^688(?:\.|$)/.test(kdc) && /(감독|연출|제작|(^|\s)감(\s|$))/.test(author)

  if (mediaLocationOrPublisher || mediaTitleMarker || movieRecord) {
    return 'nonbook' as const
  }
  return 'book' as const
}

export function getMaterialTypeLabel(
  row: Pick<StoredBookHolding, 'title' | 'author' | 'publisher' | 'callNumber' | 'shelfName' | 'kdc'>,
) {
  return getMaterialType(row) === 'nonbook' ? '비도서자료' : '도서자료'
}

function matchesCollectionFilters(
  row: StoredBookHolding,
  filters: Pick<HoldingSearchFilters, 'materialType' | 'shelfName'>,
) {
  return (
    (filters.materialType === 'all' || getMaterialType(row) === filters.materialType) &&
    (!filters.shelfName || row.shelfName === filters.shelfName)
  )
}

function dateCutoff(datePreset: NewReleaseFilters['datePreset'], baseDate?: string) {
  if (datePreset === 'all') return undefined
  const days = Number(datePreset)
  const baseTime = parseDateValue(baseDate ?? '') ?? Date.now()
  return baseTime - (days - 1) * 24 * 60 * 60 * 1000
}

export async function searchNewReleases(
  filters: NewReleaseFilters,
  page: number,
  pageSize: number,
  baseDate?: string,
): Promise<NewReleaseSearchResult> {
  const normalizedFilters = {
    title: normalizeText(filters.title),
    author: normalizeText(filters.author),
    publisher: normalizeText(filters.publisher),
    isbn: normalizeIsbn(filters.isbn),
    kdcMajor: filters.kdcMajor,
    publicationYearFrom: Number(filters.publicationYearFrom),
  }
  const cutoff = dateCutoff(filters.datePreset, baseDate)
  const offset = (page - 1) * pageSize
  const rows: StoredBookHolding[] = []
  let total = 0
  let undatedCount = 0
  const db = await getDb()
  let cursor = await db.transaction('holdings').store.openCursor()

  while (cursor) {
    const row = cursor.value
    const rowKdc = kdcFromHolding(row)
    const rowDate = parseDateValue(row.registeredAt)
    const rowYear = publicationYear(row)
    const isUndated = !rowDate
    const matchedDate =
      !cutoff ||
      (rowDate !== undefined && rowDate >= cutoff) ||
      (filters.includeUndated && isUndated)
    const matchedYear =
      !Number.isFinite(normalizedFilters.publicationYearFrom) ||
      (rowYear !== undefined && rowYear >= normalizedFilters.publicationYearFrom)
    const matched =
      matchedDate &&
      matchedYear &&
      matchesCollectionFilters(row, filters) &&
      (!normalizedFilters.kdcMajor || rowKdc.startsWith(normalizedFilters.kdcMajor)) &&
      (!normalizedFilters.title || row.normalizedTitle.includes(normalizedFilters.title)) &&
      (!normalizedFilters.author || row.normalizedAuthor.includes(normalizedFilters.author)) &&
      (!normalizedFilters.publisher ||
        row.normalizedPublisher.includes(normalizedFilters.publisher)) &&
      (!normalizedFilters.isbn || row.normalizedIsbn.includes(normalizedFilters.isbn))

    if (matched) {
      if (isUndated) undatedCount += 1
      if (total >= offset && rows.length < pageSize) rows.push(row)
      total += 1
    }
    cursor = await cursor.continue()
  }

  return { rows, total, page, pageSize, undatedCount }
}

function tokenSet(value: string) {
  return new Set(
    normalizeText(value)
      .split(/[^0-9a-z가-힣]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  )
}

function overlapScore(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return 0
  let hit = 0
  for (const token of left) {
    if (right.has(token)) hit += 1
  }
  return hit / Math.max(left.size, right.size)
}

function similarScore(candidate: PurchaseCandidate, row: StoredBookHolding) {
  const candidateTitle = normalizeText(candidate.title)
  const rowTitle = row.normalizedTitle
  const compactCandidateTitle = normalizeCompact(candidate.title)
  const compactRowTitle = normalizeCompact(row.title)
  let score = 0

  if (candidateTitle && candidateTitle === rowTitle) score += 60
  else if (
    compactCandidateTitle.length >= 4 &&
    (compactRowTitle.includes(compactCandidateTitle) ||
      compactCandidateTitle.includes(compactRowTitle))
  ) {
    score += 44
  } else {
    score += overlapScore(tokenSet(candidate.title), tokenSet(row.title)) * 42
  }

  score += overlapScore(tokenSet(candidate.author), tokenSet(row.author)) * 24
  score += overlapScore(tokenSet(candidate.publisher), tokenSet(row.publisher)) * 14
  if (candidate.normalizedIsbn && row.normalizedIsbn.includes(candidate.normalizedIsbn.slice(0, 10))) {
    score += 10
  }

  return score
}

export async function findSimilarHoldings(
  candidate: PurchaseCandidate,
  limit = 3,
): Promise<StoredBookHolding[]> {
  if (!normalizeCompact(candidate.title) && !candidate.normalizedIsbn) return []
  const scored: Array<{ row: StoredBookHolding; score: number }> = []
  const db = await getDb()
  let cursor = await db.transaction('holdings').store.openCursor()

  while (cursor) {
    const row = cursor.value
    if (candidate.normalizedIsbn && row.normalizedIsbn === candidate.normalizedIsbn) {
      cursor = await cursor.continue()
      continue
    }
    const score = similarScore(candidate, row)
    if (score >= 48) scored.push({ row, score })
    cursor = await cursor.continue()
  }

  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.row)
}

export async function getAllHoldings(): Promise<StoredBookHolding[]> {
  const db = await getDb()
  return db.getAll('holdings')
}

export async function getHoldingFacetOptions() {
  const db = await getDb()
  const shelfNames = new Set<string>()
  let bookCount = 0
  let nonbookCount = 0
  let missingShelfCount = 0
  let cursor = await db.transaction('holdings').store.openCursor()

  while (cursor) {
    const row = cursor.value
    if (row.shelfName) shelfNames.add(row.shelfName)
    else missingShelfCount += 1

    if (getMaterialType(row) === 'nonbook') nonbookCount += 1
    else bookCount += 1
    cursor = await cursor.continue()
  }

  return {
    shelfNames: [...shelfNames].sort((left, right) => left.localeCompare(right, 'ko')),
    bookCount,
    nonbookCount,
    missingShelfCount,
  }
}

export async function findHoldingByIsbn(isbn: string): Promise<StoredBookHolding | undefined> {
  const normalizedIsbn = normalizeIsbn(isbn)
  if (!normalizedIsbn) return undefined
  const db = await getDb()
  return db.getFromIndex('holdings', 'by-isbn', normalizedIsbn)
}

export async function clearHoldingsCache() {
  const db = await getDb()
  const transaction = db.transaction(['holdings', 'meta'], 'readwrite')
  await transaction.objectStore('holdings').clear()
  await transaction.objectStore('meta').delete(META_KEY)
  await transaction.done
}

export async function resetAllData() {
  const db = await getDb()
  await db.clear('holdings')
  await db.clear('meta')
  localStorage.removeItem('aladin-ttb-key')
}
