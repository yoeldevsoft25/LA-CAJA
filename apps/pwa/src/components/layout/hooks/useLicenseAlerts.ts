import { useMemo, useEffect } from 'react'
import { useAuth } from '@/stores/auth.store'
import { useNotifications } from '@/stores/notifications.store'

export interface LicenseState {
    isExpired: boolean
    isExpiringSoon: boolean
    daysToExpire: number | null
    licenseStatus: string
}

export function useLicenseAlerts(): LicenseState {
    const { user } = useAuth()
    const { addUnique } = useNotifications()
    const storeId = user?.store_id

    const state = useMemo<LicenseState>(() => {
        const status = user?.license_status || 'active'
        const expiresAt = user?.license_expires_at
            ? new Date(user.license_expires_at)
            : null
        const days = expiresAt
            ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)
            : null
        const expired =
            status === 'suspended' ||
            (expiresAt ? expiresAt.getTime() < Date.now() : false)
        const expiringSoon = !expired && days !== null && days <= 7

        return {
            isExpired: expired,
            isExpiringSoon: expiringSoon,
            daysToExpire: days,
            licenseStatus: status,
        }
    }, [user?.license_status, user?.license_expires_at])

    // Notificaciones de licencia
    useEffect(() => {
        if (!storeId) return
        if (state.isExpired) {
            addUnique(`license-expired-${storeId}`, {
                title: 'Licencia vencida o suspendida',
                description: 'Contacta al administrador para renovar tu acceso.',
                type: 'error',
            })
        } else if (state.isExpiringSoon && state.daysToExpire !== null) {
            addUnique(`license-expiring-${storeId}`, {
                title: 'Licencia por vencer',
                description: `Tu licencia vence en ${state.daysToExpire} día(s).`,
                type: 'warning',
            })
        }
    }, [storeId, state.isExpired, state.isExpiringSoon, state.daysToExpire, addUnique])

    return state
}
