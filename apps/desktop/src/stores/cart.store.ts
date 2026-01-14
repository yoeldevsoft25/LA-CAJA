import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

export interface CartItem {
  id: string
  product_id: string
  product_name: string
  qty: number
  unit_price_bs: number
  unit_price_usd: number
  discount_bs?: number
  discount_usd?: number
  variant_id?: string | null
  variant_name?: string | null
  // Campos para productos por peso
  is_weight_product?: boolean
  weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null
  weight_value?: number | null // Valor del peso (ej: 2.5 kg)
  price_per_weight_bs?: number | null
  price_per_weight_usd?: number | null
}

interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id'>) => void
  updateItem: (id: string, updates: Partial<CartItem>) => void
  removeItem: (id: string) => void
  clear: () => void
  getTotal: () => { bs: number; usd: number }
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const newItem: CartItem = {
          id: uuidv4(),
          ...item,
        }
        set((state) => ({ items: [...state.items, newItem] }))
      },
      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }))
      },
      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }))
      },
      clear: () => {
        set({ items: [] })
      },
      getTotal: () => {
        const items = get().items
        const total_bs = items.reduce(
          (sum, item) =>
            sum +
            item.qty * item.unit_price_bs -
            (item.discount_bs || 0),
          0
        )
        const total_usd = items.reduce(
          (sum, item) =>
            sum +
            item.qty * item.unit_price_usd -
            (item.discount_usd || 0),
          0
        )
        return { bs: total_bs, usd: total_usd }
      },
    }),
    {
      name: 'cart-storage',
    }
  )
)

