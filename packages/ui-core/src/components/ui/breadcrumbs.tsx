import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface BreadcrumbItem {
    label: string
    href?: string
    icon?: React.ComponentType<{ className?: string }>
}

interface BreadcrumbsProps {
    items?: BreadcrumbItem[]
    className?: string
}

/**
 * Componente de breadcrumbs para navegación jerárquica
 * Si no se proporcionan items, genera automáticamente desde la ruta actual
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
    const location = useLocation()

    // Generar breadcrumbs automáticamente desde la ruta si no se proporcionan
    const breadcrumbs = items || generateBreadcrumbsFromPath(location.pathname)

    if (breadcrumbs.length === 0) {
        return null
    }

    return (
        <nav
            aria-label="Breadcrumb navigation"
            className={cn('flex items-center space-x-2 text-sm text-muted-foreground', className)}
        >
            <ol className="flex items-center space-x-2" role="list">
                {/* Inicio */}
                <li>
                    <Link
                        to="/app/dashboard"
                        className="flex items-center hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                        aria-label="Ir al inicio"
                    >
                        <Home className="w-4 h-4" aria-hidden="true" />
                    </Link>
                </li>

                {/* Separadores y items */}
                {breadcrumbs.map((item, index) => {
                    const isLast = index === breadcrumbs.length - 1

                    return (
                        <React.Fragment key={index}>
                            <li aria-hidden="true" className="flex items-center">
                                <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                            </li>
                            <li>
                                {isLast ? (
                                    <span
                                        className="flex items-center gap-2 font-medium text-foreground"
                                        aria-current="page"
                                    >
                                        {item.icon && <item.icon className="w-4 h-4" aria-hidden="true" />}
                                        {item.label}
                                    </span>
                                ) : (
                                    <Link
                                        to={item.href || '#'}
                                        className="flex items-center gap-2 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                                    >
                                        {item.icon && <item.icon className="w-4 h-4" aria-hidden="true" />}
                                        {item.label}
                                    </Link>
                                )}
                            </li>
                        </React.Fragment>
                    )
                })}
            </ol>
        </nav>
    )
}

/**
 * Genera breadcrumbs automáticamente desde la ruta del pathname
 */
function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
    // Remover /app si existe
    const path = pathname.startsWith('/app') ? pathname.slice(4) : pathname
    const segments = path.split('/').filter(Boolean)

    if (segments.length === 0) {
        return []
    }

    // Mapeo de rutas a labels legibles
    const routeLabels: Record<string, string> = {
        pos: 'Punto de Venta',
        'fast-checkout': 'Caja Rápida',
        sales: 'Ventas',
        tables: 'Mesas y Órdenes',
        products: 'Productos',
        inventory: 'Inventario',
        warehouses: 'Bodegas',
        transfers: 'Transferencias',
        suppliers: 'Proveedores',
        'purchase-orders': 'Órdenes de Compra',
        lots: 'Lotes',
        cash: 'Caja',
        shifts: 'Turnos',
        payments: 'Pagos',
        discounts: 'Descuentos',
        promotions: 'Promociones',
        'price-lists': 'Listas de Precio',
        'invoice-series': 'Series de Factura',
        'fiscal-config': 'Configuración Fiscal',
        'fiscal-invoices': 'Facturas Fiscales',
        peripherals: 'Periféricos',
        accounting: 'Contabilidad',
        customers: 'Clientes',
        debts: 'Fiao',
        dashboard: 'Dashboard',
        reports: 'Reportes',
        ml: 'Machine Learning',
        'ml/predictions': 'Predicciones',
        'ml/evaluation': 'Evaluación',
        'ml/anomalies': 'Anomalías',
        'realtime-analytics': 'Analytics Tiempo Real',
    }

    const breadcrumbs: BreadcrumbItem[] = []
    let currentPath = '/app'

    segments.forEach((segment, index) => {
        currentPath += `/${segment}`
        const fullPath = segments.slice(0, index + 1).join('/')
        const label = routeLabels[fullPath] || routeLabels[segment] || formatSegment(segment)

        breadcrumbs.push({
            label,
            href: currentPath,
        })
    })

    return breadcrumbs
}

/**
 * Formatea un segmento de ruta a un label legible
 */
function formatSegment(segment: string): string {
    // Convertir kebab-case a Title Case
    return segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}
