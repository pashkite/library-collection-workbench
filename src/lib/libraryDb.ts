import { openDB, type DBSchema } from 'idb'
import type {
  DataMeta,
  HoldingSearchFilters,
  HoldingSearchResult,
  StoredBookHolding,
} from '../types/library'
import { normalizeIsbn, normalizeText } from '../utils/normalize'

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
  const transaction = db.transaction(['holdings', 'meta'], 'readwrite')
  await transaction.objectStore('holdings').clear()

  let processed = 0
  for (const row of rows) {
    await transaction.objectStore('holdings').put(row)
    processed += 1
    if (processed % 25 === 0 || processed === rows.length) {
      onProgress?.(processed, rows.length)
    }
  }

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
  const offset = (page - 1) * pageSize
  const rows: StoredBookHolding[] = []
  let total = 0
  const db = await getDb()
  let cursor = await db.transaction('holdings').store.openCursor()

  while (cursor) {
    const row = cursor.value
    const matched =
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

export async function getAllHoldings(): Promise<StoredBookHolding[]> {
  const db = await getDb()
  return db.getAll('holdings')
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
