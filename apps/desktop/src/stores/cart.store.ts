import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
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
  category?: string
}

export const CART_IDS = ['cart-1', 'cart-2', 'cart-3', 'cart-4'] as const
export type CartId = (typeof CART_IDS)[number]

export interface CartSummary {
  id: string
  count: number
  totalUsd: number
}

interface CartState {
  carts: Record<string, { items: CartItem[] }>
  activeCartId: string
  addItem: (item: Omit<CartItem, 'id'>) => void
  updateItem: (id: string, updates: Partial<CartItem>) => void
  removeItem: (id: string) => void
  clear: () => void
  getTotal: () => { bs: number; usd: number }
  setActiveCart: (id: string) => void
  getCartSummaries: () => CartSummary[]
}

const emptyCarts = (): Record<string, { items: CartItem[] }> =>
  Object.fromEntries(CART_IDS.map((id) => [id, { items: [] }]))

const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      carts: emptyCarts(),
      activeCartId: 'cart-1',

      addItem: (item) => {
        const newItem: CartItem = { id: uuidv4(), ...item }
        const { carts, activeCartId } = get()
        const active = carts[activeCartId] ?? { items: [] }
        set({
          carts: {
            ...carts,
            [activeCartId]: { items: [...active.items, newItem] },
          },
        })
      },

      updateItem: (id, updates) => {
        const { carts, activeCartId } = get()
        const active = carts[activeCartId] ?? { items: [] }
        set({
          carts: {
            ...carts,
            [activeCartId]: {
              items: active.items.map((i) =>
                i.id === id ? { ...i, ...updates } : i
              ),
            },
          },
        })
      },

      removeItem: (id) => {
        const { carts, activeCartId } = get()
        const active = carts[activeCartId] ?? { items: [] }
        set({
          carts: {
            ...carts,
            [activeCartId]: {
              items: active.items.filter((i) => i.id !== id),
            },
          },
        })
      },

      clear: () => {
        const { carts, activeCartId } = get()
        set({
          carts: {
            ...carts,
            [activeCartId]: { items: [] },
          },
        })
      },

      getTotal: () => {
        const items = get().carts[get().activeCartId]?.items ?? []
        const total_bs = items.reduce(
          (sum, item) =>
            sum + item.qty * item.unit_price_bs - (item.discount_bs || 0),
          0
        )
        const total_usd = items.reduce(
          (sum, item) =>
            sum + item.qty * item.unit_price_usd - (item.discount_usd || 0),
          0
        )
        return { bs: total_bs, usd: total_usd }
      },

      setActiveCart: (id) => {
        if (!CART_IDS.includes(id as CartId)) return
        set({ activeCartId: id })
      },

      getCartSummaries: () => {
        const { carts } = get()
        return CART_IDS.map((id) => {
          const items = carts[id]?.items ?? []
          const totalUsd = items.reduce(
            (sum, item) =>
              sum + item.qty * item.unit_price_usd - (item.discount_usd || 0),
            0
          )
          return {
            id,
            count: items.reduce((s, i) => s + i.qty, 0),
            totalUsd,
          }
        })
      },
    }),
    {
      name: 'cart-storage',
      partialize: (s) => ({ carts: s.carts, activeCartId: s.activeCartId }),
      merge: (persisted: unknown, current: CartState) => {
        const p = persisted as Record<string, unknown> | undefined
        if (!p) return current

        // Migrar formato antiguo: { items: CartItem[] } -> { carts, activeCartId }
        if ('items' in (p as object) && !('carts' in (p as object))) {
          const legacyItems = (p.items as CartItem[]) ?? []
          const carts = emptyCarts()
          carts['cart-1'] = { items: legacyItems }
          return {
            ...current,
            carts,
            activeCartId: 'cart-1',
          }
        }

        // Asegurar que todos los carritos existan
        const carts = (p.carts as Record<string, { items: CartItem[] }>) ?? {}
        const merged: Record<string, { items: CartItem[] }> = {}
        for (const id of CART_IDS) {
          merged[id] = carts[id] ?? { items: [] }
        }
        const activeCartId = (typeof p.activeCartId === 'string' && CART_IDS.includes(p.activeCartId as CartId))
          ? (p.activeCartId as CartId)
          : 'cart-1'

        return {
          ...current,
          carts: merged,
          activeCartId,
        }
      },
    }
  )
)

/** Hook que expone el carrito activo y las acciones. items es el carrito activo. */
export const useCart = () =>
  useCartStore(
    useShallow((s) => ({
      items: s.carts[s.activeCartId]?.items ?? [],
      activeCartId: s.activeCartId,
      carts: s.carts,
      addItem: s.addItem,
      updateItem: s.updateItem,
      removeItem: s.removeItem,
      clear: s.clear,
      getTotal: s.getTotal,
      setActiveCart: s.setActiveCart,
    }))
  )
