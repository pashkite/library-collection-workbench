import type { StoredBookHolding } from '../types/library'
import { normalizeIsbn } from '../utils/normalize'
import { getDb, getMaterialType } from './libraryDb'

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
