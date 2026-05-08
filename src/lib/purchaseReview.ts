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

type CellValue = string | number | boolean | Date | null | undefined

interface WorkbookTable {
  name: string
  rows: CellValue[][]
}

interface HeaderColumn {
  header: string
  index: number
}

interface WorkbookLayout {
  table: WorkbookTable
  headerRowIndex: number
  headers: string[]
  columns: HeaderColumn[]
  autoMapping: PurchaseColumnMapping
  score: number
  dataRowCount: number
}

interface WorkbookRows {
  headers: string[]
  rows: Record<string, unknown>[]
  autoMapping: PurchaseColumnMapping
}

const columnCandidates = {
  title: ['상품명', '도서명', '서명', '제목', '자료명'],
  author: ['저자/아티스트', '저자', '저자명', '지은이'],
  publisher: ['출판사/제작사', '출판사', '발행처', '출판처'],
  isbn: ['ISBN13', 'ISBN-13', 'ISBN 13', '국제표준도서번호', 'ISBN'],
  price: ['정가', '판매가', '가격'],
}

function cleanCellText(value: unknown): string {
  return String(value ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeHeaderName(value: string): string {
  return cleanCellText(value)
    .replace(/[\s\-_:./()]/g, '')
    .toLowerCase()
}

function findColumn(headers: string[], candidates: string[]) {
  for (const candidate of candidates.map(normalizeHeaderName)) {
    const header = headers.find((currentHeader) => normalizeHeaderName(currentHeader) === candidate)
    if (header) return header
  }

  return undefined
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

function looksLikeHtml(text: string): boolean {
  return /<(?:!doctype\s+html|html|table|tr|td|th)\b/i.test(text.slice(0, 5000))
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
}

function htmlTextToCell(value: string): string {
  return cleanCellText(decodeHtmlEntities(value.replace(/<[^>]*>/g, '')))
}

function parseHtmlTablesFallback(text: string): WorkbookTable[] {
  const tableMatches = [...text.matchAll(/<table\b[\s\S]*?<\/table>/gi)]

  return tableMatches
    .map((tableMatch, tableIndex) => {
      const tableHtml = tableMatch[0]
      const rows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)(?=<tr\b|<\/table>)/gi)]
        .map((rowMatch) => {
          const rowHtml = rowMatch[1]
          return [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) =>
            htmlTextToCell(cellMatch[1]),
          )
        })
        .filter((row) => row.length > 0)

      return {
        name: `HTML table ${tableIndex + 1}`,
        rows,
      }
    })
    .filter((table) => table.rows.length > 0)
}

function parseHtmlTables(text: string): WorkbookTable[] {
  if (typeof DOMParser === 'undefined') {
    return parseHtmlTablesFallback(text)
  }

  const document = new DOMParser().parseFromString(text, 'text/html')
  return Array.from(document.querySelectorAll('table'))
    .map((table, tableIndex) => ({
      name: `HTML table ${tableIndex + 1}`,
      rows: Array.from(table.rows)
        .map((row) => Array.from(row.cells).map((cell) => cleanCellText(cell.textContent)))
        .filter((row) => row.length > 0),
    }))
    .filter((table) => table.rows.length > 0)
}

async function readWorkbookTables(file: File): Promise<WorkbookTable[]> {
  const buffer = await file.arrayBuffer()
  const text = new TextDecoder('utf-8').decode(buffer)

  if (looksLikeHtml(text)) {
    const htmlTables = parseHtmlTables(text)
    if (htmlTables.length > 0) return htmlTables
  }

  const XLSX = await loadXlsx()
  const workbook = XLSX.read(buffer, { type: 'array' })
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const rows = sheet
      ? XLSX.utils.sheet_to_json<CellValue[]>(sheet, { header: 1, defval: '' })
      : []

    return {
      name,
      rows,
    }
  }).filter((table) => table.rows.length > 0)
}

function getHeaderColumns(row: CellValue[]): HeaderColumn[] {
  const usedHeaders = new Map<string, number>()

  return row.flatMap((cell, index) => {
    const baseHeader = cleanCellText(cell)
    if (!baseHeader) return []

    const usedCount = usedHeaders.get(baseHeader) ?? 0
    usedHeaders.set(baseHeader, usedCount + 1)

    return [
      {
        header: usedCount > 0 ? `${baseHeader}_${usedCount + 1}` : baseHeader,
        index,
      },
    ]
  })
}

