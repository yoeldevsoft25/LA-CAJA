import { useEffect, useCallback } from 'react'
import { useAuth } from '@/stores/auth.store'
import toast from '@/lib/toast'

/**
 * Hook para rastrear actividad del usuario y renovar tokens automáticamente
 * Implementa timeout de inactividad con notificación antes de expirar
 */
export function useActivityTracker() {
  const { user, isAuthenticated } = useAuth()
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutos
  const WARNING_BEFORE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutos antes

  const handleActivity = useCallback(() => {
    // Cualquier actividad del usuario resetea el timer
    // Esto se llama en eventos de usuario
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return
    }

    let inactivityTimer: NodeJS.Timeout | null = null
    let warningTimer: NodeJS.Timeout | null = null
    let lastActivity = Date.now()

    const resetTimers = () => {
      lastActivity = Date.now()

      // Limpiar timers anteriores
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
      }
      if (warningTimer) {
        clearTimeout(warningTimer)
      }

      // Timer de advertencia (5 minutos antes del timeout)
      warningTimer = setTimeout(() => {
        const timeRemaining = Math.ceil(
          (INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_TIMEOUT_MS) / 1000 / 60,
        )
        toast(
          `Tu sesión expirará por inactividad en ${timeRemaining} minutos. Mueve el mouse o toca la pantalla para mantenerte conectado.`,
          {
            duration: 10000,
          },
        )
      }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_TIMEOUT_MS)

      // Timer de timeout (30 minutos)
      inactivityTimer = setTimeout(() => {
        toast.error('Tu sesión ha expirado por inactividad. Serás redirigido al login.', {
          duration: 5000,
        })


        // Cerrar sesión y redirigir
        const auth = useAuth.getState()
        auth.logout()
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
      }, INACTIVITY_TIMEOUT_MS)
    }

    // Eventos que indican actividad del usuario
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ]

    const onActivity = () => {
      const now = Date.now()
      // Solo resetear si han pasado al menos 1 minuto desde la última actividad
      // para evitar resetear constantemente
      if (now - lastActivity > 60000) {
        resetTimers()
      }
    }

    // Agregar listeners de actividad
    activityEvents.forEach((event) => {
      window.addEventListener(event, onActivity, { passive: true })
    })

    // Inicializar timers
    resetTimers()

    // Cleanup
    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, onActivity)
      })
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
      }
      if (warningTimer) {
        clearTimeout(warningTimer)
      }
    }
  }, [isAuthenticated, user])

  return { handleActivity }
}
