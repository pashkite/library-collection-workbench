import type {
  BookHolding,
  DataMeta,
  PurchaseReviewResult,
  SelectionBasis,
  StoredBookHolding,
} from '../types/library'

async function loadXlsx() {
  return import('xlsx')
}

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

export async function downloadHoldingsExcel(rows: StoredBookHolding[], fileName: string, meta?: DataMeta) {
  const XLSX = await loadXlsx()
  const worksheet = XLSX.utils.json_to_sheet(toHoldingExcelRows(rows, meta), {
    header: holdingHeaders,
  })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '소장목록')
  XLSX.writeFile(workbook, fileName, { compression: true })
}

export async function downloadReviewExcel(rows: PurchaseReviewResult[], fileName: string) {
  const XLSX = await loadXlsx()
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => {
      const primaryMatch = row.matchedHolding ?? row.similarHoldings?.[0]

      return {
        도서명: row.title,
        저자: row.author,
        출판사: row.publisher,
        ISBN: row.isbn,
        가격: row.price ?? '',
        중복판정: row.duplicateStatus,
        검토결과: row.reviewResult,
        '기존/유사 소장 도서명': primaryMatch?.title ?? '',
        '기존/유사 소장 저자': primaryMatch?.author ?? '',
        '기존/유사 소장 출판사': primaryMatch?.publisher ?? '',
        '기존/유사 소장 출판연도': primaryMatch?.publicationYear ?? '',
        '기존/유사 소장 KDC': primaryMatch?.kdc ?? '',
        '기존/유사 소장 ISBN': primaryMatch?.isbn ?? '',
        '유사 소장자료': row.similarHoldings
          ?.map((holding) => `${holding.title} / ${holding.author} / ${holding.publisher}`)
          .join('\n') ?? '',
        비고: row.note,
      }
    }),
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '구입후보검토')
  XLSX.writeFile(workbook, fileName, { compression: true })
}

export async function downloadSelectionBasisExcel(rows: SelectionBasis[], fileName: string) {
  const XLSX = await loadXlsx()
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      도서명: row.title,
      저자: row.author ?? '',
      출판사: row.publisher ?? '',
      ISBN: row.isbn,
      추천도서: row.recommendedBook ? 'Y' : '',
      세종도서: row.sejongBook ? 'Y' : '',
      문학상: row.awardName ?? '',
      절판여부: row.outOfPrint ? 'Y' : '',
      저자검토: row.authorReviewStatus ?? '확인 전',
      알라딘_판매상태: row.aladinDetail?.stockStatus ?? '',
      알라딘_정가: row.aladinDetail?.priceStandard ?? '',
      알라딘_분야: row.aladinDetail?.categoryName ?? '',
      알라딘_URL: row.aladinDetail?.link ?? '',
      담당자메모: row.staffMemo ?? '',
    })),
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '선정근거')
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
