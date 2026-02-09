import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/stores/auth.store'
import { useNotifications } from '@/stores/notifications.store'
import { inventoryService } from '@/services/inventory.service'
import { cashService } from '@/services/cash.service'

const FIVE_MINUTES = 1000 * 60 * 5
const TWO_MINUTES = 1000 * 60 * 2
const HOURS_THRESHOLD = 8

export function useSystemAlerts() {
    const { user } = useAuth()
    const { addUnique } = useNotifications()
    const storeId = user?.store_id

    // Stock bajo — refresca cada 5 min
    const { data: lowStock } = useQuery({
        queryKey: ['alerts', 'low-stock', storeId],
        queryFn: () => inventoryService.getLowStock(),
        enabled: !!storeId,
        staleTime: FIVE_MINUTES,
        refetchInterval: FIVE_MINUTES,
    })

    // Sesión de caja — refresca cada 2 min
    const { data: currentCash } = useQuery({
        queryKey: ['alerts', 'cash-session', storeId],
        queryFn: () => cashService.getCurrentSession(),
        enabled: !!storeId,
        staleTime: TWO_MINUTES,
        refetchInterval: TWO_MINUTES,
    })

    // Notificaciones de stock bajo
    useEffect(() => {
        if (!lowStock?.length) return
        for (const item of lowStock) {
            const remaining = Number(item.current_stock ?? 0)
            addUnique(`low-stock-${item.product_id}`, {
                title: `Stock bajo: ${item.product_name}`,
                description: `Quedan ${remaining} unidades (umbral ${item.low_stock_threshold}).`,
                type: 'warning',
            })
        }
    }, [lowStock, addUnique])

    // Recordatorio de cierre de caja (>8h abierta)
    useEffect(() => {
        if (!currentCash?.id || !currentCash.opened_at || currentCash.closed_at) return
        const openedAt = new Date(currentCash.opened_at).getTime()
        const hoursOpen = (Date.now() - openedAt) / 3_600_000
        if (hoursOpen >= HOURS_THRESHOLD) {
            addUnique(`cash-open-${currentCash.id}`, {
                title: 'Cierre de caja pendiente',
                description: `Sesión abierta hace ${hoursOpen.toFixed(1)}h. Considera cerrar o hacer arqueo.`,
                type: 'info',
            })
        }
    }, [currentCash, addUnique])
}
