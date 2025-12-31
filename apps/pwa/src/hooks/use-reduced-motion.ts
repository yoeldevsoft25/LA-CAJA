import { useState, useEffect } from 'react'

export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Check for user preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    // Check for mobile device
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const isMobileDevice =
        /android/i.test(userAgent) ||
        /iPad|iPhone|iPod/.test(userAgent) ||
        /Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile/.test(userAgent)
      const isSmallScreen = window.innerWidth < 768
      setIsMobile(isMobileDevice || isSmallScreen)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  return {
    prefersReducedMotion,
    isMobile,
    shouldReduceMotion: prefersReducedMotion || isMobile,
  }
}

// Helper to get simplified animation props for mobile
export function getAnimationProps(shouldReduce: boolean, normalProps: any, reducedProps: any = {}) {
  if (shouldReduce) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.2 },
      ...reducedProps,
    }
  }
  return normalProps
}
