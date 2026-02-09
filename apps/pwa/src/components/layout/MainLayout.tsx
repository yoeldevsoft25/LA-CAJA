import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/stores/auth.store'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { prefetchPageData } from '@/services/prefetch.service'
import {
  LogOut,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  DollarSign,
  FileText,
  BarChart3,
  Menu,
  ChevronLeft,
  Settings,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Info,
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { motion } from 'framer-motion'
import { useNotifications } from '@/stores/notifications.store'
import { useOnline } from '@/hooks/use-online'
import { inventoryService } from '@/services/inventory.service'
import { cashService } from '@/services/cash.service'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useNotificationsSync } from '@/hooks/useNotificationsSync'
import { isRouteAllowed, type Role } from '@/lib/permissions'
import ExchangeRateIndicator from '@/components/exchange/ExchangeRateIndicator'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import { KeyboardShortcutsHelp, useKeyboardShortcutsHelp } from '@/components/ui/keyboard-shortcuts-help'
import { SkipLinks } from '@/components/ui/skip-links'
import { SyncStatusBadge } from '@/components/sync/SyncStatusBadge'
import { CommandMenu } from './CommandMenu'
import { QuotaBanner } from '@/components/license/QuotaTracker'
import { UpgradeModal } from '@/components/license/UpgradeModal'
import { licenseService } from '@/services/license.service'
import toast from '@/lib/toast'
import { ModeToggle } from '../mode-toggle'
import { SidebarContent } from './sidebar/SidebarContent'

type NavItem = {
  path: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  badge: string | null
}

type NavSection = {
  id: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  items: NavItem[]
  defaultOpen?: boolean
}

