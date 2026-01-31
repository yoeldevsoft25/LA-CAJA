import React, { useEffect, useRef, useState } from 'react'
import { motion, PanInfo, useMotionValue, useTransform, animate, useDragControls } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/hooks/use-reduced-motion'

interface SwipeableItemProps {
  children: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  leftAction?: React.ReactNode
  rightAction?: React.ReactNode
  threshold?: number
  enabled?: boolean
  requireHandle?: boolean
  className?: string
}

/**
 * Componente para items con gestos swipe
 * Permite deslizar hacia izquierda o derecha para ejecutar acciones
 */
export function SwipeableItem({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  threshold = 100,
  enabled = true,
  requireHandle = false,
  className,
}: SwipeableItemProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [_swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const x = useMotionValue(0)
  const { shouldReduceMotion } = useReducedMotion()
  const dragControls = useDragControls()
  const startPoint = useRef<{ x: number; y: number } | null>(null)
  const hasDirectionLock = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const manualDragState = useRef<{
    pointerId: number | null
    startX: number
    startY: number
    isDragging: boolean
  }>({ pointerId: null, startX: 0, startY: 0, isDragging: false })

  // Transformaciones para el contenido y las acciones
  const contentX = useTransform(x, (value) => {
    if (!enabled) return 0
    return Math.max(Math.min(value, threshold * 2), -threshold * 2)
  })

  const leftActionOpacity = useTransform(x, (value) => {
    if (!onSwipeLeft || !leftAction) return 0
    return Math.max(0, Math.min(1, value / threshold))
  })

  const rightActionOpacity = useTransform(x, (value) => {
    if (!onSwipeRight || !rightAction) return 0
    return Math.max(0, Math.min(1, -value / threshold))
  })

  const handleDragStart = () => {
    if (!enabled) return
    setIsDragging(true)
  }

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!enabled) return

    // Determinar dirección del swipe
    if (info.offset.x > 20) {
      setSwipeDirection('right')
    } else if (info.offset.x < -20) {
      setSwipeDirection('left')
    }
  }

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!enabled) {
      animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.2 })
      return
    }

    const offset = info.offset.x
    const velocity = info.velocity.x

    // Determinar si el swipe fue suficiente para activar la acción
    const shouldTriggerLeft = onSwipeLeft && (offset > threshold || velocity > 500)
    const shouldTriggerRight = onSwipeRight && (offset < -threshold || velocity < -500)

    if (shouldTriggerLeft) {
      // Animar hacia la derecha y ejecutar acción
      animate(x, threshold * 2, {
        duration: shouldReduceMotion ? 0 : 0.2,
        onComplete: () => {
          onSwipeLeft?.()
          setTimeout(() => {
            animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.3 })
          }, 100)
        },
      })
    } else if (shouldTriggerRight) {
      // Animar hacia la izquierda y ejecutar acción
      animate(x, -threshold * 2, {
        duration: shouldReduceMotion ? 0 : 0.2,
        onComplete: () => {
          onSwipeRight?.()
          setTimeout(() => {
            animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.3 })
          }, 100)
        },
      })
    } else {
      // Volver a la posición inicial
      animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.3 })
    }

    setIsDragging(false)
    setSwipeDirection(null)
  }

  // Resetear cuando se deshabilita
  useEffect(() => {
    if (!enabled) {
      animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.2 })
    }
  }, [enabled, x, shouldReduceMotion])

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!enabled) return
    if (requireHandle) {
      const target = event.target as Element | null
      if (!target?.closest('[data-swipe-handle]')) {
        return
      }
    }
    startPoint.current = { x: event.clientX, y: event.clientY }
    hasDirectionLock.current = false
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!enabled || !startPoint.current || hasDirectionLock.current) return
    const dx = event.clientX - startPoint.current.x
    const dy = event.clientY - startPoint.current.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)

    // Solo iniciar swipe si el gesto es claramente horizontal
    if (absX > 8 && absX > absY + 4) {
      hasDirectionLock.current = true
      dragControls.start(event)
    } else if (absY > 8 && absY > absX + 4) {
      hasDirectionLock.current = true
    }
  }

  const handlePointerUp = () => {
    startPoint.current = null
    hasDirectionLock.current = false
  }

  useEffect(() => {
    if (!requireHandle) return
    const root = containerRef.current
    if (!root) return

    const handle = root.querySelector('[data-swipe-handle]') as HTMLElement | null
    if (!handle) return

    const onPointerDown = (event: PointerEvent) => {
      if (!enabled) return
      manualDragState.current.pointerId = event.pointerId
      manualDragState.current.startX = event.clientX
      manualDragState.current.startY = event.clientY
      manualDragState.current.isDragging = false
      handle.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!enabled) return
      if (manualDragState.current.pointerId !== event.pointerId) return

      const dx = event.clientX - manualDragState.current.startX
      const dy = event.clientY - manualDragState.current.startY
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)

      if (!manualDragState.current.isDragging) {
        if (absX > 8 && absX > absY + 4) {
          manualDragState.current.isDragging = true
        } else if (absY > 8 && absY > absX + 4) {
          handle.releasePointerCapture(event.pointerId)
          manualDragState.current.pointerId = null
          return
        } else {
          return
        }
      }

      event.preventDefault()
      const clamped = Math.max(Math.min(dx, threshold * 2), -threshold * 2)
      x.set(clamped)
    }

    const onPointerUp = (event: PointerEvent) => {
      if (!enabled) return
      if (manualDragState.current.pointerId !== event.pointerId) return

      const dx = event.clientX - manualDragState.current.startX
      const velocity = 0
      const shouldTriggerLeft = onSwipeLeft && (dx > threshold || velocity > 500)
      const shouldTriggerRight = onSwipeRight && (dx < -threshold || velocity < -500)

      if (shouldTriggerLeft) {
        animate(x, threshold * 2, {
          duration: shouldReduceMotion ? 0 : 0.2,
          onComplete: () => {
            onSwipeLeft?.()
            setTimeout(() => {
              animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.3 })
            }, 100)
          },
        })
      } else if (shouldTriggerRight) {
        animate(x, -threshold * 2, {
          duration: shouldReduceMotion ? 0 : 0.2,
          onComplete: () => {
            onSwipeRight?.()
            setTimeout(() => {
              animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.3 })
            }, 100)
          },
        })
      } else {
        animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.3 })
      }

      manualDragState.current.pointerId = null
      manualDragState.current.isDragging = false
    }

    const onPointerCancel = (event: PointerEvent) => {
      if (manualDragState.current.pointerId !== event.pointerId) return
      manualDragState.current.pointerId = null
      manualDragState.current.isDragging = false
      animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.2 })
    }

    handle.addEventListener('pointerdown', onPointerDown)
    handle.addEventListener('pointermove', onPointerMove, { passive: false })
    handle.addEventListener('pointerup', onPointerUp)
    handle.addEventListener('pointercancel', onPointerCancel)

    return () => {
      handle.removeEventListener('pointerdown', onPointerDown)
      handle.removeEventListener('pointermove', onPointerMove)
      handle.removeEventListener('pointerup', onPointerUp)
      handle.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [enabled, onSwipeLeft, onSwipeRight, requireHandle, shouldReduceMotion, threshold, x])

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      {/* Acciones de fondo */}
      {(leftAction || rightAction) && (
        <div className="absolute inset-0 flex">
          {leftAction && (
            <motion.div
              className="flex items-center justify-start bg-destructive text-destructive-foreground px-4"
              style={{ opacity: leftActionOpacity, width: '100%' }}
            >
              <div className="flex items-center gap-2">{leftAction}</div>
            </motion.div>
          )}
          {rightAction && (
            <motion.div
              className="flex items-center justify-end bg-primary text-primary-foreground px-4 ml-auto"
              style={{ opacity: rightActionOpacity, width: '100%' }}
            >
              <div className="flex items-center gap-2">{rightAction}</div>
            </motion.div>
          )}
        </div>
      )}

      {/* Contenido principal */}
      <motion.div
        drag={enabled && !requireHandle ? 'x' : false}
        dragControls={!requireHandle ? dragControls : undefined}
        dragListener={!requireHandle ? false : undefined}
        dragDirectionLock={!requireHandle}
        dragConstraints={{ left: -threshold * 2, right: threshold * 2 }}
        dragElastic={0.2}
        onDragStart={!requireHandle ? handleDragStart : undefined}
        onDrag={!requireHandle ? handleDrag : undefined}
        onDragEnd={!requireHandle ? handleDragEnd : undefined}
        style={{ x: contentX, touchAction: 'pan-y' }}
        className={cn(
          'relative bg-background touch-pan-y',
          isDragging && 'cursor-grabbing',
          !enabled && 'cursor-default'
        )}
        whileTap={enabled && !shouldReduceMotion ? { scale: 0.98 } : undefined}
        onPointerDown={!requireHandle ? handlePointerDown : undefined}
        onPointerMove={!requireHandle ? handlePointerMove : undefined}
        onPointerUp={!requireHandle ? handlePointerUp : undefined}
        onPointerCancel={!requireHandle ? handlePointerUp : undefined}
      >
        {children}
      </motion.div>
    </div>
  )
}
