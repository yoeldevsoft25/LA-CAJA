import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { transitions } from '@/design-system'

interface AnimatedCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode
  className?: string
  hoverScale?: number
  hoverShadow?: boolean
  tapScale?: number
  glassEffect?: boolean
  delay?: number
}

/**
 * AnimatedCard - Card con micro-interacciones
 *
 * Incluye efectos de hover/tap y opcionalmente glassmorphism.
 * Ideal para cards de productos, usuarios, métricas, etc.
 *
 * @example
 * <AnimatedCard hoverScale={1.02} hoverShadow>
 *   <CardContent>...</CardContent>
 * </AnimatedCard>
 *
 * @example
 * <AnimatedCard glassEffect>
 *   <div className="p-6">Glass card content</div>
 * </AnimatedCard>
 */
export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  (
    {
      children,
      className,
      hoverScale = 1.02,
      hoverShadow = true,
      tapScale = 0.98,
      glassEffect = false,
      delay = 0,
      ...props
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-xl border transition-colors',
          glassEffect
            ? 'bg-white/80 backdrop-blur-xl border-white/20 shadow-lg'
            : 'bg-card border-border',
          className
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.default, delay }}
        whileHover={{
          scale: hoverScale,
          boxShadow: hoverShadow
            ? '0 20px 25px -5px rgba(13, 129, 206, 0.1), 0 8px 10px -6px rgba(13, 129, 206, 0.1)'
            : undefined,
        }}
        whileTap={{ scale: tapScale }}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)

AnimatedCard.displayName = 'AnimatedCard'

/**
 * GlassCard - Card con efecto glassmorphism predefinido
 */
interface GlassCardProps extends Omit<AnimatedCardProps, 'glassEffect'> {
  blur?: 'sm' | 'md' | 'lg' | 'xl'
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ blur = 'xl', className, ...props }, ref) => {
    const blurClasses = {
      sm: 'backdrop-blur-sm',
      md: 'backdrop-blur-md',
      lg: 'backdrop-blur-lg',
      xl: 'backdrop-blur-xl',
    }

    return (
      <AnimatedCard
        ref={ref}
        className={cn(
          'bg-white/80 border-white/30 shadow-xl',
          blurClasses[blur],
          className
        )}
        glassEffect
        {...props}
      />
    )
  }
)

GlassCard.displayName = 'GlassCard'

export default AnimatedCard
