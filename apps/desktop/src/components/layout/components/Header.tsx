import { memo, lazy, Suspense } from 'react'
import { Menu, Search, Command } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ModeToggle } from '@/components/mode-toggle'
import { SyncStatusBadge } from '@/components/sync/SyncStatusBadge'
import ExchangeRateIndicator from '@/components/exchange/ExchangeRateIndicator'
import { SidebarContent } from '../sidebar/SidebarContent'
import { LicenseBanner } from './LicenseBanner'
import { UserMenu } from './UserMenu'
import type { LicenseState } from '../hooks/useLicenseAlerts'
import type { NavSection } from '../constants/navigation'

// ✅ Lazy load — el dropdown solo se monta cuando el usuario interactúa
const NotificationsMenu = lazy(() =>
    import('./NotificationsMenu').then(m => ({ default: m.NotificationsMenu }))
)

interface HeaderProps {
    // Navigation
    pageTitle: string
    filteredNavSections: NavSection[]
    isActive: (path: string) => boolean
    openSections: string[]
    setOpenSections: React.Dispatch<React.SetStateAction<string[]>>
    handleNavClick: (path: string) => void
    // Sidebar
    sidebarCollapsed: boolean
    setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>
    mobileOpen: boolean
    setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>
    // User
    fullName: string | null | undefined
    role: string | undefined
    onLogout: () => void
    // Notifications
    notifications: any[]
    unreadCount: number
    markAsRead: (id: string) => void
    markAllAsRead: () => void
    // License
    license: LicenseState
}

export const Header = memo(function Header({
    pageTitle,
    filteredNavSections,
    isActive,
    openSections,
    setOpenSections,
    handleNavClick,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileOpen,
    setMobileOpen,
    fullName,
    role,
    onLogout,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    license,
}: HeaderProps) {
    return (
        <header
            className="sticky top-0 z-40 border-b app-shell-header
                 transition-[background-color,border-color] duration-300
                 relative"
        >
            <div className="flex h-14 items-center gap-2 sm:gap-3 px-3 sm:px-4">
                {/* Logo (Desktop) — Compacto y elegante */}
                <div className="hidden lg:flex items-center gap-2.5 mr-1">
                    <div className="rounded-lg bg-card/70 ring-1 ring-border/70 p-0.5">
                        <img
                            src="/logo-velox.svg"
                            alt="Velox POS Logo"
                            className="w-8 h-8 rounded-md"
                            width={32}
                            height={32}
                            loading="eager"
                        />
                    </div>
                    <span className="text-sm font-semibold tracking-[0.08em] uppercase text-foreground/90">
                        Velox
                    </span>
                </div>

                {/* Mobile Menu */}
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden shrink-0 h-9 w-9"
                            aria-label="Abrir menú de navegación"
                            aria-expanded={mobileOpen}
                        >
                            <Menu className="w-5 h-5" aria-hidden="true" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="left"
                        className="p-0 w-72 flex flex-col max-h-screen overflow-hidden app-shell-sidebar text-sidebar-foreground border-r"
                        hideClose
                    >
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
                    <h1 className="text-sm sm:text-base font-semibold truncate">
                        {pageTitle}
                    </h1>
                </div>

                {/* Search Trigger (Desktop) — Abre Command Menu con Ctrl+K */}
                <button
                    type="button"
                    onClick={() => {
                        // Trigger shortcuts listeners on macOS (Meta+K) and Windows/Linux (Ctrl+K).
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, ctrlKey: true, bubbles: true }))
                    }}
                    className="hidden lg:flex items-center gap-2 h-9 px-3 rounded-lg
                               border border-border/50 bg-muted/30 hover:bg-muted/50
                               text-muted-foreground hover:text-foreground
                               transition-all duration-200 text-sm min-w-[200px] group"
                    aria-label="Abrir búsqueda rápida"
                >
                    <Search className="w-3.5 h-3.5 shrink-0 opacity-50 group-hover:opacity-70" />
                    <span className="flex-1 text-left text-xs">Buscar...</span>
                    <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5
                                    rounded border border-border/60 bg-background/80
                                    text-[10px] font-mono text-muted-foreground/60">
                        <Command className="w-2.5 h-2.5" />K
                    </kbd>
                </button>

                {/* Spacer (Desktop) */}
                <div className="hidden lg:flex flex-1" />

                {/* Right Actions — Más compactos */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* Online indicator (mobile only) */}
                    <span
                        className="sm:hidden inline-flex h-2 w-2 rounded-full bg-[hsl(var(--success))] animate-pulse
                       shadow-[0_0_0_3px_hsl(var(--success)_/_0.18)]"
                        aria-hidden="true"
                    />

                    <div className="hidden sm:flex">
                        <SyncStatusBadge />
                    </div>

                    <ExchangeRateIndicator className="hidden sm:flex" />
                    <ExchangeRateIndicator compact className="sm:hidden" />

                    <ModeToggle />

                    {/* Notifications (Desktop) */}
                    <div className="hidden sm:block">
                        <Suspense fallback={null}>
                            <NotificationsMenu
                                notifications={notifications}
                                unreadCount={unreadCount}
                                markAsRead={markAsRead}
                                markAllAsRead={markAllAsRead}
                            />
                        </Suspense>
                    </div>

                    <Separator orientation="vertical" className="h-5 mx-0.5 hidden sm:block opacity-30" />

                    {/* User Menu */}
                    <UserMenu
                        fullName={fullName}
                        role={role}
                        onLogout={onLogout}
                        notifications={notifications}
                        unreadCount={unreadCount}
                        markAsRead={markAsRead}
                        markAllAsRead={markAllAsRead}
                    />
                </div>
            </div>

            <LicenseBanner license={license} />
        </header>
    )
})
