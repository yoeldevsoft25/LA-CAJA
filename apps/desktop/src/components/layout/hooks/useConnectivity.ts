import { useEffect, useRef } from 'react'
import { useOnline } from '@/hooks/use-online'
import toast from '@/lib/toast'

/**
 * Maneja toasts de conectividad SIN causar re-renders en MainLayout.
 * Solo dispara toast cuando el estado CAMBIA.
 */
export function useConnectivity() {
    const { isOnline } = useOnline()
    const prevRef = useRef<boolean | null>(null)

    useEffect(() => {
        if (prevRef.current === null) {
            prevRef.current = isOnline
            if (!isOnline) {
                toast.warning('Sin conexión. Tus ventas se guardarán localmente.')
            }
            return
        }

        if (prevRef.current !== isOnline) {
            if (isOnline) {
                toast.success('Conexión restaurada.')
            } else {
                toast.warning('Sin conexión. Tus ventas se guardarán localmente.')
            }
            prevRef.current = isOnline
        }
    }, [isOnline])

    return isOnline
}
