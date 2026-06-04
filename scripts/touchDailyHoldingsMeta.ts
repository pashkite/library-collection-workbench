import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { DataMeta } from '../src/types/library.ts'

const META_PATH = path.resolve('public/data/holdings.meta.json')
const DEFAULT_LOOKBACK_DAYS = 7

function todayInKorea(): string {
  const now = new Date()
  const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return korea.toISOString().slice(0, 10)
}

function addDays(dateText: string, days: number): string {
  const date = new Date(`${dateText}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function main() {
  const meta = JSON.parse(await readFile(META_PATH, 'utf-8')) as DataMeta
  const now = new Date().toISOString()
  const endDt = todayInKorea()
  const lookbackDays = Number(meta.dailyLookbackDays ?? process.env.DAILY_LOOKBACK_DAYS ?? DEFAULT_LOOKBACK_DAYS)
  const startDt = addDays(endDt, -(lookbackDays - 1))
  const nextMeta: DataMeta = {
    ...meta,
    baseDate: endDt,
    lastUpdatedAt: now,
    dailyCheckAt: now,
    syncMode: 'daily',
    addedCount: 0,
    removedCount: 0,
    dailyLookbackDays: lookbackDays,
    message: `최근 ${lookbackDays}일(${startDt}~${endDt}) 일일 소장자료 갱신을 확인했으며 신규 병합 자료는 없습니다.`,
  }

  await writeFile(META_PATH, `${JSON.stringify(nextMeta, null, 2)}\n`)
  console.log(nextMeta.message)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
