import { motion, type HTMLMotionProps, type Variants } from 'framer-motion'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { motionVariants, transitions } from '@/design-system'

// Filter out non-Variants types for the animation prop
type ValidAnimationVariants = {
  [K in keyof typeof motionVariants]: typeof motionVariants[K] extends { hidden: unknown; visible: unknown }
    ? K
    : never
}[keyof typeof motionVariants]

type AnimationType = ValidAnimationVariants

interface AnimatedContainerProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode
  animation?: AnimationType
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'article' | 'main' | 'aside'
  customVariants?: Variants
}

/**
 * AnimatedContainer - Wrapper de animación genérico
 *
 * Usa variantes predefinidas del design system para animaciones consistentes.
 *
 * @example
 * <AnimatedContainer animation="slideUp">
 *   <Card>Content</Card>
 * </AnimatedContainer>
 *
 * @example
 * <AnimatedContainer animation="scaleIn" delay={0.2}>
 *   <Button>Animated Button</Button>
 * </AnimatedContainer>
 */
export const AnimatedContainer = forwardRef<HTMLDivElement, AnimatedContainerProps>(
  (
    {
      children,
      animation = 'fadeIn',
      delay = 0,
      className,
      as = 'div',
      customVariants,
      ...props
    },
    ref
  ) => {
    const Component = motion[as]
    const variants = customVariants || (motionVariants[animation] as Variants)

    return (
      <Component
        ref={ref}
        className={cn(className)}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={variants}
        transition={{ ...transitions.default, delay }}
        {...props}
      >
        {children}
      </Component>
    )
  }
)

AnimatedContainer.displayName = 'AnimatedContainer'

/**
 * StaggerContainer - Container para animaciones stagger
 *
 * @example
 * <StaggerContainer>
 *   {items.map(item => (
 *     <StaggerItem key={item.id}>
 *       <Card>{item.name}</Card>
 *     </StaggerItem>
 *   ))}
 * </StaggerContainer>
 */
interface StaggerContainerProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode
  className?: string
  staggerDelay?: number
  initialDelay?: number
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
  initialDelay = 0.1,
  ...props
}: StaggerContainerProps) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: initialDelay,
          },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/**
 * StaggerItem - Item dentro de un StaggerContainer
 */
interface StaggerItemProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode
  className?: string
}

export function StaggerItem({ children, className, ...props }: StaggerItemProps) {
  return (
    <motion.div
      className={cn(className)}
      variants={motionVariants.staggerItem as Variants}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export default AnimatedContainer
