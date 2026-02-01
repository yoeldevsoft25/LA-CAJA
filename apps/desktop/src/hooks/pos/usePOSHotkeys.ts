import { useEffect } from 'react'
import { fastCheckoutService } from '@/services/fast-checkout.service'
import { toast } from 'sonner'
import { useCart } from '@/stores/cart.store'

interface UsePOSHotkeysProps {
    searchInputRef: React.RefObject<HTMLInputElement>
    onCheckout: () => void
    onClear: () => void
    hasOpenCash: boolean
    fastCheckoutEnabled: boolean
    onQuickProduct: (quickProduct: any) => void
}

export function usePOSHotkeys({
    searchInputRef,
    onCheckout,
    onClear,
    hasOpenCash,
    fastCheckoutEnabled,
    onQuickProduct
}: UsePOSHotkeysProps) {
    const { items } = useCart()

    useEffect(() => {
        const handleGlobalKeys = async (e: KeyboardEvent) => {
            // Ignorar inputs
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target instanceof HTMLSelectElement
            ) {
                return
            }

            // 1. Focus Search (/)
            if (e.key === '/') {
                e.preventDefault()
                searchInputRef.current?.focus()
                return
            }

            // 2. Checkout (F2)
            if (e.key === 'F2') {
                e.preventDefault()
                if (items.length > 0 && hasOpenCash) {
                    onCheckout()
                } else if (items.length === 0) {
                    toast('Carrito vacío', { icon: '🛒' })
                } else if (!hasOpenCash) {
                    toast.error('Caja cerrada')
                }
                return
            }

            // 3. Clear (Alt + L) - Ejemplo nuevo, útil
            if (e.altKey && (e.key === 'l' || e.key === 'L')) {
                e.preventDefault()
                onClear()
                return
            }

            // 4. Fast Checkout Keys (A-Z, 0-9)
            if (fastCheckoutEnabled && e.key.length === 1) {
                const key = e.key.toUpperCase()
                try {
                    const qp = await fastCheckoutService.getQuickProductByKey(key)
                    if (qp && qp.is_active) {
                        onQuickProduct(qp)
                    }
                } catch { }
            }
        }

        window.addEventListener('keydown', handleGlobalKeys)
        return () => window.removeEventListener('keydown', handleGlobalKeys)
    }, [searchInputRef, onCheckout, onClear, items.length, hasOpenCash, fastCheckoutEnabled, onQuickProduct])
}
