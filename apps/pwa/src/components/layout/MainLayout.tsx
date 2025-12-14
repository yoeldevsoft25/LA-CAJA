import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/stores/auth.store'
import {
  LogOut,
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  FileText,
  BarChart3,
  Menu,
  Store,
  ChevronLeft,
  Settings,
  Bell,
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

const navItems = [
  { path: '/pos', label: 'Punto de Venta', icon: ShoppingCart, badge: null },
  { path: '/products', label: 'Productos', icon: Package, badge: null },
  { path: '/sales', label: 'Ventas', icon: FileText, badge: null },
  { path: '/cash', label: 'Caja', icon: DollarSign, badge: null },
  { path: '/customers', label: 'Clientes', icon: Users, badge: null },
  { path: '/debts', label: 'Fiao', icon: Users, badge: 'Beta' },
  { path: '/reports', label: 'Reportes', icon: BarChart3, badge: null },
]

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

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
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
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

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 px-3 py-4">
        <nav className={cn("space-y-1", isMobile && "space-y-0.5")}>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)

            return (
              <TooltipProvider key={item.path} delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavClick(item.path)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 rounded-lg text-sm font-medium transition-all",
                        isMobile ? "py-2" : "py-2.5",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                        sidebarCollapsed && !isMobile && "justify-center px-2"
                      )}
                    >
                      <Icon className={cn("flex-shrink-0", isMobile ? "w-4 h-4" : "w-5 h-5")} strokeWidth={2} />
                      {(!sidebarCollapsed || isMobile) && (
                        <>
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="text-xs flex-shrink-0">
                              {item.badge}
                            </Badge>
                          )}
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  {sidebarCollapsed && !isMobile && (
                    <TooltipContent side="right">
                      <p>{item.label}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )
          })}
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
              {navItems.find((item) => isActive(item.path))?.label || 'LA CAJA'}
            </h1>
          </div>

          {/* Spacer (Desktop) */}
          <div className="hidden lg:flex flex-1" />

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
            </Button>

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
