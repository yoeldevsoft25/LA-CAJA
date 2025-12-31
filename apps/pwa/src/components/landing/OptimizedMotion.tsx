import { motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { ComponentProps, forwardRef } from 'react'

type OptimizedMotionDivProps = ComponentProps<typeof motion.div> & {
  enableOnMobile?: boolean
}

/**
 * Componente motion.div optimizado que reduce animaciones en mobile automáticamente
 *
 * @param enableOnMobile - Si es true, mantiene las animaciones en mobile (default: false)
 */
export const OptimizedMotionDiv = forwardRef<HTMLDivElement, OptimizedMotionDivProps>(
  ({ enableOnMobile = false, initial, animate, transition, whileInView, viewport, ...props }, ref) => {
    const { shouldReduceMotion } = useReducedMotion()

    // Si debemos reducir motion y no está habilitado forzosamente en mobile
    if (shouldReduceMotion && !enableOnMobile) {
      return (
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          {...props}
        />
      )
    }

    // Animaciones completas en desktop o si está habilitado en mobile
    return (
      <motion.div
        ref={ref}
        initial={initial}
        animate={animate}
        transition={transition}
        whileInView={whileInView}
        viewport={{ ...viewport, once: true, amount: shouldReduceMotion ? 0.1 : (viewport?.amount || 0.3) }}
        {...props}
      />
    )
  }
)

OptimizedMotionDiv.displayName = 'OptimizedMotionDiv'


type OptimizedMotionSectionProps = ComponentProps<typeof motion.section> & {
  reduceComplexity?: boolean
}

/**
 * Componente motion.section optimizado para secciones grandes
 */
export const OptimizedMotionSection = forwardRef<HTMLElement, OptimizedMotionSectionProps>(
  ({ reduceComplexity = true, children, whileInView, viewport, ...props }, ref) => {
    const { shouldReduceMotion } = useReducedMotion()

    // En mobile con complejidad reducida, solo fade in simple
    if (shouldReduceMotion && reduceComplexity) {
      return (
        <motion.section
          ref={ref}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.2 }}
          {...props}
        >
          {children}
        </motion.section>
      )
    }

    // Animaciones completas
    return (
      <motion.section
        ref={ref}
        whileInView={whileInView}
        viewport={{ ...viewport, once: true }}
        {...props}
      >
        {children}
      </motion.section>
    )
  }
)

OptimizedMotionSection.displayName = 'OptimizedMotionSection'
