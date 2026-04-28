import * as XLSX from 'xlsx'
import type { PurchaseCandidate, PurchaseReviewResult } from '../types/library'
import { normalizeIsbn } from '../utils/normalize'
import { findHoldingByIsbn } from './libraryDb'

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

function readPrice(value: unknown): number | undefined {
  const normalized = String(value ?? '').replace(/[^0-9]/g, '')
  if (!normalized) return undefined
  return Number(normalized)
}

export async function parsePurchaseWorkbook(file: File): Promise<PurchaseCandidate[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error('엑셀 파일에서 첫 번째 시트를 찾지 못했습니다.')

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (rows.length === 0) throw new Error('엑셀 파일에 검토할 행이 없습니다.')

  const headers = Object.keys(rows[0])
  const titleColumn = findColumn(headers, columnCandidates.title)
  const authorColumn = findColumn(headers, columnCandidates.author)
  const publisherColumn = findColumn(headers, columnCandidates.publisher)
  const isbnColumn = findColumn(headers, columnCandidates.isbn)
  const priceColumn = findColumn(headers, columnCandidates.price)

  if (!titleColumn && !isbnColumn) {
    throw new Error('도서명 또는 ISBN 열을 자동 인식하지 못했습니다. 수동 매핑 UI는 Phase 2 TODO입니다.')
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

    results.push({
      ...candidate,
      duplicateStatus: matchedHolding ? 'ISBN 중복' : '구입 검토',
      reviewResult: matchedHolding ? '기존 소장 확인' : '담당자 검토 필요',
      matchedHolding,
      note: matchedHolding
        ? '소장목록 ISBN과 완전 일치합니다.'
        : candidate.normalizedIsbn
          ? 'ISBN 완전 일치 소장자료가 없습니다.'
          : 'ISBN이 없어 서명·저자 유사 중복 검토가 필요합니다. Phase 2 TODO.',
    })
  }

  return results
}
