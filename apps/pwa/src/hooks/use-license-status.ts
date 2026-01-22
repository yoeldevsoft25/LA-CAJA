import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/auth.store'
import { api } from '@/lib/api'
import toast from '@/lib/toast'
import { useNavigate } from 'react-router-dom'

interface LicenseStatus {
  license_status: string
  license_expires_at: string | null
  license_plan: string | null
  license_grace_days: number
}

/**
 * Hook para validar el estado de la licencia periódicamente
 * Valida cada 5-10 minutos y redirige si la licencia está bloqueada
 */
export function useLicenseStatus() {
  const { user, isAuthenticated, logout } = useAuth()
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
      // Usar endpoint de stores para obtener estado de licencia
      const response = await api.get(`/auth/stores`)
      const stores = response.data as Array<{
        id: string
        name: string
        license_status?: string
        license_expires_at?: string | null
      }>
      const store = stores.find((s) => s.id === user.store_id)
      if (!store) {
        throw new Error('Tienda no encontrada')
      }
      return {
        license_status: store.license_status || 'active',
        license_expires_at: store.license_expires_at || null,
        license_plan: null,
        license_grace_days: 3,
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
    if (licenseStatus.license_status === 'suspended' || licenseStatus.license_status === 'expired') {
      toast.error('Tu licencia ha sido suspendida o expirada. Serás redirigido.', {
        duration: 5000,
      })
      logout()
      setTimeout(() => {
        navigate('/license')
      }, 2000)
      return
    }

    // Verificar si está por expirar
    if (licenseStatus.license_expires_at) {
      const expiresAt = new Date(licenseStatus.license_expires_at).getTime()
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
  }, [licenseStatus, logout, navigate])

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
      if (newLicenseStatus.license_status === 'suspended' || newLicenseStatus.license_status === 'expired') {
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
