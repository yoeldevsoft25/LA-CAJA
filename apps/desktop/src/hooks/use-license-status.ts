import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/auth.store'
import toast from '@/lib/toast'
import { useNavigate } from 'react-router-dom'

interface LicenseStatus {
  plan: string
  status: string
  expires_at: string | null
  features: string[]
  limits: Record<string, number>
  usage: Record<string, number>
  token: string
}

import { licenseService } from '@/services/license.service'

/**
 * Hook para validar el estado de la licencia periódicamente
 * Valida cada 5-10 minutos y redirige si la licencia está bloqueada
 */
export function useLicenseStatus() {
  const { user, isAuthenticated, logout, setUser } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [lastCheck, setLastCheck] = useState<number>(Date.now())

  // Validar licencia periódicamente
  const { data: licenseStatus } = useQuery({
    queryKey: ['license-status', user?.store_id],
    queryFn: async (): Promise<LicenseStatus> => {
      if (!user?.store_id) {
        throw new Error('No hay store_id')
      }

      try {
        return await licenseService.getStatus()
      } catch (error) {
        // Si hay error (ej. offline), intentar obtener estado offline
        const offlineStatus = licenseService.getOfflineStatus()
        if (offlineStatus) {
          console.warn('[LicenseStatus] Usando estado de licencia offline (JWT local)')
          return offlineStatus as LicenseStatus
        }

        // Si no hay nada, usar el estado local persistido si existe
        const localStatus = licenseService.getLocalStatus()
        if (localStatus) return localStatus

        throw error
      }
    },
    enabled: !!user?.store_id,
    refetchInterval: 5 * 60 * 1000, // Validar cada 5 minutos
    staleTime: 2 * 60 * 1000, // Considerar datos frescos por 2 minutos
  })

  // Invalidar cache cuando cambia el usuario
  useEffect(() => {
    if (user?.store_id) {
      queryClient.invalidateQueries({ queryKey: ['license-status'] })
    }
  }, [user?.store_id, queryClient])

  // Manejar efectos secundarios cuando cambia el estado de la licencia
  useEffect(() => {
    if (!licenseStatus) return

    setLastCheck(Date.now())

    // Verificar si la licencia está bloqueada
    if (licenseStatus.status === 'suspended' || licenseStatus.status === 'expired') {
      toast.error('Tu licencia ha sido suspendida o expirada. Serás redirigido.', {
        duration: 5000,
      })
      logout()
      setTimeout(() => {
        navigate('/license')
      }, 2000)
      return
    }

    // Verificar si la licencia está por expirar
    if (licenseStatus.expires_at) {
      const expiresAt = new Date(licenseStatus.expires_at).getTime()
      const now = Date.now()
      const daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))

      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        toast(
          `Tu licencia expira en ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'día' : 'días'}. Renueva pronto.`,
          {
            duration: 8000,
            icon: '⚠️',
          },
        )
      }
    }

    // Sincronizar estado con el store de autenticación si hay cambios
    const featuresChanged = (() => {
      const current = user?.license_features || []
      const next = licenseStatus.features || []
      if (current.length !== next.length) return true
      const currentSorted = [...current].sort()
      const nextSorted = [...next].sort()
      return currentSorted.some((feature, index) => feature !== nextSorted[index])
    })()

    if (user && (
      user.license_status !== licenseStatus.status ||
      user.license_expires_at !== licenseStatus.expires_at ||
      user.license_plan !== licenseStatus.plan ||
      featuresChanged
    )) {
      console.log('[LicenseStatus] Sincronizando estado de licencia en store:', licenseStatus)
      setUser({
        ...user,
        license_status: licenseStatus.status,
        license_expires_at: licenseStatus.expires_at,
        license_plan: licenseStatus.plan,
        license_features: licenseStatus.features,
      })
    }
  }, [licenseStatus, logout, navigate, user, setUser])

  // Escuchar cambios de licencia vía WebSocket
  useEffect(() => {
    if (!isAuthenticated || !user) {
      return
    }

    const handleLicenseChange = (event: CustomEvent) => {
      const newLicenseStatus = event.detail as LicenseStatus
      console.log('[LicenseStatus] Cambio de licencia recibido vía WebSocket:', newLicenseStatus)

      // Invalidar cache para forzar re-fetch
      queryClient.invalidateQueries({ queryKey: ['license-status'] })

      // Verificar si la licencia está bloqueada
      if (newLicenseStatus.status === 'suspended' || newLicenseStatus.status === 'expired') {
        toast.error('Tu licencia ha sido suspendida o expirada. Serás redirigido.', {
          duration: 5000,
        })
        logout()
        setTimeout(() => {
          navigate('/license')
        }, 2000)
      }
    }

    window.addEventListener('license:status_change', handleLicenseChange as EventListener)

    return () => {
      window.removeEventListener('license:status_change', handleLicenseChange as EventListener)
    }
  }, [isAuthenticated, user, queryClient, logout, navigate])

  return {
    licenseStatus,
    lastCheck,
    isChecking: false,
  }
}
