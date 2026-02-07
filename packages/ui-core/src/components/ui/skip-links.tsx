import React, { useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'

/**
 * Skip Links component for keyboard navigation accessibility
 */
export function SkipLinks() {
    const location = useLocation()
    const mainContentRef = useRef<HTMLAnchorElement>(null)
    const navigationRef = useRef<HTMLAnchorElement>(null)

    // Focus skip link when pathname changes
    useEffect(() => {
        if (mainContentRef.current) {
            mainContentRef.current.blur()
        }
    }, [location.pathname])

    const handleMainClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        const mainElement = document.getElementById('main-content') as HTMLElement
        if (mainElement) {
            mainElement.setAttribute('tabindex', '-1')
            mainElement.focus()
            const prefersReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
            mainElement.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start'
            })
            setTimeout(() => mainElement.removeAttribute('tabindex'), 1000)
        }
    }

    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        const navElement = document.getElementById('main-navigation') as HTMLElement
        if (navElement) {
            const firstButton = navElement.querySelector('button, a') as HTMLElement
            if (firstButton) {
                firstButton.focus()
                firstButton.scrollIntoView({ behavior: 'smooth', block: 'center' })
            } else {
                navElement.setAttribute('tabindex', '-1')
                navElement.focus()
                navElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }
    }

    return (
        <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:top-2 focus-within:left-2 focus-within:z-[60] focus-within:flex focus-within:gap-2">
            <a
                ref={mainContentRef}
                href="#main-content"
                onClick={handleMainClick}
                className={cn(
                    "inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-md",
                    "shadow-lg transition-all duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    "hover:bg-primary/90"
                )}
            >
                Saltar al contenido principal
            </a>
            <a
                ref={navigationRef}
                href="#main-navigation"
                onClick={handleNavClick}
                className={cn(
                    "inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-md",
                    "shadow-lg transition-all duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    "hover:bg-primary/90"
                )}
            >
                Saltar a navegación
            </a>
        </div>
    )
}
