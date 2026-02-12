import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/stores/auth.store'
import { cn } from '@/lib/utils'

// ✅ Hooks extraídos — cada uno se re-renderiza de forma aislada
import { useConnectivity } from './hooks/useConnectivity'
import { useNavigationState } from './hooks/useNavigationState'
import { useLicenseAlerts } from './hooks/useLicenseAlerts'
import { useSystemAlerts } from './hooks/useSystemAlerts'
import { useNotificationsSync } from '@/hooks/useNotificationsSync'
import { useKeyboardShortcutsHelp } from '@/components/ui/keyboard-shortcuts-help'

// ✅ Componentes memorizados — solo re-renderizan si sus props cambian
import { Header } from './components/Header'
import { MainContent } from './components/MainContent'
import { SidebarContent } from './sidebar/SidebarContent'

// ✅ Componentes ligeros sin estado
import { SkipLinks } from '@/components/ui/skip-links'
import { CommandMenu } from './CommandMenu'
import { QuotaBanner } from '@/components/license/QuotaTracker'
import { UpgradeModal } from '@/components/license/UpgradeModal'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import { KeyboardShortcutsHelp } from '@/components/ui/keyboard-shortcuts-help'

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // =============================================
  // HOOKS — Cada uno aislado en su responsabilidad
  // =============================================
  useConnectivity()          // Solo toasts, no retorna estado al render
  useSystemAlerts()          // Stock bajo + caja abierta
  const license = useLicenseAlerts() // Alertas de licencia

  const {
    filteredNavSections,
    isActive,
    openSections,
    setOpenSections,
    mobileOpen,
    setMobileOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    handleNavClick,
    pageTitle,
    isPosRoute,
  } = useNavigationState()

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotificationsSync()

  const {
    isOpen: isShortcutsHelpOpen,
    setIsOpen: setShortcutsHelpOpen,
  } = useKeyboardShortcutsHelp()

  // =============================================
  // UPGRADE MODAL — Estado local mínimo
  // =============================================
  const [upgradeState, setUpgradeState] = useState({
    isOpen: false,
    featureName: '',
  })

  const openUpgradeModal = useCallback((feature?: string) => {
    setUpgradeState({ isOpen: true, featureName: feature || '' })
  }, [])

  const closeUpgradeModal = useCallback(() => {
    setUpgradeState(prev => ({ ...prev, isOpen: false }))
  }, [])

  const handleLogout = useCallback(() => {
    logout()
    navigate('/login')
  }, [logout, navigate])

  // =============================================
  // RENDER — Estructura plana y limpia
  // =============================================
  return (
    <div
      className={cn('min-h-screen app-shell text-foreground')}
    >
      {/* Accessibility */}
      <SkipLinks />

      {/* License quota banner */}
      <QuotaBanner onUpgrade={openUpgradeModal} />

      {/* Global command palette (Ctrl+K) */}
      <CommandMenu />

      {/* Header con navegación mobile integrada */}
      <Header
        pageTitle={pageTitle}
        filteredNavSections={filteredNavSections}
        isActive={isActive}
        openSections={openSections}
        setOpenSections={setOpenSections}
        handleNavClick={handleNavClick}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        fullName={user?.full_name}
        role={user?.role}
        onLogout={handleLogout}
        notifications={notifications}
        unreadCount={unreadCount}
        markAsRead={markAsRead}
        markAllAsRead={markAllAsRead}
        license={license}
      />

      {/* Layout: Sidebar + Content */}
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Desktop Sidebar */}
        <aside
          id="main-navigation"
          className={cn(
            'hidden lg:flex flex-col border-r app-shell-sidebar h-full relative',
            'transition-[width] duration-300 will-change-[width]',
            sidebarCollapsed ? 'w-20' : 'w-64'
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

        {/* Main Content — memo'd, solo re-renders si isPosRoute cambia */}
        <MainContent isPosRoute={isPosRoute} />
      </div>

      {/* Modals & Overlays (portales — fuera del flujo de layout) */}
      <InstallPrompt />

      <KeyboardShortcutsHelp
        isOpen={isShortcutsHelpOpen}
        onOpenChange={setShortcutsHelpOpen}
      />

      <UpgradeModal
        isOpen={upgradeState.isOpen}
        onClose={closeUpgradeModal}
        featureName={upgradeState.featureName}
      />
    </div>
  )
}
