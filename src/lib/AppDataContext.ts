import { createContext, useContext } from 'react'
import type { AppDataState, DataMeta } from '../types/library'

export interface AppDataContextValue {
  data: AppDataState
  refreshData: () => Promise<void>
  updateMeta: (meta?: DataMeta, totalCount?: number, warning?: string) => void
}

export const AppDataContext = createContext<AppDataContextValue | undefined>(undefined)

export function useAppData(): AppDataContextValue {
  const value = useContext(AppDataContext)
  if (!value) {
    throw new Error('AppDataContext가 설정되지 않았습니다.')
  }
  return value
}
