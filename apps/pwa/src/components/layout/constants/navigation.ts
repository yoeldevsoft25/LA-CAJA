import {
    ShoppingCart,
    Package,
    Boxes,
    Users,
    DollarSign,
    FileText,
    BarChart3,
    Settings,
    Clock,
    Percent,
    Zap,
    Calendar,
    Receipt,
    Square,
    Cpu,
    DollarSign as DollarSignIcon,
    Tag,
    Warehouse,
    Truck,
    Building2,
    ReceiptText,
    ShoppingBag,
    Brain,
    TrendingUp,
    Activity,
    CreditCard,
    UtensilsCrossed,
    MessageCircle,
    AlertTriangle,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

export type NavItem = {
    readonly path: string
    readonly label: string
    readonly icon: ComponentType<SVGProps<SVGSVGElement>>
    readonly badge: string | null
}

export type NavSection = {
    readonly id: string
    readonly label: string
    readonly icon: ComponentType<SVGProps<SVGSVGElement>>
    readonly items: readonly NavItem[]
}

// ✅ FROZEN — nunca se recrea en cada render
export const NAV_SECTIONS: readonly NavSection[] = Object.freeze([
    {
        id: 'sales',
        label: 'Ventas',
        icon: ShoppingCart,
        items: Object.freeze([
            { path: '/app/pos', label: 'Punto de Venta', icon: ShoppingCart, badge: null },
            { path: '/app/fast-checkout', label: 'Caja Rápida', icon: Zap, badge: null },
            { path: '/app/sales', label: 'Ventas', icon: FileText, badge: null },
            { path: '/app/tables', label: 'Mesas y Órdenes', icon: Square, badge: null },
            { path: '/app/kitchen', label: 'Cocina (KDS)', icon: UtensilsCrossed, badge: null },
            { path: '/app/reservations', label: 'Reservas', icon: Calendar, badge: null },
        ]),
    },
    {
        id: 'products',
        label: 'Productos e Inventario',
        icon: Package,
        items: Object.freeze([
            { path: '/app/products', label: 'Productos', icon: Package, badge: null },
            { path: '/app/inventory', label: 'Inventario', icon: Boxes, badge: null },
            { path: '/app/warehouses', label: 'Bodegas', icon: Warehouse, badge: null },
            { path: '/app/transfers', label: 'Transferencias', icon: Truck, badge: null },
            { path: '/app/suppliers', label: 'Proveedores', icon: Building2, badge: null },
            { path: '/app/purchase-orders', label: 'Órdenes de Compra', icon: ShoppingBag, badge: null },
            { path: '/app/lots', label: 'Lotes', icon: Calendar, badge: null },
        ]),
    },
    {
        id: 'configuration',
        label: 'Configuración',
        icon: Settings,
        items: Object.freeze([
            { path: '/app/cash', label: 'Caja', icon: DollarSign, badge: null },
            { path: '/app/shifts', label: 'Turnos', icon: Clock, badge: null },
            { path: '/app/payments', label: 'Pagos', icon: Settings, badge: null },
            { path: '/app/license', label: 'Mi Licencia', icon: CreditCard, badge: null },
            { path: '/app/discounts', label: 'Descuentos', icon: Percent, badge: null },
            { path: '/app/promotions', label: 'Promociones', icon: Tag, badge: null },
            { path: '/app/price-lists', label: 'Listas de Precio', icon: DollarSignIcon, badge: null },
            { path: '/app/invoice-series', label: 'Series de Factura', icon: Receipt, badge: null },
            { path: '/app/fiscal-config', label: 'Configuración Fiscal', icon: FileText, badge: null },
            { path: '/app/fiscal-invoices', label: 'Facturas Fiscales', icon: ReceiptText, badge: null },
            { path: '/app/whatsapp-config', label: 'WhatsApp', icon: MessageCircle, badge: null },
            { path: '/app/peripherals', label: 'Periféricos', icon: Cpu, badge: null },
            { path: '/app/accounting', label: 'Contabilidad', icon: FileText, badge: null },
        ]),
    },
    {
        id: 'customers',
        label: 'Clientes',
        icon: Users,
        items: Object.freeze([
            { path: '/app/customers', label: 'Clientes', icon: Users, badge: null },
            { path: '/app/debts', label: 'Fiao', icon: Users, badge: 'Beta' },
        ]),
    },
    {
        id: 'reports',
        label: 'Reportes',
        icon: BarChart3,
        items: Object.freeze([
            { path: '/app/dashboard', label: 'Dashboard', icon: BarChart3, badge: null },
            { path: '/app/reports', label: 'Reportes', icon: BarChart3, badge: null },
        ]),
    },
    {
        id: 'ml',
        label: 'Machine Learning',
        icon: Brain,
        items: Object.freeze([
            { path: '/app/ml', label: 'ML Dashboard', icon: Brain, badge: null },
            { path: '/app/ml/predictions', label: 'Predicciones', icon: TrendingUp, badge: null },
            { path: '/app/ml/evaluation', label: 'Evaluacion', icon: Brain, badge: 'Nuevo' },
            { path: '/app/ml/anomalies', label: 'Anomalías', icon: AlertTriangle, badge: null },
            { path: '/app/realtime-analytics', label: 'Analytics Tiempo Real', icon: Activity, badge: null },
        ]),
    },
])

// Mapa precalculado para prefetch — evita crear objeto en cada render
export const PATH_TO_PAGE_MAP: Readonly<Record<string, string>> = Object.freeze({
    '/app/pos': 'pos',
    '/app/products': 'products',
    '/app/inventory': 'inventory',
    '/app/sales': 'sales',
    '/app/cash': 'cash',
    '/app/customers': 'customers',
    '/app/debts': 'debts',
    '/app/reports': 'reports',
})

// Todas las rutas precalculadas para isActive
export const ALL_NAV_PATHS: readonly string[] = Object.freeze(
    NAV_SECTIONS.flatMap(s => s.items.map(i => i.path))
)
