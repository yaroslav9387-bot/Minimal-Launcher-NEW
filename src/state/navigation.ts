import { create } from 'zustand'
import { readPref, writePref } from '../lib/prefs'

export type NavKey = 'play' | 'builds' | 'catalog' | 'servers' | 'skins' | 'shop' | 'top' | 'friends' | 'hosting'

export const NAV_OPTIONS: { key: NavKey; label: string; required?: boolean }[] = [
  { key: 'play', label: 'Играть' },
  { key: 'builds', label: 'Мои сборки' },
  { key: 'catalog', label: 'Каталог модов' },
  { key: 'servers', label: 'Серверы' },
  { key: 'skins', label: 'Скины' },
  { key: 'shop', label: 'Магазин' },
  { key: 'top', label: 'Топ' },
  { key: 'friends', label: 'Друзья', required: true },
  { key: 'hosting', label: 'Мой сервер' },
]

const DEFAULT_ORDER: NavKey[] = NAV_OPTIONS.map((item) => item.key)
type Saved = { order?: NavKey[]; hidden?: NavKey[] }

function readSaved(): { order: NavKey[]; hidden: NavKey[] } {
  try {
    const raw = JSON.parse(readPref('m-nav-config', '') || 'null') as Saved | null
    const valid = (v: unknown): v is NavKey => typeof v === 'string' && DEFAULT_ORDER.includes(v as NavKey)
    const savedOrder = Array.isArray(raw?.order) ? raw.order : []
    const order = savedOrder.length ? [...savedOrder.filter(valid), ...DEFAULT_ORDER.filter((k) => !savedOrder.includes(k))] : DEFAULT_ORDER
    const hidden = Array.isArray(raw?.hidden) ? raw.hidden.filter((k): k is NavKey => valid(k) && k !== 'friends') : []
    return { order, hidden }
  } catch {
    return { order: DEFAULT_ORDER, hidden: [] }
  }
}

function persist(order: NavKey[], hidden: NavKey[]) {
  writePref('m-nav-config', JSON.stringify({ order, hidden }))
}

const initial = readSaved()
export const useNavigation = create<{
  order: NavKey[]
  hidden: NavKey[]
  setVisible: (key: NavKey, visible: boolean) => void
  move: (key: NavKey, direction: -1 | 1) => void
  reset: () => void
}>((set, get) => ({
  ...initial,
  setVisible: (key, visible) => {
    if (key === 'friends') return
    const hidden = visible ? get().hidden.filter((v) => v !== key) : [...new Set([...get().hidden, key])]
    set({ hidden })
    persist(get().order, hidden)
  },
  move: (key, direction) => {
    const order = [...get().order]
    const from = order.indexOf(key)
    const to = from + direction
    if (from < 0 || to < 0 || to >= order.length) return
    ;[order[from], order[to]] = [order[to], order[from]]
    set({ order })
    persist(order, get().hidden)
  },
  reset: () => {
    set({ order: DEFAULT_ORDER, hidden: [] })
    persist(DEFAULT_ORDER, [])
  },
}))
