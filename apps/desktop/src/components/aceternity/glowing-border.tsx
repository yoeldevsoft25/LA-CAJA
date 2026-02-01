import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface GlowingBorderProps {
  children: ReactNode
  className?: string
  containerClassName?: string
  borderRadius?: string
  glowColor?: string
  duration?: number
}

/**
 * Glowing Border - Borde con efecto de brillo animado
 *
 * Inspirado en Aceternity UI border-beam.
 * Crea un efecto de luz que recorre el borde del contenedor.
 *
 * @example
 * <GlowingBorder>
 *   <Card>Your content</Card>
 * </GlowingBorder>
 */
export function GlowingBorder({
  children,
  className,
  containerClassName,
  borderRadius = '0.75rem',
  glowColor = 'rgb(13, 129, 206)',
  duration = 4,
}: GlowingBorderProps) {
  return (
    <div
      className={cn('relative group', containerClassName)}
      style={{ borderRadius }}
    >
      {/* Animated border glow */}
      <motion.div
        className="absolute -inset-[1px] opacity-75 blur-sm"
        style={{
          borderRadius,
          background: `conic-gradient(from 0deg, transparent 0deg, ${glowColor} 90deg, transparent 180deg)`,
        }}
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Solid border fallback */}
      <div
        className="absolute -inset-[1px] rounded-xl opacity-20"
        style={{
          borderRadius,
          background: glowColor,
        }}
      />

      {/* Content container */}
      <div
        className={cn('relative bg-background', className)}
        style={{ borderRadius }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Shimmer Button - Botón con efecto shimmer
 */
interface ShimmerButtonProps {
  children: ReactNode
  className?: string
  shimmerColor?: string
  backgroundColor?: string
}

export function ShimmerButton({
  children,
  className,
  shimmerColor = 'rgba(255, 255, 255, 0.2)',
  backgroundColor = 'rgb(13, 129, 206)',
}: ShimmerButtonProps) {
  return (
    <motion.button
      className={cn(
        'relative overflow-hidden px-6 py-3 font-semibold text-white rounded-lg',
        className
      )}
      style={{ backgroundColor }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, transparent, ${shimmerColor}, transparent)`,
        }}
        animate={{
          x: ['-100%', '200%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          repeatDelay: 1,
          ease: 'easeInOut',
        }}
      />
      <span className="relative z-10">{children}</span>
    </motion.button>
  )
}

export default GlowingBorder
