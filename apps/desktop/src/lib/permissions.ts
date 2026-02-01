export type Role = 'owner' | 'cashier'

const CASHIER_ALLOWED_ROUTES = [
  '/app/pos',
  '/app/fast-checkout',
  '/app/sales',
  '/app/cash',
  '/app/shifts',
  '/app/customers',
  '/app/debts',
  '/app/tables',
  '/app/fiscal-invoices',
]

export const isRouteAllowed = (path: string, role: Role, features: string[] = []) => {
  // Rutas protegidas por características de licencia
  const FEATURE_ROUTES: Record<string, string> = {
    '/app/accounting': 'accounting',
    '/app/ml': 'ml',
    '/app/fiscal-config': 'fiscal',
    '/app/fiscal-invoices': 'fiscal',
  }

  for (const [route, feature] of Object.entries(FEATURE_ROUTES)) {
    if (path === route || path.startsWith(`${route}/`)) {
      if (!features.includes(feature)) return false
    }
  }

  if (role === 'owner') return true
  return CASHIER_ALLOWED_ROUTES.some(
    (allowed) => path === allowed || path.startsWith(`${allowed}/`)
  )
}

export const getDefaultRoute = (role: Role) =>
  role === 'owner' ? '/app/dashboard' : '/app/pos'
