import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/stores/auth.store'
import { useQueryClient } from '@tanstack/react-query'
import { isRouteAllowed, type Role } from '@/lib/permissions'
import { licenseService } from '@/services/license.service'
import { prefetchPageData } from '@/services/prefetch.service'
import { NAV_SECTIONS, PATH_TO_PAGE_MAP, ALL_NAV_PATHS } from '../constants/navigation'
import type { NavSection } from '../constants/navigation'

export function useNavigationState() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const queryClient = useQueryClient()

    const userRole = (user?.role || 'cashier') as Role

    const localLicense = useMemo(() => licenseService.getLocalStatus(), [])

    const userFeatures = useMemo(() => {
        if (user?.license_features && user.license_features.length > 0) {
            return user.license_features
        }
        return localLicense?.features || []
    }, [user?.license_features, localLicense?.features])

    // ✅ Solo recalcular cuando cambian role/features
    const filteredNavSections = useMemo<NavSection[]>(() => {
        return NAV_SECTIONS
            .map(section => {
                const filtered = section.items.filter(
                    item => isRouteAllowed(item.path, userRole, userFeatures)
                )
                if (filtered.length === section.items.length) {
                    return section // Reutilizar referencia si no cambió
                }
                return { ...section, items: filtered }
            })
            .filter(section => section.items.length > 0)
    }, [userRole, userFeatures])

    // ✅ isActive estabilizado — no depende de filteredNavSections como array
    const isActive = useCallback((path: string) => {
        const currentPath = location.pathname

        if (currentPath === path) return true

        if (currentPath.startsWith(path + '/')) {
            // Verificar que no haya ruta más específica
            const hasMoreSpecific = ALL_NAV_PATHS.some(
                p => p !== path &&
                    currentPath.startsWith(p + '/') &&
                    p.startsWith(path + '/')
            )
            return !hasMoreSpecific
        }

        return false
    }, [location.pathname])

    // Sección activa
    const activeSectionId = useMemo(() => {
        for (const section of filteredNavSections) {
            if (section.items.some(item => isActive(item.path))) {
                return section.id
            }
        }
        return undefined
    }, [filteredNavSections, isActive])

    // Secciones abiertas del accordion
    const [openSections, setOpenSections] = useState<string[]>([])

    useEffect(() => {
        if (activeSectionId) {
            setOpenSections(prev => {
                if (prev.length === 1 && prev[0] === activeSectionId) return prev // ✅ Evitar re-render
                return [activeSectionId]
            })
        }
    }, [activeSectionId])

    // Mobile menu
    const [mobileOpen, setMobileOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    // Navigation handler
    const handleNavClick = useCallback((path: string) => {
        navigate(path)
        setMobileOpen(false)
    }, [navigate])

    // Título de la página actual
    const pageTitle = useMemo(() => {
        const activeItem = filteredNavSections
            .flatMap(s => s.items)
            .find(item => isActive(item.path))
        if (activeItem?.label === 'Punto de Venta') return 'POS'
        return activeItem?.label || 'Velox POS'
    }, [filteredNavSections, isActive])

    // Es ruta POS
    const isPosRoute = location.pathname.includes('/pos')

    // ✅ Prefetch inteligente — debounced y solo para rutas válidas
    useEffect(() => {
        if (!user?.store_id) return
        if (!isRouteAllowed(location.pathname, userRole, userFeatures)) return

        const page = PATH_TO_PAGE_MAP[location.pathname]
        if (!page) return

        // Usar requestIdleCallback para no bloquear
        const id = typeof requestIdleCallback !== 'undefined'
            ? requestIdleCallback(() => {
                prefetchPageData(
                    page as any,
                    user.store_id!,
                    queryClient,
                    userRole
                ).catch(() => { })
            })
            : setTimeout(() => {
                prefetchPageData(
                    page as any,
                    user.store_id!,
                    queryClient,
                    userRole
                ).catch(() => { })
            }, 100)

        return () => {
            if (typeof cancelIdleCallback !== 'undefined') {
                cancelIdleCallback(id as number)
            } else {
                clearTimeout(id)
            }
        }
    }, [location.pathname, user?.store_id, userRole, queryClient, userFeatures])

    return {
        user,
        userRole,
        userFeatures,
        filteredNavSections,
        isActive,
        activeSectionId,
        openSections,
        setOpenSections,
        mobileOpen,
        setMobileOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
        handleNavClick,
        pageTitle,
        isPosRoute,
        location,
    }
}
