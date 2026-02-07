import { create } from 'zustand'
import { randomUUID } from '@/lib/uuid'
import { persist } from 'zustand/middleware'

export type NotificationType = 'info' | 'warning' | 'error' | 'success'

export interface NotificationItem {
  id: string
  title: string
  description?: string
  type: NotificationType
  created_at: number
  read: boolean
}

interface NotificationState {
  items: NotificationItem[]
  add: (item: Omit<NotificationItem, 'id' | 'created_at' | 'read'>) => void
  addUnique: (key: string, item: Omit<NotificationItem, 'id' | 'created_at' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clear: () => void
}

export const useNotifications = create<NotificationState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => {
        const newItem: NotificationItem = {
          id: randomUUID(),
          created_at: Date.now(),
          read: false,
          ...item,
        }
        set((state) => ({ items: [newItem, ...state.items].slice(0, 50) }))
      },
      addUnique: (key, item) => {
        set((state) => {
          if (state.items.some((n) => n.id === key)) return state
          const newItem: NotificationItem = {
            id: key,
            created_at: Date.now(),
            read: false,
            ...item,
          }
          return { items: [newItem, ...state.items].slice(0, 50) }
        })
      },
      markAsRead: (id) =>
        set((state) => ({
          items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      markAllAsRead: () =>
        set((state) => ({
          items: state.items.map((n) => ({ ...n, read: true })),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'notifications-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
)
