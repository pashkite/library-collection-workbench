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

type MaterialType = 'book' | 'nonbook'

interface SearchDataset {
  rows: StoredBookHolding[]
  byShelf: Map<string, StoredBookHolding[]>
  byMaterial: Record<MaterialType, StoredBookHolding[]>
  newGeneralRows: StoredBookHolding[]
  estimatedNewGeneralShelf: boolean
}

interface CachedNewReleaseRows {
  rows: StoredBookHolding[]
  undatedCount: number
}

const DB_NAME = 'library-collection-workbench'
const DB_VERSION = 1
const META_KEY = 'holdings-meta'
const STORE_CHUNK_SIZE = 1000
const MAX_QUERY_CACHE_ENTRIES = 8
const NEW_GENERAL_SHELF_LABEL = '[신간] 종합자료실'
const NEW_GENERAL_LOOKBACK_DAYS = 90

let searchDatasetPromise: Promise<SearchDataset> | undefined
const materialTypeCache = new WeakMap<StoredBookHolding, MaterialType>()
const holdingQueryCache = new Map<string, StoredBookHolding[]>()
const newReleaseQueryCache = new Map<string, CachedNewReleaseRows>()

function invalidateRuntimeSearchCaches() {
  searchDatasetPromise = undefined
  holdingQueryCache.clear()
  newReleaseQueryCache.clear()
}

function rememberQueryResult<Value>(cache: Map<string, Value>, key: string, value: Value) {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)

  while (cache.size > MAX_QUERY_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) break
    cache.delete(oldestKey)
  }
}

function selectedShelfNames(
  filters: Pick<HoldingSearchFilters, 'shelfName' | 'shelfNames'>,
): string[] {
  const names =
    filters.shelfNames?.filter(Boolean) ?? (filters.shelfName ? [filters.shelfName] : [])
  return [...new Set(names)].sort((left, right) => left.localeCompare(right, 'ko'))
}

function holdingQueryKey(filters: HoldingSearchFilters) {
  return JSON.stringify({
    title: normalizeText(filters.title),
    author: normalizeText(filters.author),
    publisher: normalizeText(filters.publisher),
    isbn: normalizeIsbn(filters.isbn),
    materialType: filters.materialType,
    shelfNames: selectedShelfNames(filters),
  })
}

function newReleaseQueryKey(filters: NewReleaseFilters, baseDate?: string) {
  return JSON.stringify({
    collection: holdingQueryKey(filters),
    datePreset: filters.datePreset,
    kdcMajor: filters.kdcMajor,
    publicationYearFrom: filters.publicationYearFrom,
    includeUndated: filters.includeUndated,
    baseDate: baseDate ?? '',
  })
}

function isNewGeneralShelfName(value: string) {
  const normalized = normalizeText(value)
  return normalized.includes('신간') && normalized.includes('종합자료실')
}

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
  invalidateRuntimeSearchCaches()
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

  await updateStoredMeta(meta)
  invalidateRuntimeSearchCaches()
}

