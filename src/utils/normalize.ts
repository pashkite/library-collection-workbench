import type { BookHolding, StoredBookHolding } from '../types/library'

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function normalizeCompact(value: unknown): string {
  return normalizeText(value).replace(/[\s\-_:./]/g, '')
}

export function normalizeIsbn(value: unknown): string {
  return String(value ?? '').replace(/[^0-9Xx]/g, '').toUpperCase()
}

export function normalizeKdc(value: unknown): string {
  return String(value ?? '').trim().replace(/[^0-9.]/g, '')
}

export function toStoredHolding(
  holding: BookHolding,
  index: number,
  dataBaseDate: string,
): StoredBookHolding {
  const normalizedIsbn = normalizeIsbn(holding.isbn)
  return {
    ...holding,
    id: `${normalizedIsbn || 'no-isbn'}-${normalizeCompact(holding.title).slice(0, 24)}-${index}`,
    normalizedTitle: normalizeText(holding.title),
    normalizedAuthor: normalizeText(holding.author),
    normalizedPublisher: normalizeText(holding.publisher),
    normalizedIsbn,
    normalizedKdc: normalizeKdc(holding.kdc),
    dataBaseDate,
  }
}
