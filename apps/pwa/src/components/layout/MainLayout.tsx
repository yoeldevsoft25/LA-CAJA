import React, { useState, useEffect, useMemo } from 'react'
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
  Store,
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
  Brain,
  TrendingUp,
  Activity,
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
import { ScrollArea as ShadScrollArea } from '@/components/ui/scroll-area'
import { useOnline } from '@/hooks/use-online'
import { inventoryService } from '@/services/inventory.service'
import { cashService } from '@/services/cash.service'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useNotificationsSync } from '@/hooks/useNotificationsSync'

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
  { path: '/pos', label: 'Punto de Venta', icon: ShoppingCart, badge: null },
      { path: '/fast-checkout', label: 'Caja Rápida', icon: Zap, badge: null },
      { path: '/sales', label: 'Ventas', icon: FileText, badge: null },
      { path: '/tables', label: 'Mesas y Órdenes', icon: Square, badge: null },
    ],
  },
  {
    id: 'products',
    label: 'Productos e Inventario',
    icon: Package,
    items: [
  { path: '/products', label: 'Productos', icon: Package, badge: null },
  { path: '/inventory', label: 'Inventario', icon: Boxes, badge: null },
      { path: '/warehouses', label: 'Bodegas', icon: Warehouse, badge: null },
      { path: '/transfers', label: 'Transferencias', icon: Truck, badge: null },
      { path: '/suppliers', label: 'Proveedores', icon: Building2, badge: null },
      { path: '/lots', label: 'Lotes', icon: Calendar, badge: null },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuración',
    icon: Settings,
    items: [
  { path: '/cash', label: 'Caja', icon: DollarSign, badge: null },
  { path: '/shifts', label: 'Turnos', icon: Clock, badge: null },
  { path: '/payments', label: 'Pagos', icon: Settings, badge: null },
  { path: '/discounts', label: 'Descuentos', icon: Percent, badge: null },
      { path: '/promotions', label: 'Promociones', icon: Tag, badge: null },
      { path: '/price-lists', label: 'Listas de Precio', icon: DollarSignIcon, badge: null },
      { path: '/invoice-series', label: 'Series de Factura', icon: Receipt, badge: null },
      { path: '/fiscal-config', label: 'Configuración Fiscal', icon: FileText, badge: null },
      { path: '/fiscal-invoices', label: 'Facturas Fiscales', icon: ReceiptText, badge: null },
      { path: '/peripherals', label: 'Periféricos', icon: Cpu, badge: null },
    ],
  },
  {
    id: 'customers',
    label: 'Clientes',
    icon: Users,
    items: [
  { path: '/customers', label: 'Clientes', icon: Users, badge: null },
  { path: '/debts', label: 'Fiao', icon: Users, badge: 'Beta' },
    ],
  },
  {
    id: 'reports',
    label: 'Reportes',
    icon: BarChart3,
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: BarChart3, badge: null },
      { path: '/reports', label: 'Reportes', icon: BarChart3, badge: null },
    ],
  },
  {
    id: 'ml',
    label: 'Machine Learning',
    icon: Brain,
    items: [
      { path: '/ml', label: 'ML Dashboard', icon: Brain, badge: null },
      { path: '/ml/predictions', label: 'Predicciones', icon: TrendingUp, badge: null },
      { path: '/ml/anomalies', label: 'Anomalías', icon: AlertTriangle, badge: null },
      { path: '/realtime-analytics', label: 'Analytics Tiempo Real', icon: Activity, badge: null },
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
  // Usar el hook de sincronización que combina ambos sistemas
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationsSync()
  const storeId = user?.store_id

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

    const pathToPage: Record<string, 'pos' | 'products' | 'inventory' | 'sales' | 'cash' | 'customers' | 'debts' | 'reports'> = {
      '/pos': 'pos',
      '/products': 'products',
      '/inventory': 'inventory',
      '/sales': 'sales',
      '/cash': 'cash',
      '/customers': 'customers',
      '/debts': 'debts',
      '/reports': 'reports',
    }

    const page = pathToPage[location.pathname]
    if (page) {
      // Prefetch en background - no bloquea la UI
      prefetchPageData(page, user.store_id, queryClient).catch(() => {
        // Silenciar errores
      })
    }
  }, [location.pathname, user?.store_id, queryClient])
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

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  // Encontrar la sección que contiene la ruta activa
  const activeSectionId = useMemo(() => {
    const activeSection = navSections.find((section) =>
      section.items.some((item) => isActive(item.path))
    )
    return activeSection?.id
  }, [location.pathname])

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
        <div className="flex flex-col h-full min-h-0">
          <ScrollArea className="flex-1 min-h-0 px-2 py-4">
            <nav className="space-y-1">
              {navSections.map((section) => {
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
                            <button
                              className={cn(
                                "w-full flex items-center justify-center px-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                                hasActiveItem
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                              )}
                            >
                              <SectionIcon className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
                            </button>
                          </PopoverTrigger>
                        </TooltipTrigger>
                        {!isOpen && (
                          <TooltipContent side="right">
                            <p>{section.label}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    <PopoverContent side="right" align="start" className="w-56 p-1">
                      <div className="space-y-0.5">
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {section.label}
                        </div>
                        {section.items.map((item) => {
                          const Icon = item.icon
                          const active = isActive(item.path)

                          return (
                            <button
                              key={item.path}
                              onClick={() => {
                                handleNavClick(item.path)
                                setOpenPopover(null) // Cerrar popover al hacer click
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                active
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                              )}
                            >
                              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                              <span className="flex-1 text-left truncate">{item.label}</span>
                              {item.badge && (
                                <Badge variant="secondary" className="text-xs flex-shrink-0">
                                  {item.badge}
                                </Badge>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                )
              })}
            </nav>
          </ScrollArea>

          {/* Collapse Button (Desktop only) */}
          {!isMobile && (
            <>
              <Separator className="flex-shrink-0" />
              <div className="p-3 flex-shrink-0">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="w-full hover:bg-accent hover:shadow-sm transition-shadow px-2 justify-center"
                      >
                        <ChevronLeft
                          className={cn(
                            "w-4 h-4 transition-transform",
                            sidebarCollapsed && "rotate-180"
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Expandir</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </>
          )}
        </div>
      )
    }

    return (
    <div className="flex flex-col h-full min-h-0">
      {/* Logo - Only show in mobile sidebar */}
      {isMobile && (
        <div className="flex items-center px-6 h-16 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
              <Store className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">LA CAJA</h2>
              <p className="text-xs text-muted-foreground">Sistema POS</p>
            </div>
          </div>
        </div>
      )}

        {/* Navigation with Collapsible Sections */}
      <ScrollArea className="flex-1 min-h-0 px-3 py-4">
          <nav className="space-y-1">
            <Accordion
              type="multiple"
              value={openSections}
              onValueChange={setOpenSections}
              className="w-full"
            >
              {navSections.map((section) => {
                const SectionIcon = section.icon
                const hasActiveItem = section.items.some((item) => isActive(item.path))

                return (
                  <AccordionItem key={section.id} value={section.id} className="border-0">
                    <AccordionTrigger
                      className={cn(
                        "px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:no-underline",
                        hasActiveItem
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <SectionIcon className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
                        <span className="flex-1 text-left">{section.label}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-2">
                      <div className="space-y-0.5 pl-8">
                        {section.items.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)

            return (
                    <button
                              key={item.path}
                      onClick={() => handleNavClick(item.path)}
                      className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="text-xs flex-shrink-0">
                              {item.badge}
                            </Badge>
                      )}
                    </button>
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
        <>
          <Separator className="flex-shrink-0" />
          <div className="p-3 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={cn(
                "w-full hover:bg-accent hover:shadow-sm transition-shadow",
                sidebarCollapsed && "px-2"
              )}
            >
              <ChevronLeft
                className={cn(
                  "w-4 h-4 transition-transform",
                  sidebarCollapsed && "rotate-180"
                )}
              />
              {!sidebarCollapsed && <span className="ml-2">Contraer</span>}
            </Button>
          </div>
        </>
      )}
    </div>
  )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center gap-4 px-6">
          {/* Logo (Desktop) */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
              <Store className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">LA CAJA</h2>
              <p className="text-xs text-muted-foreground">Sistema POS</p>
            </div>
          </div>

          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 flex flex-col max-h-screen overflow-hidden">
              <SidebarContent isMobile />
            </SheetContent>
          </Sheet>

          {/* Page Title (Mobile) */}
          <div className="flex-1 lg:hidden">
            <h1 className="text-lg font-semibold">
              {navSections
                .flatMap((section) => section.items)
                .find((item) => isActive(item.path))?.label || 'LA CAJA'}
            </h1>
          </div>

          {/* Spacer (Desktop) */}
          <div className="hidden lg:flex flex-1" />

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-destructive text-[10px] leading-[18px] rounded-full text-white text-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
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
                  <ShadScrollArea className="max-h-96">
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
                              <Icon className={cn('w-4 h-4 mt-0.5', color)} />
                              <div className="flex-1 space-y-0.5">
                                <p className="text-sm font-medium text-foreground">{n.title}</p>
                                {n.description && (
                                  <p className="text-xs text-muted-foreground">{n.description}</p>
                                )}
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(n.created_at).toLocaleString()}
                                </p>
                              </div>
                              {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </ShadScrollArea>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings */}
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>

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
                {isExpired ? 'Licencia vencida/suspendida' : `Licencia vence en ${daysToExpire} día(s)` }
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

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden lg:flex flex-col border-r border-border bg-background transition-all duration-300 h-full",
            sidebarCollapsed ? "w-20" : "w-64"
          )}
        >
          <SidebarContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6 lg:p-8"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
