import { Navigate } from 'react-router-dom'
import { useAuth } from '@/stores/auth.store'
import { getDefaultRoute, type Role } from '@/lib/permissions'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowLicenseBlocked?: boolean
  allowedRoles?: Role[]
}

/**
 * ProtectedRoute - Protege rutas verificando autenticación y roles.
 * 
 * NOTA: La validación de licencia se maneja en el backend mediante LicenseGuard.
 * El interceptor de API (api.ts) redirige automáticamente a /license cuando
 * el backend devuelve un 403 con código LICENSE_BLOCKED.
 * 
 * No validamos licencia aquí porque:
 * 1. El backend tiene la información más actualizada (incluyendo días de gracia)
 * 2. Evita inconsistencias entre frontend y backend
 * 3. El backend valida en cada petición con LicenseGuard global
 */
export default function ProtectedRoute({
  children,
  allowLicenseBlocked: _allowLicenseBlocked = false, // Prefijo _ para indicar que no se usa (mantenido para compatibilidad)
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, _hasHydrated } = useAuth()

  // Esperar a que zustand-persist rehidrate para no redirigir a /login por un instante
  if (!_hasHydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const userRole = user?.role || 'cashier'
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to={getDefaultRoute(userRole)} replace />
    }
  }

  // La validación de licencia se maneja en el backend
  // El interceptor de API redirige a /license cuando es necesario

  return <>{children}</>
}