export async function updateStoredMeta(meta: DataMeta) {
  const db = await getDb()
  const transaction = db.transaction('meta', 'readwrite')
  await transaction.objectStore('meta').put({ key: META_KEY, value: meta })
  await transaction.done
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
  const shelves = selectedShelfNames(filters)
  const offset = (page - 1) * pageSize
  const hasAnyFilter = Boolean(
    normalizedFilters.title ||
      normalizedFilters.author ||
      normalizedFilters.publisher ||
      normalizedFilters.isbn ||
      shelves.length ||
      filters.materialType !== 'all',
  )

  if (!hasAnyFilter) {
    const db = await getDb()
    const total = await db.count('holdings')
    const rows: StoredBookHolding[] = []
    const store = db.transaction('holdings').store
    let cursor = await store.openCursor()
    if (cursor && offset > 0) cursor = await cursor.advance(offset)

    while (cursor && rows.length < pageSize) {
      rows.push(cursor.value)
      cursor = await cursor.continue()
    }

    void getSearchDataset().catch(() => undefined)
    return { rows, total, page, pageSize }
  }

  const queryKey = holdingQueryKey(filters)
  let matchedRows = holdingQueryCache.get(queryKey)

  if (!matchedRows) {
    const dataset = await getSearchDataset()
    const candidates = collectionCandidates(dataset, filters)
    matchedRows = candidates.filter(
      (row) =>
        (!normalizedFilters.title || row.normalizedTitle.includes(normalizedFilters.title)) &&
        (!normalizedFilters.author || row.normalizedAuthor.includes(normalizedFilters.author)) &&
        (!normalizedFilters.publisher ||
          row.normalizedPublisher.includes(normalizedFilters.publisher)) &&
        (!normalizedFilters.isbn || row.normalizedIsbn.includes(normalizedFilters.isbn)),
    )
    rememberQueryResult(holdingQueryCache, queryKey, matchedRows)
  }

  return {
    rows: matchedRows.slice(offset, offset + pageSize),
    total: matchedRows.length,
    page,
    pageSize,
  }
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

function getCachedMaterialType(row: StoredBookHolding): MaterialType {
  const cached = materialTypeCache.get(row)
  if (cached) return cached
  const materialType = getMaterialType(row)
  materialTypeCache.set(row, materialType)
  return materialType
}

async function getSearchDataset(): Promise<SearchDataset> {
  if (!searchDatasetPromise) {
    searchDatasetPromise = (async () => {
      const db = await getDb()
      const [rows, meta] = await Promise.all([db.getAll('holdings'), getStoredMeta()])
      const byShelf = new Map<string, StoredBookHolding[]>()
      const byMaterial: Record<MaterialType, StoredBookHolding[]> = {
        book: [],
        nonbook: [],
      }

      for (const row of rows) {
        const materialType = getCachedMaterialType(row)
        byMaterial[materialType].push(row)

        if (row.shelfName) {
          const shelfRows = byShelf.get(row.shelfName)
          if (shelfRows) shelfRows.push(row)
          else byShelf.set(row.shelfName, [row])
        }
      }

      const actualNewGeneralRows = [...byShelf.entries()]
        .filter(([shelfName]) => isNewGeneralShelfName(shelfName))
        .flatMap(([, shelfRows]) => shelfRows)
      const estimatedNewGeneralShelf = actualNewGeneralRows.length === 0
      let newGeneralRows = actualNewGeneralRows

      if (estimatedNewGeneralShelf) {
        const latestRegisteredTime = rows.reduce((latest, row) => {
          const time = parseDateValue(row.registeredAt)
          return time !== undefined && time > latest ? time : latest
        }, 0)
        const baseTime =
          (parseDateValue(meta?.baseDate ?? '') ?? latestRegisteredTime) || Date.now()
        const cutoff = baseTime - (NEW_GENERAL_LOOKBACK_DAYS - 1) * 24 * 60 * 60 * 1000
        newGeneralRows = rows.filter((row) => {
          if (!normalizeText(row.shelfName).includes('종합자료실')) return false
          const registeredTime = parseDateValue(row.registeredAt)
          return registeredTime !== undefined && registeredTime >= cutoff
        })
      }

      return { rows, byShelf, byMaterial, newGeneralRows, estimatedNewGeneralShelf }
    })()
  }

  return searchDatasetPromise
}

function collectionCandidates(
  dataset: SearchDataset,
  filters: Pick<HoldingSearchFilters, 'materialType' | 'shelfName' | 'shelfNames'>,
): StoredBookHolding[] {
  const shelves = selectedShelfNames(filters)

  if (shelves.length > 0) {
    const rows: StoredBookHolding[] = []
    const seenIds = new Set<string>()

    for (const shelfName of shelves) {
      const shelfRows =
        shelfName === NEW_GENERAL_SHELF_LABEL
          ? dataset.newGeneralRows
          : dataset.byShelf.get(shelfName) ?? []
      for (const row of shelfRows) {
        if (seenIds.has(row.id)) continue
        seenIds.add(row.id)
        rows.push(row)
      }
    }

    if (filters.materialType === 'all') return rows
    return rows.filter((row) => getCachedMaterialType(row) === filters.materialType)
  }

  if (filters.materialType === 'book') return dataset.byMaterial.book
  if (filters.materialType === 'nonbook') return dataset.byMaterial.nonbook
  return dataset.rows
}

export async function getHoldingFacetSnapshot() {
  const dataset = await getSearchDataset()
  const shelfNames = [...dataset.byShelf.keys()].filter(
    (shelfName) => !isNewGeneralShelfName(shelfName),
  )
  if (dataset.newGeneralRows.length > 0) shelfNames.push(NEW_GENERAL_SHELF_LABEL)

  return {
    shelfNames: shelfNames.sort((left, right) => left.localeCompare(right, 'ko')),
    bookCount: dataset.byMaterial.book.length,
    nonbookCount: dataset.byMaterial.nonbook.length,
    missingShelfCount: dataset.rows.filter((row) => !row.shelfName).length,
    estimatedNewGeneralShelf: dataset.estimatedNewGeneralShelf,
    newGeneralCount: dataset.newGeneralRows.length,
  }
}

export function getMaterialTypeLabel(
  row: Pick<StoredBookHolding, 'title' | 'author' | 'publisher' | 'callNumber' | 'shelfName' | 'kdc'>,
) {
  return getMaterialType(row) === 'nonbook' ? '비도서자료' : '도서자료'
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
  const queryKey = newReleaseQueryKey(filters, baseDate)
  let cached = newReleaseQueryCache.get(queryKey)

  if (!cached) {
    const dataset = await getSearchDataset()
    const candidates = collectionCandidates(dataset, filters)
    const rows: StoredBookHolding[] = []
    let undatedCount = 0

    for (const row of candidates) {
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
        (!normalizedFilters.kdcMajor || rowKdc.startsWith(normalizedFilters.kdcMajor)) &&
        (!normalizedFilters.title || row.normalizedTitle.includes(normalizedFilters.title)) &&
        (!normalizedFilters.author || row.normalizedAuthor.includes(normalizedFilters.author)) &&
        (!normalizedFilters.publisher ||
          row.normalizedPublisher.includes(normalizedFilters.publisher)) &&
        (!normalizedFilters.isbn || row.normalizedIsbn.includes(normalizedFilters.isbn))

      if (matched) {
        if (isUndated) undatedCount += 1
        rows.push(row)
      }
    }

    cached = { rows, undatedCount }
    rememberQueryResult(newReleaseQueryCache, queryKey, cached)
  }

  return {
    rows: cached.rows.slice(offset, offset + pageSize),
    total: cached.rows.length,
    page,
    pageSize,
    undatedCount: cached.undatedCount,
  }
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

  const dataset = await getSearchDataset()
  const scored: Array<{ row: StoredBookHolding; score: number }> = []

  for (const row of dataset.rows) {
    const score = similarScore(candidate, row)
    if (score >= 40) scored.push({ row, score })
  }

  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.row)
}

export async function getAllHoldings(): Promise<StoredBookHolding[]> {
  const dataset = await getSearchDataset()
  return dataset.rows
}

export async function clearHoldingsCache() {
  invalidateRuntimeSearchCaches()
  const db = await getDb()
  const transaction = db.transaction(['holdings', 'meta'], 'readwrite')
  await transaction.objectStore('holdings').clear()
  await transaction.objectStore('meta').delete(META_KEY)
  await transaction.done
  invalidateRuntimeSearchCaches()
}

export async function resetAllData() {
  await clearHoldingsCache()
  localStorage.removeItem('aladin-ttb-key')
}
