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
  const { isAuthenticated, user } = useAuth()

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
