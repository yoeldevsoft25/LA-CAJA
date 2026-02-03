import React, { useState, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    CreditCard,
    Menu,
    ChevronLeft,
    LogOut,
} from 'lucide-react'
import { cn } from '@la-caja/ui-core'
import { Button } from '@la-caja/ui-core'
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
import { adminService } from '@/services/admin.service'
import BlurFade from '@/components/magicui/blur-fade'


type NavItem = {
    path: string
    label: string
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    badge: string | null
}

type NavSection = {
    id: string
    label: string
    items: NavItem[]
}

const adminNavSections: NavSection[] = [
    {
        id: 'overview',
        label: 'General',
        items: [
            { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, badge: null },
        ],
    },
    {
        id: 'management',
        label: 'Gestión',
        items: [
            { path: '/admin/license-payments', label: 'Pagos & Licencias', icon: CreditCard, badge: null },
        ],
    },
]

export default function AdminLayoutEnhanced() {
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
        return (
            <div className="flex flex-col h-full min-h-0 bg-white/50 dark:bg-black/50 backdrop-blur-xl border-r border-slate-200/50 dark:border-white/10">
                <ScrollArea className="flex-1 min-h-0 py-6">
                    <nav className={cn("space-y-6 flex flex-col", sidebarCollapsed && !isMobile ? "px-0 items-center" : "px-4")}>
                        {adminNavSections.map((section) => (
                            <div key={section.id}>
                                {!sidebarCollapsed && (
                                    <h3 className="mb-2 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] animate-in slide-in-from-left-2 duration-300">
                                        {section.label}
                                    </h3>
                                )}
                                <div className="space-y-1">
                                    {section.items.map((item) => {
                                        const Icon = item.icon
                                        const active = isActive(item.path)

                                        if (sidebarCollapsed && !isMobile) {
                                            return (
                                                <TooltipProvider key={item.path} delayDuration={0}>
                                                    <Tooltip delayDuration={300}>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                className={cn(
                                                                    "relative w-full flex items-center justify-center p-0 h-10 w-10 rounded-xl transition-all duration-300",
                                                                    active
                                                                        ? "bg-[#0c81cf] text-white shadow-lg shadow-[#0c81cf]/20"
                                                                        : "text-slate-500 hover:text-slate-900 hover:bg-[#0c81cf10]"
                                                                )}
                                                                onClick={() => handleNavClick(item.path)}
                                                            >
                                                                <Icon className="w-5 h-5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right" className="font-medium bg-slate-900 text-white border-none">
                                                            {item.label}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )
                                        }

                                        return (
                                            <Button
                                                key={item.path}
                                                variant="ghost"
                                                onClick={() => handleNavClick(item.path)}
                                                className={cn(
                                                    "w-full justify-start gap-3 h-11 rounded-xl font-medium transition-all duration-300 group relative overflow-hidden",
                                                    active
                                                        ? "bg-[#0c81cf10] text-[#0c81cf] hover:bg-[#0c81cf20]"
                                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                                )}
                                            >
                                                <Icon className={cn("w-5 h-5 transition-transform duration-300 group-hover:scale-110", active && "text-[#0c81cf]")} />
                                                <span className="flex-1 text-left">{item.label}</span>
                                                {active && (
                                                    <motion.div
                                                        layoutId="active-nav-indicator"
                                                        className="absolute left-0 top-0 bottom-0 w-1 bg-[#0c81cf] rounded-r-full"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
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
                    <div className="p-4 border-t border-slate-200/50 dark:border-white/5">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className={cn(
                                "w-full text-slate-400 hover:text-slate-600 transition-all duration-300",
                                sidebarCollapsed ? "justify-center px-0" : "justify-start gap-2"
                            )}
                        >
                            <ChevronLeft className={cn("w-4 h-4 transition-transform duration-300", sidebarCollapsed && "rotate-180")} />
                            {!sidebarCollapsed && <span>Ocultar menú</span>}
                        </Button>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 font-sans">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-slate-200/50 transition-all duration-500">
                <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
                    {/* Logo (Desktop) */}
                    <div className="flex items-center gap-3">
                        <img src="/logo-velox.svg" alt="Velox" className="w-8 h-8" />
                        <h1 className="font-bold text-lg leading-tight text-[#0c81cf]">Velox Admin</h1>
                    </div>

                    {/* Mobile Menu Trigger */}
                    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="lg:hidden">
                                <Menu className="w-5 h-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-72 border-r-0">
                            <SidebarContent isMobile />
                        </SheetContent>
                    </Sheet>

                    <div className="flex-1" />

                    {/* Right Actions */}
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2 border-slate-200 bg-white hover:bg-slate-50 rounded-full pl-1 pr-4 py-1 h-9 shadow-sm hover:shadow transition-all duration-300">
                                    <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-[#0c81cf] to-[#0ea5e9] flex items-center justify-center text-white font-bold shadow-inner">
                                        <div className="h-4 w-4 rounded-full bg-white/20" />
                                    </div>
                                    <div className="flex flex-col items-start gap-0.5">
                                        <span className="text-xs font-semibold text-slate-700 leading-none">Super Admin</span>
                                        <span className="text-[10px] text-slate-400 leading-none">Online</span>
                                    </div>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-slate-200 shadow-xl">
                                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-slate-400 font-bold px-2 py-1.5">Cuenta</DropdownMenuLabel>
                                <DropdownMenuSeparator className="-mx-1 my-1 opacity-50" />
                                <DropdownMenuItem onClick={handleLogout} className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 rounded-lg cursor-pointer">
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
                <aside className={cn(
                    "hidden lg:block border-r border-slate-200/50 bg-white/50 backdrop-blur-sm transition-all duration-500 ease-in-out z-30",
                    sidebarCollapsed ? "w-20" : "w-72"
                )}>
                    <SidebarContent />
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950/50 relative">
                    <div className="container relative z-10 mx-auto p-4 sm:p-6 lg:p-8 max-w-[1600px]">
                        <AnimatePresence mode="wait">
                            <BlurFade key={location.pathname} delay={0.1}>
                                <Outlet />
                            </BlurFade>
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </div>
    )
}
