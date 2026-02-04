import { cn } from '@/lib/utils'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useCallback, useEffect, useRef } from 'react'

interface SpotlightProps {
  className?: string
  fill?: string
  size?: number
}

/**
 * Spotlight - Efecto de luz que sigue al cursor
 *
 * Inspirado en Aceternity UI. Crea un efecto de spotlight suave
 * que sigue el movimiento del mouse.
 *
 * @example
 * <div className="relative">
 *   <Spotlight />
 *   <div className="relative z-10">Your content</div>
 * </div>
 */
export function Spotlight({
  className,
  fill = 'rgba(13, 129, 206, 0.15)',
  size = 400,
}: SpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springConfig = { damping: 25, stiffness: 150 }
  const x = useSpring(mouseX, springConfig)
  const y = useSpring(mouseY, springConfig)

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      mouseX.set(e.clientX - rect.left)
      mouseY.set(e.clientY - rect.top)
    },
    [mouseX, mouseY]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('mousemove', handleMouseMove)
    return () => container.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  const spotlightX = useTransform(x, (val) => val - size / 2)
  const spotlightY = useTransform(y, (val) => val - size / 2)

  return (
    <div
      ref={containerRef}
      className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}
    >
      <motion.div
        className="absolute rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          width: size,
          height: size,
          x: spotlightX,
          y: spotlightY,
          background: `radial-gradient(circle, ${fill} 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
      />
    </div>
  )
}

/**
 * Spotlight Card - Card con efecto spotlight integrado
 */
interface SpotlightCardProps {
  children: React.ReactNode
  className?: string
  spotlightColor?: string
}

export function SpotlightCard({
  children,
  className,
  spotlightColor = 'rgba(13, 129, 206, 0.15)',
}: SpotlightCardProps) {
  return (
    <div className={cn('group relative', className)}>
      <Spotlight fill={spotlightColor} />
      {children}
    </div>
  )
}

export default Spotlight
