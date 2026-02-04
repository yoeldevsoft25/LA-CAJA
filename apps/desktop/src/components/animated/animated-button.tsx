import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button-variants'
import { type VariantProps } from 'class-variance-authority'

interface AnimatedButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'>,
    VariantProps<typeof buttonVariants> {
  children: ReactNode
  className?: string
  shimmer?: boolean
  glow?: boolean
  loading?: boolean
  loadingText?: string
}

/**
 * AnimatedButton - Botón con micro-interacciones avanzadas
 *
 * Extiende las variantes del Button base añadiendo:
 * - Efectos de escala en hover/tap
 * - Shimmer effect opcional
 * - Glow effect opcional
 * - Estado de loading animado
 *
 * @example
 * <AnimatedButton variant="default" shimmer>
 *   Submit
 * </AnimatedButton>
 *
 * @example
 * <AnimatedButton variant="gradient" glow loading={isLoading}>
 *   {isLoading ? 'Processing...' : 'Pay Now'}
 * </AnimatedButton>
 */
export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  (
    {
      children,
      className,
      variant,
      size,
      shimmer = false,
      glow = false,
      loading = false,
      loadingText,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <motion.button
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          'relative overflow-hidden',
          glow && 'shadow-lg shadow-primary/30',
          className
        )}
        disabled={isDisabled}
        whileHover={!isDisabled ? { scale: 1.02 } : undefined}
        whileTap={!isDisabled ? { scale: 0.98 } : undefined}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        {...props}
      >
        {/* Shimmer effect */}
        {shimmer && !isDisabled && (
          <motion.span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 2,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Glow pulse effect */}
        {glow && !isDisabled && (
          <motion.span
            className="absolute inset-0 rounded-md"
            animate={{
              boxShadow: [
                '0 0 15px rgba(13, 129, 206, 0.3)',
                '0 0 30px rgba(13, 129, 206, 0.5)',
                '0 0 15px rgba(13, 129, 206, 0.3)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Content */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {loading && (
            <motion.span
              className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          )}
          {loading && loadingText ? loadingText : children}
        </span>
      </motion.button>
    )
  }
)

AnimatedButton.displayName = 'AnimatedButton'

/**
 * IconButton - Botón de icono con animación de rotación en hover
 */
interface IconButtonProps extends Omit<AnimatedButtonProps, 'children'> {
  icon: ReactNode
  rotateOnHover?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, rotateOnHover = false, className, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          className
        )}
        whileHover={rotateOnHover ? { rotate: 90, scale: 1.1 } : { scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        {...props}
      >
        {icon}
      </motion.button>
    )
  }
)

IconButton.displayName = 'IconButton'

export default AnimatedButton
