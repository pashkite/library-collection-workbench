export type PageId =
  | 'lobby'
  | 'collection'
  | 'search'
  | 'detail'
  | 'shelving'
  | 'missions'
  | 'inventory'
  | 'stats'

export type BookCategory = '전체' | '문학' | '역사' | '자연과학' | '기술' | '예술' | '언어' | '철학'

export type MissionTab = 'daily' | 'weekly' | 'event'
export type InventoryTab = 'all' | 'consumable' | 'decor' | 'material' | 'other'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Book {
  id: string
  title: string
  titleEn?: string
  author: string
  publisher: string
  year: number
  isbn: string
  category: BookCategory
  rating: number
  collected: boolean
  coverColor: string
  description: string
  pages: number
  size: string
  language: string
  status: '보유중' | '대출중' | '정리중' | '미수집'
  purchaseDate: string
  purchaseFrom: string
  tags: string[]
  callNumber?: string
}

export interface Mission {
  id: string
  title: string
  tab: MissionTab
  current: number
  target: number
  rewardExp: number
  rewardGold: number
  completed: boolean
}

export interface InventoryItem {
  id: string
  name: string
  description: string
  quantity: number
  rarity: Rarity
  tab: Exclude<InventoryTab, 'all'>
  icon: string
  effect?: string
}

export interface Shelf {
  id: string
  name: string
  category: string
  capacity: number
  occupied: number
  room: string
  position: [number, number, number]
}

export interface PlayerResources {
  gold: number
  gems: number
  energy: number
  energyMax: number
  level: number
  exp: number
  expMax: number
  title: string
}

export interface AppSettings {
  bgm: boolean
  sfx: boolean
  notifications: boolean
  vibration: boolean
  language: 'ko' | 'en'
  quality: 'low' | 'medium' | 'high'
}
