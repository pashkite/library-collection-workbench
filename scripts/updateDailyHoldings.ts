import { runDailyHoldingsUpdate } from './dailyHoldingsUpdater.ts'

runDailyHoldingsUpdate().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
