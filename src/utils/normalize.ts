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

export function formatCallNumber(
  holding: Pick<BookHolding, 'kdc' | 'callNumber'>,
): string {
  const kdc = String(holding.kdc ?? '').trim()
  const callNumber = String(holding.callNumber ?? '').trim()

  if (!kdc) return callNumber
  if (!callNumber) return kdc

  const normalizedKdc = normalizeKdc(kdc)
  const callNumberKdc = callNumber.match(/\d{1,3}(?:\.\d+)?/)?.[0]

  if (callNumberKdc && normalizeKdc(callNumberKdc) === normalizedKdc) {
    return callNumber
  }

  return `${kdc} ${callNumber}`.replace(/\s+/g, ' ').trim()
}

export function toStoredHolding(
  holding: BookHolding,
  index: number,
  dataBaseDate: string,
): StoredBookHolding {
  const normalizedIsbn = normalizeIsbn(holding.isbn)
  return {
    ...holding,
    callNumber: formatCallNumber(holding),
    id: `${normalizedIsbn || 'no-isbn'}-${normalizeCompact(holding.title).slice(0, 24)}-${index}`,
    normalizedTitle: normalizeText(holding.title),
    normalizedAuthor: normalizeText(holding.author),
    normalizedPublisher: normalizeText(holding.publisher),
    normalizedIsbn,
    normalizedKdc: normalizeKdc(holding.kdc),
    dataBaseDate,
  }
}
