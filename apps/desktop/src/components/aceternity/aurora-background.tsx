import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface AuroraBackgroundProps {
  children?: ReactNode
  className?: string
  showRadialGradient?: boolean
}

/**
 * Aurora Background - Fondo animado con efecto aurora boreal sutil
 *
 * Inspirado en Aceternity UI, optimizado para performance.
 * Usa gradientes CSS animados en lugar de canvas para mejor rendimiento.
 *
 * @example
 * <AuroraBackground>
 *   <div className="relative z-10">Your content</div>
 * </AuroraBackground>
 */
export function AuroraBackground({
  children,
  className,
  showRadialGradient = true,
}: AuroraBackgroundProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col min-h-screen bg-white dark:bg-slate-950 overflow-hidden',
        className
      )}
    >
      {/* Aurora gradients layer */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary aurora blob */}
        <motion.div
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full opacity-30 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(13, 129, 206, 0.4) 0%, transparent 70%)',
          }}
          animate={{
            x: [0, 100, 50, 0],
            y: [0, 50, 100, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Secondary aurora blob */}
        <motion.div
          className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)',
          }}
          animate={{
            x: [0, -80, -40, 0],
            y: [0, -60, -100, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Tertiary subtle blob */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-1/3 h-1/3 rounded-full opacity-15 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(13, 129, 206, 0.3) 0%, transparent 70%)',
          }}
          animate={{
            x: ['-50%', '-30%', '-70%', '-50%'],
            y: ['-50%', '-70%', '-30%', '-50%'],
            scale: [1, 1.3, 0.8, 1],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Radial overlay for depth */}
      {showRadialGradient && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 20%, rgba(255, 255, 255, 0.8) 100%)',
          }}
        />
      )}

      {/* Content */}
      {children}
    </div>
  )
}

export default AuroraBackground
