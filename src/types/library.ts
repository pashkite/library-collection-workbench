export interface BookHolding {
  title: string
  author: string
  publisher: string
  publicationYear: string
  isbn: string
  kdc: string
  callNumber: string
  shelfName: string
  registeredAt: string
  registrationNumber?: string
}

export interface StoredBookHolding extends BookHolding {
  id: string
  normalizedTitle: string
  normalizedAuthor: string
  normalizedPublisher: string
  normalizedIsbn: string
  normalizedKdc: string
  dataBaseDate: string
}

export interface PurchaseCandidate {
  id: string
  title: string
  author: string
  publisher: string
  isbn: string
  price?: number
  normalizedIsbn: string
}

export interface PurchaseReviewResult extends PurchaseCandidate {
  duplicateStatus: 'ISBN 중복' | '구입 검토'
  reviewResult: '기존 소장 확인' | '담당자 검토 필요'
  matchedHolding?: BookHolding
  note: string
}

export interface KdcInfo {
  code: string
  name: string
  level: 'major' | 'middle' | 'minor'
  parentCode?: string
}

export interface DataMeta {
  baseDate: string
  lastUpdatedAt: string
  totalCount: number
  libraryCode: string
  libraryName?: string
  status: 'ready' | 'updating' | 'failed' | 'sample'
  addedCount?: number
  removedCount?: number
  isbnMissingCount?: number
  kdcMissingCount?: number
  titleMissingCount?: number
  source?: 'data4library' | 'sample'
  message?: string
}

export interface AladinBookDetail {
  isbn: string
  title: string
  author: string
  publisher: string
  pubDate?: string
  priceStandard?: number
  coverUrl?: string
  description?: string
  tableOfContents?: string
  salesPoint?: number
  stockStatus?: string
  cachedAt?: string
}

export interface SelectionBasis {
  isbn: string
  title: string
  recommendedBook?: boolean
  sejongBook?: boolean
  awardName?: string
  outOfPrint?: boolean
  authorReviewStatus?: '확인 전' | '확인 필요' | '확인 완료'
  staffMemo?: string
}

export interface ExportPreset {
  id: string
  name: string
  format: 'markdown' | 'csv' | 'json'
  includeFields: string[]
  redactPrivateFields: true
  promptPurpose?: 'recommendation' | 'curation' | 'purchase-review'
}

export interface AppDataState {
  meta?: DataMeta
  totalCount: number
  warning?: string
}

export interface BootstrapProgress {
  stage: string
  percent: number
  processed: number
  total: number
  message: string
}

export interface HoldingSearchFilters {
  title: string
  author: string
  publisher: string
  isbn: string
}

export interface HoldingSearchResult {
  rows: StoredBookHolding[]
  total: number
  page: number
  pageSize: number
}
