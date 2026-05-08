import type { BookHolding, BootstrapProgress, DataMeta, StoredBookHolding } from '../types/library'
import { toStoredHolding } from '../utils/normalize'
import { getSampleHolding, getStoredMeta, replaceHoldings } from './libraryDb'

const DATA_PATH = `${import.meta.env.BASE_URL}data`

async function fetchJson<T>(path: string, label: string): Promise<T> {
  const response = await fetch(path, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(`${label} 다운로드에 실패했습니다. HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

function isNewerRemote(remote: DataMeta, local?: DataMeta): boolean {
  if (!local) return true
  return (
    remote.baseDate !== local.baseDate ||
    remote.lastUpdatedAt !== local.lastUpdatedAt ||
    remote.totalCount !== local.totalCount
  )
}

function ensurePublicFields(row: BookHolding): BookHolding {
  return {
    title: row.title ?? '',
    author: row.author ?? '',
    publisher: row.publisher ?? '',
    publicationYear: row.publicationYear ?? '',
    isbn: row.isbn ?? '',
    kdc: row.kdc ?? '',
    callNumber: row.callNumber ?? '',
    shelfName: row.shelfName ?? '',
    registeredAt: row.registeredAt ?? '',
    registrationNumber: row.registrationNumber ?? '',
    dedupeKey: row.dedupeKey ?? '',
    libCode: row.libCode ?? '',
    libraryName: row.libraryName ?? '',
  }
}

export async function bootstrapHoldings(
  onProgress: (progress: BootstrapProgress) => void,
): Promise<{
  meta?: DataMeta
  updated: boolean
  sampleBook?: StoredBookHolding
  warning?: string
}> {
  onProgress({
    stage: '최신 데이터 확인 중...',
    percent: 5,
    processed: 0,
    total: 0,
    message: '소장목록을 준비하고 있습니다.',
  })

  const localMeta = await getStoredMeta()
  const remoteMeta = await fetchJson<DataMeta>(`${DATA_PATH}/holdings.meta.json`, '메타 정보')

  if (!isNewerRemote(remoteMeta, localMeta)) {
    return {
      meta: localMeta,
      updated: false,
      sampleBook: await getSampleHolding(),
    }
  }

  onProgress({
    stage: '소장목록 다운로드 중...',
    percent: 20,
    processed: 0,
    total: remoteMeta.totalCount,
    message:
      '처음 접속 시 최신 소장목록을 내려받아 브라우저에 저장합니다. 이 작업은 처음 한 번만 시간이 조금 걸릴 수 있으며, 다음부터는 더 빠르게 사용할 수 있습니다.',
  })

  const downloadedRows = await fetchJson<BookHolding[]>(
    `${DATA_PATH}/holdings.latest.json`,
    '소장목록',
  )

  onProgress({
    stage: '브라우저 저장용 데이터 정리 중...',
    percent: 35,
    processed: 0,
    total: downloadedRows.length,
    message: '대용량 소장목록을 검색 가능한 형태로 정리하고 있습니다.',
  })

  const storedRows = downloadedRows.map((row, index) =>
    toStoredHolding(ensurePublicFields(row), index, remoteMeta.baseDate),
  )

  if (storedRows.length === 0) {
    throw new Error('소장목록 JSON에 저장할 도서 데이터가 없습니다.')
  }

  onProgress({
    stage: '브라우저 저장소에 저장 중...',
    percent: 45,
    processed: 0,
    total: storedRows.length,
    message: '검색과 중복 검토에 사용할 데이터를 IndexedDB에 저장하고 있습니다.',
  })

  await replaceHoldings(storedRows, { ...remoteMeta, totalCount: storedRows.length }, (done, total) => {
    onProgress({
      stage: '브라우저 저장소에 저장 중...',
      percent: Math.min(85, Math.round(45 + (done / total) * 40)),
      processed: done,
      total,
      message: '검색과 중복 검토에 사용할 데이터를 IndexedDB에 저장하고 있습니다.',
    })
  })

  onProgress({
    stage: '검색용 색인 생성 중...',
    percent: 92,
    processed: storedRows.length,
    total: storedRows.length,
    message: '도서명, 저자, ISBN, KDC 검색용 정규화 필드를 확인하고 있습니다.',
  })

  return {
    meta: { ...remoteMeta, totalCount: storedRows.length },
    updated: true,
    sampleBook: storedRows[0],
  }
}
