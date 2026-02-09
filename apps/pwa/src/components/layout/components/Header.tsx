import { memo, lazy, Suspense } from 'react'
import { Menu } from 'lucide-react'
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
            className="sticky top-0 z-40 border-b border-border/40 shadow-sm
                 bg-background/80 backdrop-blur-xl
                 transition-[background-color] duration-300
                 will-change-[backdrop-filter]"
        >
            <div className="flex h-16 items-center gap-2 sm:gap-4 px-3 sm:px-6">
                {/* Logo (Desktop) */}
                <div className="hidden lg:flex items-center gap-3">
                    <img
                        src="/logo-velox.svg"
                        alt="Velox POS Logo"
                        className="w-10 h-10 rounded-lg"
                        width={40}
                        height={40}
                        loading="eager"
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
                            className="lg:hidden shrink-0"
                            aria-label="Abrir menú de navegación"
                            aria-expanded={mobileOpen}
                        >
                            <Menu className="w-5 h-5" aria-hidden="true" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="left"
                        className="p-0 w-72 flex flex-col max-h-screen overflow-hidden"
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
                    <h1 className="text-base sm:text-lg font-semibold truncate">
                        {pageTitle}
                    </h1>
                </div>

                {/* Spacer (Desktop) */}
                <div className="hidden lg:flex flex-1" />

                {/* Right Actions */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {/* Online indicator (mobile) */}
                    <span
                        className="sm:hidden inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse
                       shadow-[0_0_0_4px_rgba(16,185,129,0.18)]"
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

                    <Separator orientation="vertical" className="h-6 hidden sm:block" />

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
