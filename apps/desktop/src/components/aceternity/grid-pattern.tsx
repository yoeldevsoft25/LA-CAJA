import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useId } from 'react'

interface GridPatternProps {
  width?: number
  height?: number
  x?: number
  y?: number
  strokeDasharray?: string
  className?: string
  squaresClassName?: string
  animated?: boolean
}

/**
 * Grid Pattern - Patrón de cuadrícula SVG decorativo
 *
 * Inspirado en Aceternity UI. Útil para fondos sutiles.
 *
 * @example
 * <div className="relative">
 *   <GridPattern className="opacity-50" />
 *   <div className="relative z-10">Your content</div>
 * </div>
 */
export function GridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = '0',
  className,
  squaresClassName,
  animated = false,
}: GridPatternProps) {
  const id = useId()

  const Wrapper = animated ? motion.svg : 'svg'
  const animationProps = animated
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 1 },
      }
    : {}

  return (
    <Wrapper
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-gray-400/30',
        className
      )}
      {...animationProps}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path
            d={`M.5 ${height}V.5H${width}`}
            fill="none"
            strokeDasharray={strokeDasharray}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
      {/* Squares highlight (optional) */}
      {squaresClassName && (
        <g className={squaresClassName}>
          <rect width={width} height={height} x={width * 2} y={height * 2} />
          <rect width={width} height={height} x={width * 5} y={height * 4} />
          <rect width={width} height={height} x={width * 8} y={height * 1} />
        </g>
      )}
    </Wrapper>
  )
}

/**
 * Dot Pattern - Patrón de puntos decorativo
 */
interface DotPatternProps {
  className?: string
  dotSize?: number
  gap?: number
}

export function DotPattern({ className, dotSize = 1.5, gap = 16 }: DotPatternProps) {
  const id = useId()

  return (
    <svg
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full fill-neutral-400/50',
        className
      )}
    >
      <defs>
        <pattern
          id={id}
          width={gap}
          height={gap}
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse"
        >
          <circle cx={dotSize} cy={dotSize} r={dotSize} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  )
}

export default GridPattern
