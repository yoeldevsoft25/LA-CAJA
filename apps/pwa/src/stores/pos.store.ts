import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface POSState {
    searchQuery: string
    isCheckoutOpen: boolean
    setSearchQuery: (query: string) => void
    setIsCheckoutOpen: (isOpen: boolean) => void
    reset: () => void
}

export const usePOSStore = create<POSState>()(
    persist(
        (set) => ({
            searchQuery: '',
            isCheckoutOpen: false,
            setSearchQuery: (query) => set({ searchQuery: query }),
            setIsCheckoutOpen: (isOpen) => set({ isCheckoutOpen: isOpen }),
            reset: () => set({ searchQuery: '', isCheckoutOpen: false }),
        }),
        {
            name: 'pos-ui-storage', // Nombre único en localStorage
            partialize: (state) => ({
                searchQuery: state.searchQuery,
                isCheckoutOpen: state.isCheckoutOpen
            }), // Persistir solo lo necesario
        }
    )
)
