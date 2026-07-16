import type { StoredBookHolding } from '../types/library'
import { normalizeIsbn } from '../utils/normalize'
import { getDb, getHoldingFacetSnapshot } from './libraryDb'

export async function getHoldingFacetOptions() {
  return getHoldingFacetSnapshot()
}

export async function findHoldingByIsbn(isbn: string): Promise<StoredBookHolding | undefined> {
  const normalizedIsbn = normalizeIsbn(isbn)
  if (!normalizedIsbn) return undefined
  const db = await getDb()
  return db.getFromIndex('holdings', 'by-isbn', normalizedIsbn)
}
