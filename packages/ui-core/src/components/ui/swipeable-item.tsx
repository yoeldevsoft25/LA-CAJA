import React, { useEffect, useRef, useState } from 'react'
import { motion, PanInfo, useMotionValue, useTransform, animate, useDragControls } from 'framer-motion'
import { cn } from '../../lib/utils'
import { useReducedMotion } from '../../hooks/use-reduced-motion'

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
    const x = useMotionValue(0)
    const { shouldReduceMotion } = useReducedMotion()
    const dragControls = useDragControls()
    const startPoint = useRef<{ x: number; y: number } | null>(null)
    const hasDirectionLock = useRef(false)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const actionTriggeredRef = useRef(false)

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
        actionTriggeredRef.current = false
        setIsDragging(true)
    }

    const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (!enabled) {
            animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.2 })
            return
        }

        const offset = info.offset.x
        const velocity = info.velocity.x

        const shouldTriggerLeft = onSwipeLeft && (offset > threshold || velocity > 500)
        const shouldTriggerRight = onSwipeRight && (offset < -threshold || velocity < -500)

        if (shouldTriggerLeft) {
            actionTriggeredRef.current = true
            animate(x, threshold * 2, {
                duration: shouldReduceMotion ? 0 : 0.2,
                onComplete: () => {
                    onSwipeLeft?.()
                    setTimeout(() => {
                        animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.3 })
                        actionTriggeredRef.current = false
                    }, 100)
                },
            })
        } else if (shouldTriggerRight) {
            actionTriggeredRef.current = true
            animate(x, -threshold * 2, {
                duration: shouldReduceMotion ? 0 : 0.2,
                onComplete: () => {
                    onSwipeRight?.()
                    setTimeout(() => {
                        animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.3 })
                        actionTriggeredRef.current = false
                    }, 100)
                },
            })
        } else {
            animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.3 })
        }

        setIsDragging(false)
    }

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
        if (!enabled) return
        const currentX = Math.abs(x.get())
        if (!actionTriggeredRef.current && currentX > 1 && currentX < threshold) {
            animate(x, 0, { duration: shouldReduceMotion ? 0 : 0.2 })
        }
    }

    return (
        <div ref={containerRef} className={cn('relative overflow-hidden overscroll-auto', className)}>
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

            <motion.div
                drag={enabled && !requireHandle ? 'x' : false}
                dragControls={!requireHandle ? dragControls : undefined}
                dragListener={!requireHandle ? false : undefined}
                dragConstraints={{ left: -threshold * 2, right: threshold * 2 }}
                dragElastic={0.2}
                onDragStart={!requireHandle ? handleDragStart : undefined}
                onDragEnd={!requireHandle ? handleDragEnd : undefined}
                style={{ x: contentX, touchAction: 'pan-y', willChange: 'transform' }}
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
