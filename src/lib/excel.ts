import * as XLSX from 'xlsx'
import type { BookHolding, DataMeta, PurchaseReviewResult, StoredBookHolding } from '../types/library'

const holdingHeaders = [
  '도서명',
  '저자',
  '출판사',
  '출판연도',
  'ISBN',
  'KDC',
  '청구기호',
  '배가명',
  '등록일',
  '데이터 기준일',
]

export function toHoldingExcelRows(rows: StoredBookHolding[], meta?: DataMeta) {
  return rows.map((row) => ({
    도서명: row.title,
    저자: row.author,
    출판사: row.publisher,
    출판연도: row.publicationYear,
    ISBN: row.isbn,
    KDC: row.kdc,
    청구기호: row.callNumber,
    배가명: row.shelfName,
    등록일: row.registeredAt,
    '데이터 기준일': row.dataBaseDate || meta?.baseDate || '',
  }))
}

export function downloadHoldingsExcel(rows: StoredBookHolding[], fileName: string, meta?: DataMeta) {
  const worksheet = XLSX.utils.json_to_sheet(toHoldingExcelRows(rows, meta), {
    header: holdingHeaders,
  })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '소장목록')
  XLSX.writeFile(workbook, fileName, { compression: true })
}

export function downloadReviewExcel(rows: PurchaseReviewResult[], fileName: string) {
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      도서명: row.title,
      저자: row.author,
      출판사: row.publisher,
      ISBN: row.isbn,
      가격: row.price ?? '',
      중복판정: row.duplicateStatus,
      검토결과: row.reviewResult,
      '기존 소장 도서명': row.matchedHolding?.title ?? '',
      '기존 소장 저자': row.matchedHolding?.author ?? '',
      '기존 소장 출판사': row.matchedHolding?.publisher ?? '',
      '기존 소장 ISBN': row.matchedHolding?.isbn ?? '',
      비고: row.note,
    })),
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '구입후보검토')
  XLSX.writeFile(workbook, fileName, { compression: true })
}

export function downloadJsonBackup(rows: BookHolding[], fileName: string) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