const navSections: NavSection[] = [
  {
    id: 'sales',
    label: 'Ventas',
    icon: ShoppingCart,
    items: [
      { path: '/app/pos', label: 'Punto de Venta', icon: ShoppingCart, badge: null },
      { path: '/app/fast-checkout', label: 'Caja Rápida', icon: Zap, badge: null },
      { path: '/app/sales', label: 'Ventas', icon: FileText, badge: null },
      { path: '/app/tables', label: 'Mesas y Órdenes', icon: Square, badge: null },
      { path: '/app/kitchen', label: 'Cocina (KDS)', icon: UtensilsCrossed, badge: null },
      { path: '/app/reservations', label: 'Reservas', icon: Calendar, badge: null },
    ],
  },
  {
    id: 'products',
    label: 'Productos e Inventario',
    icon: Package,
    items: [
      { path: '/app/products', label: 'Productos', icon: Package, badge: null },
      { path: '/app/inventory', label: 'Inventario', icon: Boxes, badge: null },
      { path: '/app/warehouses', label: 'Bodegas', icon: Warehouse, badge: null },
      { path: '/app/transfers', label: 'Transferencias', icon: Truck, badge: null },
      { path: '/app/suppliers', label: 'Proveedores', icon: Building2, badge: null },
      { path: '/app/purchase-orders', label: 'Órdenes de Compra', icon: ShoppingBag, badge: null },
      { path: '/app/lots', label: 'Lotes', icon: Calendar, badge: null },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuración',
    icon: Settings,
    items: [
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
    ],
  },
  {
    id: 'customers',
    label: 'Clientes',
    icon: Users,
    items: [
      { path: '/app/customers', label: 'Clientes', icon: Users, badge: null },
      { path: '/app/debts', label: 'Fiao', icon: Users, badge: 'Beta' },
    ],
  },
  {
    id: 'reports',
    label: 'Reportes',
    icon: BarChart3,
    items: [
      { path: '/app/dashboard', label: 'Dashboard', icon: BarChart3, badge: null },
      { path: '/app/reports', label: 'Reportes', icon: BarChart3, badge: null },
    ],
  },
  {
    id: 'ml',
    label: 'Machine Learning',
    icon: Brain,
    items: [
      { path: '/app/ml', label: 'ML Dashboard', icon: Brain, badge: null },
      { path: '/app/ml/predictions', label: 'Predicciones', icon: TrendingUp, badge: null },
      { path: '/app/ml/evaluation', label: 'Evaluacion', icon: Brain, badge: 'Nuevo' },
      { path: '/app/ml/anomalies', label: 'Anomalías', icon: AlertTriangle, badge: null },
      { path: '/app/realtime-analytics', label: 'Analytics Tiempo Real', icon: Activity, badge: null },
    ],
  },
]

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { isOnline } = useOnline()
  const { add, addUnique } = useNotifications()
  const prevOnlineRef = useRef<boolean | null>(null)

  useEffect(() => {
    if (prevOnlineRef.current === null) {
      prevOnlineRef.current = isOnline
      if (!isOnline) {
        toast.warning('Sin conexión. Tus ventas se guardarán localmente.')
      }
      return
    }

    if (prevOnlineRef.current !== isOnline) {
      if (isOnline) {
        toast.success('Conexión restaurada.')
      } else {
        toast.warning('Sin conexión. Tus ventas se guardarán localmente.')
      }
      prevOnlineRef.current = isOnline
    }
  }, [isOnline])
  // Usar el hook de sincronización que combina ambos sistemas
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationsSync()
  const storeId = user?.store_id

  // Modal de ayuda de atajos de teclado
  const { isOpen: isShortcutsHelpOpen, setIsOpen: setShortcutsHelpOpen } = useKeyboardShortcutsHelp()
  const userRole = (user?.role || 'cashier') as Role
  const localLicense = licenseService.getLocalStatus()
  const userFeatures =
    user?.license_features && user.license_features.length > 0
      ? user.license_features
      : (localLicense?.features || [])

  const [isUpgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [upgradeFeatureName, setUpgradeFeatureName] = useState('')

  const openUpgradeModal = (feature?: string) => {
    setUpgradeFeatureName(feature || '')
    setUpgradeModalOpen(true)
  }

  const filteredNavSections = useMemo(() => {
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => isRouteAllowed(item.path, userRole, userFeatures)),
      }))
      .filter((section) => section.items.length > 0)
  }, [userRole, userFeatures])

  // Licencia (solo lectura)
  const licenseStatus = user?.license_status || 'active'
  const licenseExpiresAt = user?.license_expires_at ? new Date(user.license_expires_at) : null
  const daysToExpire = licenseExpiresAt ? Math.ceil((licenseExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
  const isExpired = licenseStatus === 'suspended' || (licenseExpiresAt ? licenseExpiresAt.getTime() < Date.now() : false)
  const isExpiringSoon = !isExpired && daysToExpire !== null && daysToExpire <= 7

  // Alertas de stock bajo (se refrescan cada 5 min)
  const { data: lowStock } = useQuery({
    queryKey: ['alerts', 'low-stock', storeId],
    queryFn: () => inventoryService.getLowStock(),
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  })

  // Estado de caja actual (para recordatorio de cierre)
  const { data: currentCash } = useQuery({
    queryKey: ['alerts', 'cash-session', storeId],
    queryFn: () => cashService.getCurrentSession(),
    enabled: !!storeId,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 2,
  })

  // Prefetch inteligente cuando el usuario navega entre páginas
  useEffect(() => {
    if (!user?.store_id) return
    if (!isRouteAllowed(location.pathname, userRole, userFeatures)) return

    const pathToPage: Record<
      string,
      'pos' | 'products' | 'inventory' | 'sales' | 'cash' | 'customers' | 'debts' | 'reports'
    > = {
      '/app/pos': 'pos',
      '/app/products': 'products',
      '/app/inventory': 'inventory',
      '/app/sales': 'sales',
      '/app/cash': 'cash',
      '/app/customers': 'customers',
      '/app/debts': 'debts',
      '/app/reports': 'reports',
    }

    const page = pathToPage[location.pathname]
    if (page) {
      // Prefetch en background - no bloquea la UI
      prefetchPageData(page, user.store_id, queryClient, userRole).catch(() => {
        // Silenciar errores
      })
    }
  }, [location.pathname, user?.store_id, userRole, queryClient])
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Alertas básicas de conectividad
  useEffect(() => {
    add({
      title: isOnline ? 'Conexión restaurada' : 'Sin conexión',
      description: isOnline
        ? 'Seguimos sincronizando en segundo plano.'
        : 'Estás offline, las ventas se guardarán localmente.',
      type: isOnline ? 'success' : 'warning',
    })
  }, [isOnline, add])

  // Alertas de licencia
  useEffect(() => {
    if (!storeId) return
    if (isExpired) {
      addUnique(`license-expired-${storeId}`, {
        title: 'Licencia vencida o suspendida',
        description: 'Contacta al administrador para renovar tu acceso.',
        type: 'error',
      })
    } else if (isExpiringSoon && daysToExpire !== null) {
      addUnique(`license-expiring-${storeId}`, {
        title: 'Licencia por vencer',
        description: `Tu licencia vence en ${daysToExpire} día(s).`,
        type: 'warning',
      })
    }
  }, [storeId, isExpired, isExpiringSoon, daysToExpire, addUnique])

  // Alertas de stock bajo
  useEffect(() => {
    if (!lowStock || lowStock.length === 0) return
    lowStock.forEach((item) => {
      const remaining = Number(item.current_stock ?? 0)
      addUnique(`low-stock-${item.product_id}`, {
        title: `Stock bajo: ${item.product_name}`,
        description: `Quedan ${remaining} unidades (umbral ${item.low_stock_threshold}).`,
        type: 'warning',
      })
    })
  }, [lowStock, addUnique])

  // Recordatorio de cierre de caja (si lleva > 8h abierta)
  useEffect(() => {
    if (!currentCash?.id || !currentCash.opened_at || currentCash.closed_at) return
    const openedAt = new Date(currentCash.opened_at).getTime()
    const hoursOpen = (Date.now() - openedAt) / (1000 * 60 * 60)
    if (hoursOpen >= 8) {
      addUnique(`cash-open-${currentCash.id}`, {
        title: 'Cierre de caja pendiente',
        description: `Sesión abierta hace ${hoursOpen.toFixed(1)}h. Considera cerrar o hacer arqueo.`,
        type: 'info',
      })
    }
  }, [currentCash, addUnique])

  // Función mejorada para determinar si una ruta está activa
  // Solo activa la ruta más específica que coincida
  const isActive = useCallback((path: string) => {
    const currentPath = location.pathname

    // Coincidencia exacta
    if (currentPath === path) return true

    // Si la ruta actual empieza con este path, verificar que no haya una ruta más específica
    if (currentPath.startsWith(path + '/')) {
      // Buscar en todas las secciones si hay alguna ruta más específica que también coincida
      const allPaths = filteredNavSections.flatMap((section) =>
        section.items.map((item) => item.path)
      )
      const hasMoreSpecificMatch = allPaths.some(itemPath =>
        itemPath !== path &&
        currentPath.startsWith(itemPath + '/') &&
        itemPath.startsWith(path + '/')
      )
      // Solo estar activo si no hay una coincidencia más específica
      return !hasMoreSpecificMatch
    }

    return false
  }, [location.pathname, filteredNavSections])

  // Encontrar la sección que contiene la ruta activa
  const activeSectionId = useMemo(() => {
    const activeSection = filteredNavSections.find((section) =>
      section.items.some((item) => isActive(item.path))
    )
    return activeSection?.id
  }, [filteredNavSections, isActive])

  // Estado controlado para las secciones abiertas
  const [openSections, setOpenSections] = useState<string[]>([])

  // Actualizar secciones abiertas cuando cambia la ruta activa
  useEffect(() => {
    if (activeSectionId) {
      setOpenSections((prev) => {
        // Solo actualizar si la sección activa no está ya abierta
        if (!prev.includes(activeSectionId)) {
          return [activeSectionId]
        }
        return prev
      })
    }
  }, [activeSectionId])

  const handleNavClick = (path: string) => {
    navigate(path)
    setMobileOpen(false)
  }

  const getInitials = (name?: string | null) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }


  return (
    <div className="min-h-screen bg-background">
      {/* Skip Links for accessibility */}
      <SkipLinks />

      <QuotaBanner onUpgrade={() => openUpgradeModal()} />

      {/* Command Menu (Ctrl/Cmd + K) */}
      <CommandMenu />

      {/* Header */}
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40 shadow-sm transition-all duration-300"
      )}>
        <div className="flex h-16 items-center gap-2 sm:gap-4 px-3 sm:px-6">
          {/* Logo (Desktop) */}
          <div className="hidden lg:flex items-center gap-3">
            <img
              src="/logo-velox.svg"
              alt="Velox POS Logo"
              className="w-10 h-10 rounded-lg"
            />
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Velox POS</h2>
              <p className="text-xs text-muted-foreground">Velox POS</p>
            </div>
          </div>

          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden flex-shrink-0"
                aria-label="Abrir menú de navegación"
                aria-expanded={mobileOpen}
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 flex flex-col max-h-screen overflow-hidden" hideClose>
              <SidebarContent
                isMobile
                sidebarCollapsed={sidebarCollapsed}
                setSidebarCollapsed={setSidebarCollapsed}
                setMobileOpen={setMobileOpen}
                filteredNavSections={filteredNavSections}
                isActive={isActive}
                openSections={openSections}
                setOpenSections={setOpenSections}
                handleNavClick={handleNavClick}
              />
            </SheetContent>
          </Sheet>

          {/* Page Title (Mobile) */}
          <div className="flex-1 lg:hidden min-w-0">
            <h1 className="text-base sm:text-lg font-semibold truncate">
              {(() => {
                const activeItem = filteredNavSections
                  .flatMap((section) => section.items)
                  .find((item) => isActive(item.path))
                if (activeItem?.label === 'Punto de Venta') {
                  return 'POS'
                }
                return activeItem?.label || 'Velox POS'
              })()}
            </h1>
          </div>

          {/* Spacer (Desktop) */}
          <div className="hidden lg:flex flex-1" />

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <span
              className="sm:hidden inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_0_4px_rgba(16,185,129,0.18)]"
              aria-hidden="true"
            />
            <div className="hidden sm:flex">
              <SyncStatusBadge />
            </div>
            {/* Exchange Rate Indicator */}
            <ExchangeRateIndicator className="hidden sm:flex" />
            <ExchangeRateIndicator compact className="sm:hidden" />
            <ModeToggle />

            {/* Notifications */}
            <div className="hidden sm:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} sin leer` : ''}`}
                    aria-expanded={false}
                  >
                    <Bell className="w-5 h-5" aria-hidden="true" />
                    {unreadCount > 0 && (
                      <span
                        className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-destructive text-[10px] leading-[18px] rounded-full text-white text-center"
                        aria-hidden="true"
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-0 flex flex-col max-h-[500px]">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                    <div>
                      <p className="text-sm font-semibold">Notificaciones</p>
                      <p className="text-xs text-muted-foreground">
                        {unreadCount} sin leer · {notifications.length} total
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={markAllAsRead}>
                        Marcar leídas
                      </Button>
                    </div>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Sin notificaciones
                    </div>
                  ) : (
                    <div className="overflow-y-auto overflow-x-hidden max-h-[400px]">
                      <div className="divide-y divide-border">
                        {notifications.map((n) => {
                          const Icon =
                            n.type === 'warning'
                              ? AlertTriangle
                              : n.type === 'success'
                                ? CheckCircle2
                                : Info
                          const color =
                            n.type === 'warning'
                              ? 'text-amber-600'
                              : n.type === 'success'
                                ? 'text-emerald-600'
                                : n.type === 'error'
                                  ? 'text-red-600'
                                  : 'text-primary'
                          return (
                            <button
                              key={n.id}
                              className={cn(
                                'w-full text-left px-4 py-3 hover:bg-accent transition-colors',
                                !n.read && 'bg-accent/40'
                              )}
                              onClick={() => markAsRead(n.id)}
                            >
                              <div className="flex gap-3 items-start">
                                <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', color)} />
                                <div className="flex-1 space-y-0.5 min-w-0">
                                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                                  {n.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground">
                                    {new Date(n.created_at).toLocaleString()}
                                  </p>
                                </div>
                                {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1 flex-shrink-0" />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Separator orientation="vertical" className="h-6 hidden sm:block" />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                      {getInitials(user?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium leading-none">
                      {user?.full_name || 'Usuario'}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {user?.role || 'cashier'}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="sm:hidden">
                  <div className="px-3 py-2 flex items-center justify-between border-b border-border">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Bell className="w-4 h-4 text-muted-foreground" />
                      Notificaciones
                    </div>
                    {unreadCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 bg-destructive text-[10px] leading-[18px] rounded-full text-white text-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs text-muted-foreground border-b border-border">
                      Sin notificaciones
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto border-b border-border">
                      {notifications.map((n) => {
                        const Icon =
                          n.type === 'warning'
                            ? AlertTriangle
                            : n.type === 'success'
                              ? CheckCircle2
                              : Info
                        const color =
                          n.type === 'warning'
                            ? 'text-amber-600'
                            : n.type === 'success'
                              ? 'text-emerald-600'
                              : n.type === 'error'
                                ? 'text-red-600'
                                : 'text-primary'
                        return (
                          <button
                            key={n.id}
                            className={cn(
                              'w-full text-left px-3 py-2 hover:bg-accent transition-colors',
                              !n.read && 'bg-accent/40'
                            )}
                            onClick={() => markAsRead(n.id)}
                          >
                            <div className="flex gap-2 items-start">
                              <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', color)} />
                              <div className="flex-1 space-y-0.5 min-w-0">
                                <p className="text-xs font-medium text-foreground line-clamp-2">{n.title}</p>
                                {n.description && (
                                  <p className="text-[10px] text-muted-foreground line-clamp-2">{n.description}</p>
                                )}
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(n.created_at).toLocaleString()}
                                </p>
                              </div>
                              {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1 flex-shrink-0" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {notifications.length > 0 && (
                    <div className="px-3 py-2">
                      <Button size="sm" variant="ghost" className="w-full" onClick={markAllAsRead}>
                        Marcar todas como leídas
                      </Button>
                    </div>
                  )}
                </div>
                <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Configuración
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bell className="w-4 h-4 mr-2" />
                  Notificaciones
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {(isExpired || isExpiringSoon) && (
          <div className="px-6 pb-3">
            <Alert variant={isExpired ? 'destructive' : 'default'}>
              <AlertTitle>
                {isExpired ? 'Licencia vencida/suspendida' : `Licencia vence en ${daysToExpire} día(s)`}
              </AlertTitle>
              <AlertDescription>
                {isExpired
                  ? 'Renueva tu licencia para continuar operando.'
                  : 'Por favor renueva antes de la fecha de vencimiento.'}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </header>

      <div
        className={cn(
          "flex h-[calc(100vh-4rem)]"
        )}
      >
        {/* Desktop Sidebar */}
        <aside
          id="main-navigation"
          className={cn(
            "hidden lg:flex flex-col border-r border-border bg-background transition-all duration-300 h-full",
            sidebarCollapsed ? "w-20" : "w-64"
          )}
          aria-label="Navegación principal"
        >
          <SidebarContent
            sidebarCollapsed={sidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
            setMobileOpen={setMobileOpen}
            filteredNavSections={filteredNavSections}
            isActive={isActive}
            openSections={openSections}
            setOpenSections={setOpenSections}
            handleNavClick={handleNavClick}
          />
        </aside>

        {/* Main Content */}
        <main
          id="main-content"
          className={cn(
            "flex-1 overflow-x-hidden touch-pan-y overscroll-contain min-h-0 scroll-smooth",
            location.pathname.includes('/pos') ? "overflow-hidden" : "overflow-y-auto"
          )}
          data-pull-to-refresh
          role="main"
          aria-label="Contenido principal"
        >
          {location.pathname.includes('/pos') ? (
            // POS sin animación para evitar conflictos con su estado interno
            <div className="p-0 lg:p-0">
              <Outlet />
            </div>
          ) : (
            <div className="p-4 lg:p-8">
              {/* Breadcrumbs removed per user request to save space */}
              {/* <div className="hidden md:block mb-4">
                <Breadcrumbs />
              </div> */}
              <Outlet />
            </div>
          )}
        </main>
      </div>

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        isOpen={isShortcutsHelpOpen}
        onOpenChange={setShortcutsHelpOpen}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        featureName={upgradeFeatureName}
      />
    </div>
  )
}
