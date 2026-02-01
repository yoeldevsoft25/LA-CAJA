import { motion, AnimatePresence, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

type TransitionType = 'fade' | 'slideUp' | 'slideLeft' | 'scale' | 'none'

interface PageTransitionProps {
  children: ReactNode
  className?: string
  type?: TransitionType
  duration?: number
}

const transitionVariants: Record<TransitionType, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -10 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
}

/**
 * PageTransition - Wrapper para transiciones de página
 *
 * Usa AnimatePresence para transiciones suaves entre rutas.
 * Diseñado para usarse con React Router.
 *
 * @example
 * // En tu router
 * <PageTransition type="slideUp">
 *   <Routes>
 *     <Route path="/" element={<Home />} />
 *     <Route path="/about" element={<About />} />
 *   </Routes>
 * </PageTransition>
 *
 * @example
 * // Como wrapper de página individual
 * <PageTransition type="fade">
 *   <div className="p-8">Page content</div>
 * </PageTransition>
 */
export function PageTransition({
  children,
  className,
  type = 'slideUp',
  duration = 0.2,
}: PageTransitionProps) {
  const location = useLocation()
  const variants = transitionVariants[type]

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        className={cn(className)}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={{ duration, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * FadeIn - Wrapper simple para fade-in al montar
 */
interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
}

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.4,
  direction = 'up',
}: FadeInProps) {
  const directionOffset = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 },
    none: {},
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, ...directionOffset[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}

/**
 * ScaleIn - Wrapper para scale-in al montar
 */
interface ScaleInProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function ScaleIn({ children, className, delay = 0 }: ScaleInProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
        delay,
      }}
    >
      {children}
    </motion.div>
  )
}

export default PageTransition
