import { useState, useEffect } from 'react'

/**
 * Hook para detectar la orientación del dispositivo (landscape/portrait)
 */
export function useOrientation() {
  const [isLandscape, setIsLandscape] = useState(false)

  useEffect(() => {
    const checkOrientation = () => {
      // Verificar por dimensiones (más confiable que window.orientation)
      const isLandscapeMode = window.innerWidth > window.innerHeight
      setIsLandscape(isLandscapeMode)
    }
    
    // Verificar inicialmente
    checkOrientation()
    
    // Escuchar cambios de tamaño de ventana
    window.addEventListener('resize', checkOrientation)
    
    // Escuchar cambios de orientación (para dispositivos móviles)
    const mediaQuery = window.matchMedia('(orientation: landscape)')
    const handleOrientationChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsLandscape(e.matches)
    }
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleOrientationChange)
    } else {
      // Fallback para navegadores antiguos
      mediaQuery.addListener(handleOrientationChange)
    }
    
    return () => {
      window.removeEventListener('resize', checkOrientation)
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleOrientationChange)
      } else {
        mediaQuery.removeListener(handleOrientationChange)
      }
    }
  }, [])

  return { isLandscape, isPortrait: !isLandscape }
}
