import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
import { motion, AnimatePresence } from 'framer-motion'
import { useNotifications } from '@/stores/notifications.store'
import { useOnline } from '@/hooks/use-online'
import { inventoryService } from '@/services/inventory.service'
import { cashService } from '@/services/cash.service'
import { syncService } from '@/services/sync.service'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useNotificationsSync } from '@/hooks/useNotificationsSync'
import { isRouteAllowed, type Role } from '@/lib/permissions'
import ExchangeRateIndicator from '@/components/exchange/ExchangeRateIndicator'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import OfflineBanner from '@/components/offline/OfflineBanner'
import { KeyboardShortcutsHelp, useKeyboardShortcutsHelp } from '@/components/ui/keyboard-shortcuts-help'
// import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { SkipLinks } from '@/components/ui/skip-links'
import { SyncStatusBadge } from '@/components/sync/SyncStatusBadge'
import { CommandMenu } from './CommandMenu'
import { QuotaBanner } from '@/components/license/QuotaTracker'
import { UpgradeModal } from '@/components/license/UpgradeModal'

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

  // Detectar cuando el banner offline está visible (misma lógica que OfflineBanner)
  const [showBanner, setShowBanner] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  // Replicar lógica de visibilidad del banner
  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true)
    } else {
      // Delay para mostrar mensaje de reconexión (igual que en OfflineBanner)
      const timer = setTimeout(() => {
        setShowBanner(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline])

  // Obtener conteo de eventos pendientes
  useEffect(() => {
    const updatePendingCount = () => {
      try {
        const status = syncService.getStatus()
        setPendingCount(status.pendingCount)
      } catch {
        setPendingCount(0)
      }
    }

    updatePendingCount()
    const interval = setInterval(updatePendingCount, 5000)
    return () => clearInterval(interval)
  }, [])

  // El banner está visible si showBanner es true o hay eventos pendientes
  const isBannerVisible = showBanner || pendingCount > 0
  // Usar el hook de sincronización que combina ambos sistemas
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationsSync()
  const storeId = user?.store_id

  // Modal de ayuda de atajos de teclado
  const { isOpen: isShortcutsHelpOpen, setIsOpen: setShortcutsHelpOpen } = useKeyboardShortcutsHelp()
  const userRole = (user?.role || 'cashier') as Role
  const userFeatures = user?.license_features || []

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

  // Sidebar Content Component
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }): JSX.Element => {
    // Estado para controlar qué popover está abierto
    const [openPopover, setOpenPopover] = useState<string | null>(null)

    // Cuando está colapsado, mostrar secciones con popovers
    if (sidebarCollapsed && !isMobile) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col h-full min-h-0 bg-background/80 backdrop-blur-xl border-r border-white/10"
        >
          <div className="h-4"></div>
          <div className="h-4"></div>
          <ScrollArea className="flex-1 min-h-0 px-2 py-4">
            <nav className="space-y-2">
              {filteredNavSections.map((section) => {
                const SectionIcon = section.icon
                const hasActiveItem = section.items.some((item) => isActive(item.path))
                const isOpen = openPopover === section.id

                return (
                  <Popover
                    key={section.id}
                    open={isOpen}
                    onOpenChange={(open) => setOpenPopover(open ? section.id : null)}
                    modal={false}
                  >
                    <TooltipProvider delayDuration={0}>
                      <Tooltip delayDuration={300} disableHoverableContent>
                        <TooltipTrigger asChild>
                          <PopoverTrigger asChild>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={cn(
                                "relative w-full flex items-center justify-center px-2 py-3 rounded-xl text-sm font-medium transition-all duration-300",
                                hasActiveItem
                                  ? "bg-primary text-primary-foreground shadow-[0_4px_20px_-4px_rgba(99,102,241,0.5)]"
                                  : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                              )}
                            >
                              <SectionIcon className="w-5 h-5 flex-shrink-0" strokeWidth={hasActiveItem ? 2.5 : 2} />
                              {hasActiveItem && (
                                <motion.div
                                  layoutId="active-pill"
                                  className="absolute inset-0 rounded-xl bg-primary z-[-1]"
                                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                              )}
                            </motion.button>
                          </PopoverTrigger>
                        </TooltipTrigger>
                        {!isOpen && (
                          <TooltipContent side="right" className="bg-popover/90 backdrop-blur-md border-white/10 text-popover-foreground">
                            <p className="font-medium">{section.label}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    <PopoverContent side="right" align="start" className="w-60 p-2 bg-background/90 backdrop-blur-xl border-white/10 shadow-2xl rounded-2xl ml-2">
                      {/* Popover content remains same structural logic but styled */}
                      <div className="space-y-1">
                        <div className="px-3 py-2 text-xs font-bold text-muted-foreground/70 uppercase tracking-wider">
                          {section.label}
                        </div>
                        {section.items.map((item) => {
                          const Icon = item.icon
                          const active = isActive(item.path)

                          return (
                            <motion.button
                              key={item.path}
                              onClick={() => {
                                handleNavClick(item.path)
                                setOpenPopover(null)
                              }}
                              whileHover={{ x: 4 }}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                                active
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                              )}
                            >
                              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
                              <span className="flex-1 text-left truncate">{item.label}</span>
                            </motion.button>
                          )
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                )
              })}
            </nav>
          </ScrollArea>

          {/* Collapse Button */}
          {
            !isMobile && (
              <div className="p-3 flex-shrink-0 border-t border-white/5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="w-full hover:bg-white/5 text-muted-foreground hover:text-foreground justify-center h-10 rounded-xl"
                >
                  <ChevronLeft className="w-5 h-5 rotate-180 transition-transform" />
                </Button>
              </div>
            )
          }
        </motion.div >
      )
    }

    return (
      <div className="flex flex-col h-full min-h-0 bg-background/80 backdrop-blur-xl border-r border-white/10">
        {/* Logo - Only show in mobile sidebar or if expanded desktop */}
        {/* Logo removed as per user request (present in header) */}
        <div className="h-4"></div>

        {/* Navigation with Collapsible Sections */}
        <ScrollArea className="flex-1 min-h-0 px-4 py-2">
          <nav className="space-y-4">
            <Accordion
              type="multiple"
              value={openSections}
              onValueChange={setOpenSections}
              className="w-full space-y-4"
            >
              {filteredNavSections.map((section) => {
                const SectionIcon = section.icon
                const hasActiveItem = section.items.some((item) => isActive(item.path))

                return (
                  <AccordionItem key={section.id} value={section.id} className="border-0">
                    <AccordionTrigger
                      className={cn(
                        "px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:no-underline group",
                        hasActiveItem
                          ? "bg-primary/5 text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <SectionIcon className={cn("w-5 h-5 flex-shrink-0 transition-colors", hasActiveItem ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={2.5} />
                        <span className="flex-1 text-left">{section.label}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-0">
                      <div className="space-y-1 pl-4 relative">
                        {/* Connecting line */}
                        <div className="absolute left-6 top-2 bottom-2 w-[1px] bg-border/50" />

                        {section.items.map((item) => {
                          const Icon = item.icon
                          const active = isActive(item.path)

                          return (
                            <motion.button
                              key={item.path}
                              onClick={() => handleNavClick(item.path)}
                              whileHover={{ x: 4 }}
                              className={cn(
                                "relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ml-2",
                                active
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                              )}
                            >
                              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
                              <span className="flex-1 text-left">{item.label}</span>
                              {active && (
                                <motion.div
                                  layoutId="active-dot"
                                  className="absolute left-0 w-1 h-5 bg-primary rounded-full -ml-[9px]"
                                />
                              )}
                              {item.badge && (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px] h-5 px-1.5 flex-shrink-0",
                                    item.badge === 'Nuevo' ? "bg-indigo-500/20 text-indigo-400" : ""
                                  )}
                                >
                                  {item.badge}
                                </Badge>
                              )}
                            </motion.button>
                          )
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </nav>
        </ScrollArea>

        {/* Collapse Button (Desktop only) */}
        {!isMobile && (
          <div className="p-4 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full h-12 rounded-xl border border-border/50 hover:bg-accent/50 hover:border-border transition-all text-muted-foreground group"
            >
              <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              <span className="ml-2 font-medium">Contraer Menú</span>
            </Button>
          </div>
        )}
      </div>
    )
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
        "sticky z-40 bg-background/80 backdrop-blur-xl border-b border-border/40 shadow-sm transition-all duration-300",
        // Ajustar posición cuando el banner está visible (offline o reconexión)
        isBannerVisible ? "top-[48px]" : "top-0"
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
              <p className="text-xs text-muted-foreground">Sistema POS</p>
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
            <SheetContent side="left" className="p-0 w-72 flex flex-col max-h-screen overflow-hidden">
              <SidebarContent isMobile />
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
            <SyncStatusBadge />
            {/* Exchange Rate Indicator */}
            <ExchangeRateIndicator className="hidden sm:flex" />
            <ExchangeRateIndicator compact className="sm:hidden" />

            {/* Notifications */}
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

            <Separator orientation="vertical" className="h-6" />

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
          "flex",
          // Ajustar altura para compensar el banner cuando está visible
          isBannerVisible
            ? "h-[calc(100vh-4rem-48px)]"
            : "h-[calc(100vh-4rem)]"
        )}
        style={{
          // Cuando el banner está visible, el header sticky está en top-[48px]
          // El contenedor normalmente empieza después del header (64px), pero como el header
          // ahora está desplazado 48px hacia abajo, el contenedor necesita 48px adicionales de padding
          paddingTop: isBannerVisible ? '48px' : undefined
        }}
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
          <SidebarContent />
        </aside>

        {/* Main Content */}
        <main
          id="main-content"
          className="flex-1 overflow-x-hidden overflow-y-auto"
          role="main"
          aria-label="Contenido principal"
        >
          {location.pathname.includes('/pos') ? (
            // POS sin animación para evitar conflictos con su estado interno
            <div className="p-0 lg:p-0">
              <Outlet />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{
                  duration: 0.25,
                  ease: [0.4, 0, 0.2, 1] // ease-out cubic bezier para transición más suave
                }}
                className={cn(
                  "p-6 lg:p-8"
                )}
              >
                {/* Breadcrumbs removed per user request to save space */}
                {/* <div className="hidden md:block mb-4">
                  <Breadcrumbs />
                </div> */}
                <Outlet />
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Offline Banner */}
      <OfflineBanner />

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
