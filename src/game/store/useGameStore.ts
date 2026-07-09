import { create } from 'zustand'
import {
  books as seedBooks,
  inventoryItems as seedItems,
  missions as seedMissions,
  playerResources as seedResources,
  shelves as seedShelves,
  tipMessages,
} from '../data/mockData'
import type {
  AppSettings,
  Book,
  BookCategory,
  InventoryItem,
  InventoryTab,
  Mission,
  MissionTab,
  PageId,
  PlayerResources,
  Shelf,
} from '../types'

interface GameState {
  page: PageId
  resources: PlayerResources
  books: Book[]
  missions: Mission[]
  items: InventoryItem[]
  shelves: Shelf[]
  selectedBookId: string
  selectedShelfId: string
  selectedItemId: string
  missionTab: MissionTab
  inventoryTab: InventoryTab
  collectionFilter: BookCategory
  searchQuery: string
  searchField: 'all' | 'title' | 'author' | 'publisher' | 'isbn' | 'tag'
  searchPage: number
  settings: AppSettings
  toast: string | null
  tipIndex: number
  setPage: (page: PageId) => void
  selectBook: (id: string) => void
  openBookDetail: (id: string) => void
  selectShelf: (id: string) => void
  selectItem: (id: string) => void
  setMissionTab: (tab: MissionTab) => void
  setInventoryTab: (tab: InventoryTab) => void
  setCollectionFilter: (filter: BookCategory) => void
  setSearchQuery: (q: string) => void
  setSearchField: (f: GameState['searchField']) => void
  setSearchPage: (p: number) => void
  completeMission: (id: string) => void
  useItem: (id: string) => void
  placeBookOnShelf: () => void
  toggleBookStatus: () => void
  updateSettings: (patch: Partial<AppSettings>) => void
  saveSettings: () => void
  setToast: (msg: string | null) => void
  nextTip: () => void
}

export const useGameStore = create<GameState>((set, get) => ({
  page: 'lobby',
  resources: { ...seedResources },
  books: seedBooks.map((b) => ({ ...b })),
  missions: seedMissions.map((m) => ({ ...m })),
  items: seedItems.map((i) => ({ ...i })),
  shelves: seedShelves.map((s) => ({ ...s })),
  selectedBookId: 'b1',
  selectedShelfId: 's1',
  selectedItemId: 'i5',
  missionTab: 'daily',
  inventoryTab: 'all',
  collectionFilter: '전체',
  searchQuery: '',
  searchField: 'all',
  searchPage: 1,
  settings: {
    bgm: true,
    sfx: true,
    notifications: true,
    vibration: false,
    language: 'ko',
    quality: 'high',
  },
  toast: null,
  tipIndex: 0,

  setPage: (page) => set({ page }),
  selectBook: (id) => set({ selectedBookId: id }),
  openBookDetail: (id) => set({ selectedBookId: id, page: 'detail' }),
  selectShelf: (id) => set({ selectedShelfId: id }),
  selectItem: (id) => set({ selectedItemId: id }),
  setMissionTab: (tab) => set({ missionTab: tab }),
  setInventoryTab: (tab) => set({ inventoryTab: tab }),
  setCollectionFilter: (filter) => set({ collectionFilter: filter }),
  setSearchQuery: (q) => set({ searchQuery: q, searchPage: 1 }),
  setSearchField: (f) => set({ searchField: f, searchPage: 1 }),
  setSearchPage: (p) => set({ searchPage: p }),

  completeMission: (id) => {
    const { missions, resources } = get()
    const mission = missions.find((m) => m.id === id)
    if (!mission || mission.completed) return

    const nextMissions = missions.map((m) =>
      m.id === id
        ? { ...m, current: m.target, completed: true }
        : m,
    )

    set({
      missions: nextMissions,
      resources: {
        ...resources,
        exp: Math.min(resources.expMax, resources.exp + mission.rewardExp),
        gold: resources.gold + mission.rewardGold,
      },
      toast: `미션 완료! +${mission.rewardExp} EXP · +${mission.rewardGold} 골드`,
    })
  },

  useItem: (id) => {
    const { items, resources } = get()
    const item = items.find((i) => i.id === id)
    if (!item || item.quantity <= 0) return

    const nextItems = items.map((i) =>
      i.id === id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i,
    )

    let nextResources = { ...resources }
    let msg = `${item.name} 사용`

    if (item.id === 'i5') {
      nextResources.exp = Math.min(nextResources.expMax, nextResources.exp + 500)
      msg = '경험치 포션 사용! +500 EXP'
    } else if (item.id === 'i10') {
      nextResources.energy = Math.min(nextResources.energyMax, nextResources.energy + 10)
      msg = '벽시계 효과! 에너지 +10'
    }

    set({
      items: nextItems,
      resources: nextResources,
      toast: msg,
    })
  },

  placeBookOnShelf: () => {
    const { shelves, selectedShelfId, selectedBookId, books } = get()
    const shelf = shelves.find((s) => s.id === selectedShelfId)
    if (!shelf) return
    if (shelf.occupied >= shelf.capacity) {
      set({ toast: '서가 수용량이 가득 찼습니다.' })
      return
    }

    set({
      shelves: shelves.map((s) =>
        s.id === selectedShelfId ? { ...s, occupied: s.occupied + 1 } : s,
      ),
      books: books.map((b) =>
        b.id === selectedBookId ? { ...b, status: '보유중', collected: true } : b,
      ),
      toast: `${shelf.name}에 배치 완료`,
    })
  },

  toggleBookStatus: () => {
    const { books, selectedBookId } = get()
    const book = books.find((b) => b.id === selectedBookId)
    if (!book) return
    const order: Book['status'][] = ['보유중', '대출중', '정리중', '미수집']
    const idx = order.indexOf(book.status)
    const next = order[(idx + 1) % order.length]
    set({
      books: books.map((b) => (b.id === selectedBookId ? { ...b, status: next } : b)),
      toast: `대출 상태 → ${next}`,
    })
  },

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  saveSettings: () => set({ toast: '설정이 저장되었습니다.' }),
  setToast: (msg) => set({ toast: msg }),
  nextTip: () => set((s) => ({ tipIndex: (s.tipIndex + 1) % tipMessages.length })),
}))
