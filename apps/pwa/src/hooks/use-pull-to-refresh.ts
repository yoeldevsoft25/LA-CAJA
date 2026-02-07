import { useEffect, useRef, useState } from 'react'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void
  enabled?: boolean
  threshold?: number // Distancia en px que el usuario debe arrastrar
  resistance?: number // Factor de resistencia al arrastrar (0-1)
}

interface PullToRefreshState {
  isPulling: boolean
  isRefreshing: boolean
  pullDistance: number
}

/**
 * Hook para implementar pull-to-refresh en móviles
 * Detecta cuando el usuario arrastra hacia abajo desde la parte superior de la página
 */
export function usePullToRefresh({
  onRefresh,
  enabled = true,
  threshold = 80,
  resistance = 0.5,
}: UsePullToRefreshOptions) {
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    isRefreshing: false,
    pullDistance: 0,
  })

  const startY = useRef<number>(0)
  const currentY = useRef<number>(0)
  const isDragging = useRef<boolean>(false)
  const touchTarget = useRef<EventTarget | null>(null)
  const scrollContainer = useRef<HTMLElement | null>(null)
  const listenersActive = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const isScrollable = (el: Element) => {
      // 🚀 Optimización: Evitar getComputedStyle en el camino crítico de touch
      const element = el as HTMLElement
      if (element.scrollHeight <= element.clientHeight) return false

      const style = window.getComputedStyle(el)
      return style.overflowY === 'auto' || style.overflowY === 'scroll'
    }

    const hasScrollableParent = (start: Element | null, stop: Element | null) => {
      let current = start
      while (current && current !== stop && current !== document.body) {
        // Solo llamar a isScrollable si hay scroll real detectable
        if ((current as HTMLElement).scrollHeight > (current as HTMLElement).clientHeight) {
          if (isScrollable(current)) return current as HTMLElement
        }
        current = current.parentElement
      }
      return null
    }

    const addListeners = () => {
      if (listenersActive.current) return
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd, { passive: true })
      document.addEventListener('touchcancel', handleTouchCancel, { passive: true })
      listenersActive.current = true
    }

    const removeListeners = () => {
      if (!listenersActive.current) return
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchCancel)
      listenersActive.current = false
    }

    const handleTouchStart = (e: TouchEvent) => {
      // Solo activar si estamos en la parte superior de la página y no hay otros elementos bloqueando
      const target = e.target as Element | null
      const container = target?.closest('[data-pull-to-refresh]') as HTMLElement | null
      if (!container) return
      const innerScrollable = hasScrollableParent(target, container)
      if (innerScrollable) {
        // Si el gesto inicia dentro de un contenedor con scroll propio, no interceptar
        return
      }
      if (container.scrollTop !== 0) return

      const touch = e.touches[0]
      if (!touch) return

      startY.current = touch.clientY
      currentY.current = touch.clientY
      isDragging.current = false
      touchTarget.current = e.target
      scrollContainer.current = container
      addListeners()
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === 0 || !scrollContainer.current) return

      const touch = e.touches[0]
      if (!touch) return

      currentY.current = touch.clientY
      const deltaY = currentY.current - startY.current

      // Solo activar pull-to-refresh si el usuario arrastra hacia abajo desde la parte superior
      if (deltaY > 0 && scrollContainer.current.scrollTop === 0) {
        // Prevenir scroll normal mientras arrastramos
        if (deltaY > 10) {
          e.preventDefault()
          isDragging.current = true
        }

        // Calcular distancia con resistencia
        const distance = Math.min(deltaY * resistance, threshold * 2)

        setState((prev) => ({
          ...prev,
          isPulling: true,
          pullDistance: distance,
        }))
      } else if (deltaY < 0 || scrollContainer.current.scrollTop > 0) {
        // Si el usuario arrastra hacia arriba o la página ya tiene scroll, resetear
        reset()
      }
    }

    const handleTouchEnd = async (_e: TouchEvent) => {
      if (!isDragging.current) {
        reset()
        return
      }

      const deltaY = currentY.current - startY.current

      // Si el usuario arrastró lo suficiente, activar refresh
      if (deltaY >= threshold) {
        setState((prev) => ({
          ...prev,
          isPulling: false,
          isRefreshing: true,
          pullDistance: 0,
        }))

        try {
          await onRefresh()
        } catch (error) {
          console.error('[PullToRefresh] Error al refrescar:', error)
        } finally {
          setState({
            isPulling: false,
            isRefreshing: false,
            pullDistance: 0,
          })
        }
      } else {
        // Si no arrastró lo suficiente, resetear sin refrescar
        reset()
      }
    }

    const handleTouchCancel = () => {
      reset()
    }

    const reset = () => {
      startY.current = 0
      currentY.current = 0
      isDragging.current = false
      touchTarget.current = null
      scrollContainer.current = null
      removeListeners()
      setState({
        isPulling: false,
        isRefreshing: false,
        pullDistance: 0,
      })
    }

    // Agregar event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      removeListeners()
    }
  }, [enabled, onRefresh, threshold, resistance])

  return state
}