function scoreMapping(mapping: PurchaseColumnMapping): number {
  return (
    (mapping.title ? 4 : 0) +
    (mapping.isbn ? 4 : 0) +
    (mapping.author ? 2 : 0) +
    (mapping.publisher ? 2 : 0) +
    (mapping.price ? 1 : 0)
  )
}

function countDataRows(table: WorkbookTable, headerRowIndex: number, columns: HeaderColumn[]): number {
  return table.rows
    .slice(headerRowIndex + 1)
    .filter((row) => columns.some((column) => cleanCellText(row[column.index]))).length
}

function isSummaryOrFooterRow(row: Record<string, unknown>): boolean {
  const values = Object.values(row).map(cleanCellText).filter(Boolean)
  if (values.length === 0) return true

  const joinedValues = values.join(' ')
  if (/좋은 책을 고르는 방법,\s*알라딘/i.test(joinedValues)) return true
  if (values[0] === '합계') return true
  if (values.includes('합계') && values.some((value) => /^[0-9,]+$/.test(value))) return true

  return false
}

function getLayoutForHeaderRow(table: WorkbookTable, headerRowIndex: number): WorkbookLayout | undefined {
  const columns = getHeaderColumns(table.rows[headerRowIndex] ?? [])
  const headers = columns.map((column) => column.header)
  if (headers.length < 2) return undefined

  const autoMapping = autoDetectColumns(headers)
  if (!autoMapping.title && !autoMapping.isbn) return undefined

  const dataRowCount = countDataRows(table, headerRowIndex, columns)
  if (dataRowCount === 0) return undefined

  return {
    table,
    headerRowIndex,
    headers,
    columns,
    autoMapping,
    score: scoreMapping(autoMapping),
    dataRowCount,
  }
}

function findBestLayout(tables: WorkbookTable[]): WorkbookLayout | undefined {
  const layouts = tables.flatMap((table) =>
    table.rows.flatMap((_, rowIndex) => {
      const layout = getLayoutForHeaderRow(table, rowIndex)
      return layout ? [layout] : []
    }),
  )

  return layouts.sort((a, b) => b.score - a.score || b.dataRowCount - a.dataRowCount)[0]
}

async function readPurchaseWorkbookRows(file: File): Promise<WorkbookRows> {
  const tables = await readWorkbookTables(file)
  const layout = findBestLayout(tables)
  if (!layout) throw new Error('도서명 또는 ISBN 열이 있는 엑셀 표를 찾지 못했습니다.')

  const rows = layout.table.rows
    .slice(layout.headerRowIndex + 1)
    .map((row) =>
      Object.fromEntries(
        layout.columns.map((column) => [column.header, cleanCellText(row[column.index])]),
      ),
    )
    .filter((row) => !isSummaryOrFooterRow(row))

  if (rows.length === 0) throw new Error('엑셀 파일에 검토할 행이 없습니다.')

  return {
    headers: layout.headers,
    rows,
    autoMapping: layout.autoMapping,
  }
}

export async function parsePurchaseWorkbook(file: File): Promise<PurchaseCandidate[]> {
  return parsePurchaseWorkbookWithMapping(file)
}

export async function readPurchaseWorkbookPreview(file: File): Promise<WorkbookPreview> {
  const { headers, rows, autoMapping } = await readPurchaseWorkbookRows(file)
  return {
    headers,
    sampleRows: rows.slice(0, 3).map((row) =>
      Object.fromEntries(headers.map((header) => [header, String(row[header] ?? '')])),
    ),
    autoMapping,
  }
}

export async function parsePurchaseWorkbookWithMapping(
  file: File,
  mapping?: PurchaseColumnMapping,
): Promise<PurchaseCandidate[]> {
  const { rows, autoMapping } = await readPurchaseWorkbookRows(file)
  const detected = autoMapping
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
  }).filter((candidate) => candidate.title || candidate.isbn || candidate.normalizedIsbn)
}

export async function reviewPurchaseCandidates(
  candidates: PurchaseCandidate[],
  onProgress?: (processed: number, total: number) => void,
): Promise<PurchaseReviewResult[]> {
  const results: PurchaseReviewResult[] = []

  for (const [index, candidate] of candidates.entries()) {
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

    onProgress?.(index + 1, candidates.length)
  }

  return results
}
