import { useState, useEffect } from 'react'

/**
 * Hook para optimizar queries en mobile
 * Retorna un delay que se puede usar para diferir la carga de datos pesados
 */
export function useMobileOptimizedQuery(isOpen: boolean) {
  const [shouldLoad, setShouldLoad] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // En mobile, delay pequeño para mejorar percepción de rendimiento
      // El modal se abre primero, luego carga los datos
      const delay = isMobile ? 150 : 0
      const timer = setTimeout(() => setShouldLoad(true), delay)
      return () => clearTimeout(timer)
    } else {
      setShouldLoad(false)
    }
  }, [isOpen, isMobile])

  return { shouldLoad, isMobile }
}
