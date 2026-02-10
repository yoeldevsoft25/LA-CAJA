import React, { useState, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    CreditCard,
    Menu,
    ChevronLeft,
    ShieldCheck,
    LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
import { adminService } from '@/services/admin.service'
import { SkipLinks } from '@/components/ui/skip-links'

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
}

const adminNavSections: NavSection[] = [
    {
        id: 'overview',
        label: 'Resumen',
        icon: LayoutDashboard,
        items: [
            { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, badge: null },
        ],
    },
    {
        id: 'management',
        label: 'Gestión',
        icon: ShieldCheck,
        items: [
            { path: '/admin/license-payments', label: 'Pagos de Licencias', icon: CreditCard, badge: null },
        ],
    },
]

export default function AdminLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    const handleLogout = () => {
        adminService.clearKey()
        navigate('/login')
    }

    const isActive = useCallback((path: string) => {
        return location.pathname === path || (path !== '/admin' && location.pathname.startsWith(path))
    }, [location.pathname])

    const handleNavClick = (path: string) => {
        navigate(path)
        setMobileOpen(false)
    }

    // Sidebar Content Component
    const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }): JSX.Element => {

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
                            {adminNavSections.map((section) => {
                                const SectionIcon = section.icon
                                const hasActiveItem = section.items.some((item) => isActive(item.path))

                                return (
                                    <TooltipProvider key={section.id} delayDuration={0}>
                                        <Tooltip delayDuration={300} disableHoverableContent>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className={cn(
                                                        "relative w-full flex items-center justify-center px-2 py-3 rounded-xl h-auto aspect-square",
                                                        hasActiveItem
                                                            ? "bg-primary text-primary-foreground"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                                                    )}
                                                    onClick={() => handleNavClick(section.items[0].path)} // Simple navigation for collapsed
                                                >
                                                    <SectionIcon className="w-5 h-5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="bg-popover/90 backdrop-blur-md">
                                                <p>{section.label}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )
                            })}
                        </nav>
                    </ScrollArea>
                    <div className="p-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSidebarCollapsed(false)}
                            className="w-full h-10 rounded-xl hover:bg-white/5"
                        >
                            <ChevronLeft className="w-5 h-5 rotate-180" />
                        </Button>
                    </div>
                </motion.div>
            )
        }

        return (
            <div className="flex flex-col h-full min-h-0 bg-background/80 backdrop-blur-xl border-r border-white/10">
                {!isMobile && <div className="h-16 flex items-center px-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-[hsl(var(--success))]" />
                        <div>
                            <h1 className="font-bold text-lg leading-tight">Admin</h1>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Panel de Control</p>
                        </div>
                    </div>
                </div>}

                <ScrollArea className="flex-1 min-h-0 px-4 py-4">
                    <nav className="space-y-6">
                        {adminNavSections.map((section) => (
                            <div key={section.id}>
                                <h3 className="mb-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {section.label}
                                </h3>
                                <div className="space-y-1">
                                    {section.items.map((item) => {
                                        const Icon = item.icon
                                        const active = isActive(item.path)

                                        return (
                                            <Button
                                                key={item.path}
                                                variant="ghost"
                                                onClick={() => handleNavClick(item.path)}
                                                className={cn(
                                                    "w-full justify-start gap-3 h-10 rounded-lg font-medium",
                                                    active
                                                        ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                                )}
                                            >
                                                <Icon className="w-4 h-4" />
                                                <span className="flex-1 text-left">{item.label}</span>
                                                {active && (
                                                    <motion.div
                                                        layoutId="active-nav-indicator"
                                                        className="w-1.5 h-1.5 rounded-full bg-primary"
                                                    />
                                                )}
                                            </Button>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>
                </ScrollArea>

                {!isMobile && (
                    <div className="p-4 border-t border-white/5">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Contraer Menú</span>
                        </Button>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <SkipLinks />

            {/* Header */}
            <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40">
                <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
                    {/* Logo (Desktop) */}
                    <div className="hidden lg:flex items-center gap-3">
                        <img
                            src="/logo-velox.svg"
                            alt="Velox POS Logo"
                            className="w-10 h-10 rounded-lg"
                        />
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Velox POS</h2>
                            <p className="text-xs text-muted-foreground">Admin Panel</p>
                        </div>
                    </div>

                    {/* Mobile Menu Trigger */}
                    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="lg:hidden">
                                <Menu className="w-5 h-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-72">
                            <SidebarContent isMobile />
                        </SheetContent>
                    </Sheet>

                    <div className="flex-1" />

                    {/* Right Actions */}
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-2">
                                    <div className="h-8 w-8 rounded-full bg-[hsl(var(--success)_/_0.18)] flex items-center justify-center text-[hsl(var(--success))] font-bold border border-[hsl(var(--success)_/_0.28)]">
                                        A
                                    </div>
                                    <span className="hidden sm:inline-block font-medium">Super Admin</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Cuenta Administrativa</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Cerrar Sesión
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            <div className="flex h-[calc(100vh-64px)]">
                {/* Desktop Sidebar */}
                <div className={cn(
                    "hidden lg:block border-r border-border/40 transition-all duration-300",
                    sidebarCollapsed ? "w-16" : "w-64"
                )}>
                    <SidebarContent />
                </div>

                {/* Main Content */}
                <main className="flex-1 overflow-auto bg-muted/30">
                    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
