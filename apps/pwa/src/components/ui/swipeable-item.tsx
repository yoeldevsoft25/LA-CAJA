import React, { useState, useEffect } from 'react'
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
  className,
}: SwipeableItemProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [_swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const x = useMotionValue(0)
  const { shouldReduceMotion } = useReducedMotion()
  const dragControls = useDragControls()
  const startPoint = React.useRef<{ x: number; y: number } | null>(null)
  const hasDirectionLock = React.useRef(false)

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

  return (
    <div className={cn('relative overflow-hidden', className)}>
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
        drag={enabled ? 'x' : false}
        dragControls={dragControls}
        dragListener={false}
        dragDirectionLock
        dragConstraints={{ left: -threshold * 2, right: threshold * 2 }}
        dragElastic={0.2}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x: contentX }}
        className={cn(
          'relative bg-background touch-pan-y',
          isDragging && 'cursor-grabbing',
          !enabled && 'cursor-default'
        )}
        whileTap={enabled && !shouldReduceMotion ? { scale: 0.98 } : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {children}
      </motion.div>
    </div>
  )
}
