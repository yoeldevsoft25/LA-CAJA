import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface Particle {
  id: number
  size: number
  left: number
  top: number
  duration: number
  delay: number
  yMove: [number, number]
  xMove: [number, number]
}

interface FloatingParticlesProps {
  count?: number
  className?: string
  color?: string
  minSize?: number
  maxSize?: number
  minDuration?: number
  maxDuration?: number
}

/**
 * Floating Particles - Partículas flotantes animadas
 *
 * Componente optimizado con useMemo para evitar regeneración
 * en cada render. Las partículas son estáticas en posición
 * inicial pero animadas con Framer Motion.
 *
 * @example
 * <div className="relative">
 *   <FloatingParticles count={30} color="rgba(13, 129, 206, 0.5)" />
 *   <div className="relative z-10">Your content</div>
 * </div>
 */
export function FloatingParticles({
  count = 50,
  className,
  color = 'rgba(13, 129, 206, 0.5)',
  minSize = 2,
  maxSize = 5,
  minDuration = 5,
  maxDuration = 9,
}: FloatingParticlesProps) {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => {
      const size = Math.random() * (maxSize - minSize) + minSize
      const duration = Math.random() * (maxDuration - minDuration) + minDuration
      const moveDistance = 20 + Math.random() * 30

      return {
        id: i,
        size,
        left: Math.random() * 100,
        top: Math.random() * 100,
        duration,
        delay: Math.random() * 3,
        yMove: [
          (Math.random() - 0.5) * moveDistance,
          (Math.random() - 0.5) * moveDistance * 0.5,
        ],
        xMove: [
          (Math.random() - 0.5) * moveDistance * 0.4,
          (Math.random() - 0.5) * moveDistance * 0.2,
        ],
      }
    })
  }, [count, minSize, maxSize, minDuration, maxDuration])

  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            backgroundColor: color,
          }}
          animate={{
            y: [0, particle.yMove[0], particle.yMove[1], 0],
            x: [0, particle.xMove[0], particle.xMove[1], 0],
            opacity: [0.2, 0.6, 0.4, 0.2],
            scale: [1, 1.3, 1.1, 1],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

export default FloatingParticles
