/**
 * Design System - Animation Tokens
 *
 * Valores estandarizados para animaciones consistentes en toda la app.
 * Compatible con Framer Motion y Tailwind CSS.
 */

// Duraciones estándar (en segundos para Framer Motion)
export const durations = {
  instant: 0.1,
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  slower: 0.8,
  slowest: 1.2,
} as const

// Easings para Framer Motion
export const easings = {
  // Standard easings
  linear: [0, 0, 1, 1],
  easeIn: [0.4, 0, 1, 1],
  easeOut: [0, 0, 0.2, 1],
  easeInOut: [0.4, 0, 0.2, 1],

  // Custom easings para micro-interacciones
  bounceIn: [0.68, -0.55, 0.265, 1.55],
  bounceOut: [0.34, 1.56, 0.64, 1],
  smooth: [0.4, 0, 0.2, 1],
  snappy: [0.17, 0.55, 0.55, 1],

  // Spring presets (para usar con type: "spring")
  spring: { stiffness: 300, damping: 20 },
  springBouncy: { stiffness: 400, damping: 15 },
  springStiff: { stiffness: 500, damping: 30 },
  springGentle: { stiffness: 200, damping: 25 },
} as const

// Variantes de animación para Framer Motion
export const motionVariants = {
  // Fade variants
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: durations.normal } },
    exit: { opacity: 0, transition: { duration: durations.fast } },
  },

  // Slide variants
  slideUp: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: durations.normal, ease: easings.easeOut } },
    exit: { opacity: 0, y: -10, transition: { duration: durations.fast } },
  },

  slideDown: {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: durations.normal, ease: easings.easeOut } },
    exit: { opacity: 0, y: 10, transition: { duration: durations.fast } },
  },

  slideLeft: {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: durations.normal, ease: easings.easeOut } },
    exit: { opacity: 0, x: -10, transition: { duration: durations.fast } },
  },

  slideRight: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: durations.normal, ease: easings.easeOut } },
    exit: { opacity: 0, x: 10, transition: { duration: durations.fast } },
  },

  // Scale variants
  scaleIn: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { type: 'spring', ...easings.spring } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: durations.fast } },
  },

  scaleUp: {
    hidden: { opacity: 0, scale: 0.5 },
    visible: { opacity: 1, scale: 1, transition: { type: 'spring', ...easings.springBouncy } },
    exit: { opacity: 0, scale: 0.8, transition: { duration: durations.fast } },
  },

  // Stagger container
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  },

  // Item para stagger
  staggerItem: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  },

} as const

// Hover/Tap effects (para usar con whileHover/whileTap)
export const hoverTapEffects = {
  tapScale: {
    scale: 0.98,
    transition: { duration: durations.instant },
  },

  hoverScale: {
    scale: 1.02,
    transition: { duration: durations.fast },
  },

  hoverGlow: {
    boxShadow: '0 0 20px rgba(13, 129, 206, 0.4)',
    transition: { duration: durations.normal },
  },
} as const

// Transiciones para Framer Motion
export const transitions = {
  default: { duration: durations.normal, ease: easings.easeOut },
  fast: { duration: durations.fast, ease: easings.easeOut },
  slow: { duration: durations.slow, ease: easings.easeInOut },
  spring: { type: 'spring', ...easings.spring },
  springBouncy: { type: 'spring', ...easings.springBouncy },
} as const

export type Duration = keyof typeof durations
export type Easing = keyof typeof easings
export type MotionVariant = keyof typeof motionVariants
