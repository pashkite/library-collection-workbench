import type {
  PurchaseCandidate,
  PurchaseColumnMapping,
  PurchaseReviewResult,
  WorkbookPreview,
} from '../types/library'
import { normalizeIsbn } from '../utils/normalize'
import { findHoldingByIsbn, findSimilarHoldings } from './libraryDb'

async function loadXlsx() {
  return import('xlsx')
}

const columnCandidates = {
  title: ['도서명', '서명', '제목', '자료명'],
  author: ['저자', '저자명', '지은이'],
  publisher: ['출판사', '발행처', '출판처'],
  isbn: ['ISBN', '국제표준도서번호'],
  price: ['가격', '정가'],
}

function findColumn(headers: string[], candidates: string[]) {
  return headers.find((header) =>
    candidates.some((candidate) => header.trim().toLowerCase() === candidate.toLowerCase()),
  )
}

function autoDetectColumns(headers: string[]): PurchaseColumnMapping {
  return {
    title: findColumn(headers, columnCandidates.title),
    author: findColumn(headers, columnCandidates.author),
    publisher: findColumn(headers, columnCandidates.publisher),
    isbn: findColumn(headers, columnCandidates.isbn),
    price: findColumn(headers, columnCandidates.price),
  }
}

function readPrice(value: unknown): number | undefined {
  const normalized = String(value ?? '').replace(/[^0-9]/g, '')
  if (!normalized) return undefined
  return Number(normalized)
}

export async function parsePurchaseWorkbook(file: File): Promise<PurchaseCandidate[]> {
  return parsePurchaseWorkbookWithMapping(file)
}

export async function readPurchaseWorkbookPreview(file: File): Promise<WorkbookPreview> {
  const XLSX = await loadXlsx()
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error('엑셀 파일에서 첫 번째 시트를 찾지 못했습니다.')

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (rows.length === 0) throw new Error('엑셀 파일에 검토할 행이 없습니다.')

  const headers = Object.keys(rows[0])
  return {
    headers,
    sampleRows: rows.slice(0, 3).map((row) =>
      Object.fromEntries(headers.map((header) => [header, String(row[header] ?? '')])),
    ),
    autoMapping: autoDetectColumns(headers),
  }
}

export async function parsePurchaseWorkbookWithMapping(
  file: File,
  mapping?: PurchaseColumnMapping,
): Promise<PurchaseCandidate[]> {
  const XLSX = await loadXlsx()
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error('엑셀 파일에서 첫 번째 시트를 찾지 못했습니다.')

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (rows.length === 0) throw new Error('엑셀 파일에 검토할 행이 없습니다.')

  const headers = Object.keys(rows[0])
  const detected = autoDetectColumns(headers)
  const titleColumn = mapping?.title || detected.title
  const authorColumn = mapping?.author || detected.author
  const publisherColumn = mapping?.publisher || detected.publisher
  const isbnColumn = mapping?.isbn || detected.isbn
  const priceColumn = mapping?.price || detected.price

  if (!titleColumn && !isbnColumn) {
    throw new Error('도서명 또는 ISBN 열을 지정해야 합니다.')
  }

  return rows.map((row, index) => {
    const isbn = isbnColumn ? String(row[isbnColumn] ?? '') : ''
    return {
      id: `candidate-${index + 1}`,
      title: titleColumn ? String(row[titleColumn] ?? '').trim() : '',
      author: authorColumn ? String(row[authorColumn] ?? '').trim() : '',
      publisher: publisherColumn ? String(row[publisherColumn] ?? '').trim() : '',
      isbn,
      price: priceColumn ? readPrice(row[priceColumn]) : undefined,
      normalizedIsbn: normalizeIsbn(isbn),
    }
  })
}

export async function reviewPurchaseCandidates(
  candidates: PurchaseCandidate[],
): Promise<PurchaseReviewResult[]> {
  const results: PurchaseReviewResult[] = []

  for (const candidate of candidates) {
    const matchedHolding = candidate.normalizedIsbn
      ? await findHoldingByIsbn(candidate.normalizedIsbn)
      : undefined
    const similarHoldings = matchedHolding ? [] : await findSimilarHoldings(candidate)
    const hasSimilar = similarHoldings.length > 0

    results.push({
      ...candidate,
      duplicateStatus: matchedHolding ? 'ISBN 중복' : hasSimilar ? '유사 중복 의심' : '구입 검토',
      reviewResult: matchedHolding
        ? '기존 소장 확인'
        : hasSimilar
          ? '유사 자료 확인 필요'
          : '담당자 검토 필요',
      matchedHolding,
      similarHoldings,
      note: matchedHolding
        ? '소장목록 ISBN과 완전 일치합니다.'
        : hasSimilar
          ? '서명, 저자, 출판사 기준으로 유사 소장자료가 있습니다.'
          : candidate.normalizedIsbn
          ? 'ISBN 완전 일치 소장자료가 없습니다.'
          : 'ISBN이 없어 서명·저자 기준으로 검토했습니다.',
    })
  }

  return results
}
